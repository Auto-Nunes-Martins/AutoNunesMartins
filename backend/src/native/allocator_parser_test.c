#include <assert.h>
#include <stdio.h>
#include "allocator_parser.h"

int main(void) {
  const char *valid = "<malloc version=\"1\">\n"
    "<heap nr=\"0\">\n<system type=\"current\" size=\"1000\"/>\n</heap>\n"
    "<heap nr=\"1\">\n<total type=\"rest\" count=\"1\" size=\"100\"/>\n</heap>\n"
    "<total type=\"fast\" count=\"1\" size=\"10\"/>\n"
    "<total type=\"rest\" count=\"2\" size=\"190\"/>\n"
    "<total type=\"mmap\" count=\"3\" size=\"4096\"/>\n"
    "<system type=\"current\" size=\"2000\"/>\n</malloc>\n";
  anm_allocator_stats result = {0};
  assert(anm_parse_allocator(valid, strlen(valid), &result));
  assert(result.arenas == 2 && result.system_bytes == 2000 && result.free_fast == 10 &&
    result.free_rest == 190 && result.mmap_bytes == 4096 && result.mmap_count == 3);
  assert(!anm_parse_allocator(valid, strlen(valid) - 11, &result));
  assert(!anm_parse_allocator(valid, ANM_XML_LIMIT, &result));
  {
    const char *unsupported = "<malloc version=\"2\">\n</malloc>\n";
    assert(!anm_parse_allocator(unsupported, strlen(unsupported), &result));
  }
  {
    char changed[1024];
    const char *position;
    strcpy(changed, valid);
    position = strstr(changed, "size=\"2000\"");
    assert(position); memcpy((char *)position + 6, "0001", 4);
    assert(!anm_parse_allocator(changed, strlen(changed), &result));
    strcpy(changed, valid);
    position = strstr(changed, "nr=\"1\"");
    assert(position); *((char *)position + 4) = '2';
    assert(!anm_parse_allocator(changed, strlen(changed), &result));
    strcpy(changed, valid);
    strcat(changed, "unexpected\n");
    assert(!anm_parse_allocator(changed, strlen(changed), &result));
    strcpy(changed, valid);
    position = strstr(changed, "</malloc>");
    assert(position);
    {
      const char *duplicate = "<total type=\"fast\" count=\"0\" size=\"0\"/>\n";
      size_t extra = strlen(duplicate);
      memmove((char *)position + extra, position, strlen(position) + 1);
      memcpy((char *)position, duplicate, extra);
      assert(!anm_parse_allocator(changed, strlen(changed), &result));
    }
    strcpy(changed, valid);
    position = strstr(changed, "size=\"2000\"");
    assert(position);
    {
      const char *overflow = "9007199254740992";
      size_t extra = strlen(overflow) - 4;
      memmove((char *)position + 10 + extra, position + 10, strlen(position + 10) + 1);
      memcpy((char *)position + 6, overflow, strlen(overflow));
      assert(!anm_parse_allocator(changed, strlen(changed), &result));
    }
  }
  puts("Allocator parser checks passed");
  return 0;
}
