#define _GNU_SOURCE
#include <node_api.h>
#include <stdio.h>
#include "allocator_parser.h"
#if defined(__linux__) && defined(__GLIBC__)
#include <malloc.h>
#endif

static int anm_number(napi_env env, napi_value object, const char *key, uint64_t number) {
  napi_value value;
  return napi_create_double(env, (double)number, &value) == napi_ok &&
    napi_set_named_property(env, object, key, value) == napi_ok;
}

static napi_value anm_snapshot(napi_env env, napi_callback_info info) {
  anm_allocator_stats stats = {0};
  uint64_t available = 0, reason = 1, bytes = 0;
  napi_value object;
  (void)info;
#if defined(__linux__) && defined(__GLIBC__)
  char xml[ANM_XML_LIMIT];
  FILE *stream = fmemopen(xml, sizeof(xml), "w");
  reason = 3;
  if (stream) {
    /* Avoid a stdio buffer allocation inside malloc_info's arena traversal. */
    if (setvbuf(stream, NULL, _IONBF, 0) == 0) {
      int result = malloc_info(0, stream);
      int flushed = fflush(stream), failed = ferror(stream);
      long position = ftell(stream);
      if (position >= (long)sizeof(xml) - 1) reason = 4;
      else if (result == 0 && flushed == 0 && !failed && position > 0) {
        bytes = (uint64_t)position;
        reason = 5;
        if (anm_parse_allocator(xml, (size_t)position, &stats)) { available = 1; reason = 0; }
      }
    }
    if (fclose(stream) != 0) { available = 0; if (reason != 4) reason = 3; }
  }
#endif
  if (napi_create_object(env, &object) != napi_ok ||
      !anm_number(env, object, "available", available) ||
      !anm_number(env, object, "reasonCode", reason) ||
      !anm_number(env, object, "arenaCount", stats.arenas) ||
      !anm_number(env, object, "arenaSystemBytes", stats.system_bytes) ||
      !anm_number(env, object, "arenaFreeFastBytes", stats.free_fast) ||
      !anm_number(env, object, "arenaFreeRestBytes", stats.free_rest) ||
      !anm_number(env, object, "arenaNonFreeBytes", stats.system_bytes - stats.free_fast - stats.free_rest) ||
      !anm_number(env, object, "mmapBytes", stats.mmap_bytes) ||
      !anm_number(env, object, "mmapCount", stats.mmap_count) ||
      !anm_number(env, object, "xmlBytes", bytes) ||
      !anm_number(env, object, "outputLimitBytes", ANM_XML_LIMIT)) return NULL;
  return object;
}

static napi_value anm_init(napi_env env, napi_value exports) {
  napi_value fn;
  if (napi_create_function(env, "snapshot", NAPI_AUTO_LENGTH, anm_snapshot, NULL, &fn) != napi_ok ||
      napi_set_named_property(env, exports, "snapshot", fn) != napi_ok) return NULL;
  return exports;
}
NAPI_MODULE(allocator_snapshot, anm_init)
