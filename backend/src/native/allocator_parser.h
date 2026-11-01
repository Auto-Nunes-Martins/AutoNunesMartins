#ifndef ANM_ALLOCATOR_PARSER_H
#define ANM_ALLOCATOR_PARSER_H
#include <errno.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define ANM_XML_LIMIT 65536
#define ANM_SAFE_INTEGER UINT64_C(9007199254740991)
typedef struct {
  uint64_t arenas, system_bytes, free_fast, free_rest, mmap_bytes, mmap_count;
} anm_allocator_stats;

static int anm_attribute(const char *line, const char *name, uint64_t *value) {
  const char *start = strstr(line, name);
  char *end = NULL;
  unsigned long long number;
  if (!start) return 0;
  start += strlen(name);
  if (*start < '0' || *start > '9') return 0;
  errno = 0;
  number = strtoull(start, &end, 10);
  if (errno == ERANGE || !end || *end != '"' || number > ANM_SAFE_INTEGER) return 0;
  *value = (uint64_t)number;
  return 1;
}

/* Parse only the global totals outside <heap>. Never sum arena and global totals.
 * XML stays in the caller's capped scratch buffer; no allocation, addresses or output.
 */
static int anm_parse_allocator(const char *xml, size_t length, anm_allocator_stats *out) {
  size_t at = 0;
  unsigned seen = 0;
  int root = 0, heap = 0, closed = 0;
  anm_allocator_stats result = {0};
  if (!xml || !out || length == 0 || length >= ANM_XML_LIMIT) return 0;
  while (at < length) {
    size_t begin = at, size;
    char line[512];
    while (at < length && xml[at] != '\n') at++;
    size = at - begin;
    if (at < length) at++;
    while (size && (xml[begin] == ' ' || xml[begin] == '\t')) { begin++; size--; }
    while (size && (xml[begin + size - 1] == '\r' || xml[begin + size - 1] == ' ')) size--;
    if (!size) continue;
    if (size >= sizeof(line) || closed) return 0;
    memcpy(line, xml + begin, size); line[size] = 0;
    if (!root) {
      if (strcmp(line, "<malloc version=\"1\">") != 0) return 0;
      root = 1; continue;
    }
    if (strncmp(line, "<heap ", 6) == 0) {
      uint64_t number;
      if (heap || !anm_attribute(line, "nr=\"", &number) || number != result.arenas) return 0;
      result.arenas++; heap = 1; continue;
    }
    if (strcmp(line, "</heap>") == 0) {
      if (!heap) return 0;
      heap = 0; continue;
    }
    if (strcmp(line, "</malloc>") == 0) {
      if (heap) return 0;
      closed = 1; continue;
    }
    if (heap) continue;
    if (strncmp(line, "<total type=\"fast\" ", 19) == 0) {
      if ((seen & 1) || !anm_attribute(line, "size=\"", &result.free_fast)) return 0;
      seen |= 1;
    } else if (strncmp(line, "<total type=\"rest\" ", 19) == 0) {
      if ((seen & 2) || !anm_attribute(line, "size=\"", &result.free_rest)) return 0;
      seen |= 2;
    } else if (strncmp(line, "<total type=\"mmap\" ", 19) == 0) {
      if ((seen & 4) || !anm_attribute(line, "size=\"", &result.mmap_bytes) ||
          !anm_attribute(line, "count=\"", &result.mmap_count)) return 0;
      seen |= 4;
    } else if (strncmp(line, "<system type=\"current\" ", 23) == 0) {
      if ((seen & 8) || !anm_attribute(line, "size=\"", &result.system_bytes)) return 0;
      seen |= 8;
    }
  }
  if (!closed || heap || !result.arenas || seen != 15 ||
      result.free_fast > result.system_bytes ||
      result.free_rest > result.system_bytes - result.free_fast) return 0;
  *out = result;
  return 1;
}
#endif
