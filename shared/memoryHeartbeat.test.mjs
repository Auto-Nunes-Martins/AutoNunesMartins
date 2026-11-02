import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryHeartbeat } from './memoryHeartbeat.mjs';
test('one minute heartbeat emits only bounded numeric memory and stops without blocking shutdown', () => {
  let tick,
    cancelled = false,
    unref = false;
  const entries = [];
  const stop = startMemoryHeartbeat({
    every: (callback, ms) => {
      assert.equal(ms, 60_000);
      tick = callback;
      return {
        unref() {
          unref = true;
        },
      };
    },
    cancel: () => {
      cancelled = true;
    },
    rss: () => 100,
    read: {
      read: (options) => {
        assert.equal(options.detail, false);
        return {
          available: true,
          currentBytes: 200,
          effectiveLimitBytes: 512,
          ignoredPrivateData: 'private',
        };
      },
    },
    log: (entry) => entries.push(entry),
  });
  assert.deepEqual(entries, []);
  tick();
  assert.deepEqual(entries, [
    { event: 'memory_health', rssBytes: 100, containerBytes: 200, containerLimitBytes: 512 },
  ]);
  assert.equal(unref, true);
  stop();
  assert.equal(cancelled, true);
});
test('unavailable container data is explicit through absence; failures cannot break the service', () => {
  let tick;
  const entries = [];
  const read = { read: () => ({ available: false }) };
  startMemoryHeartbeat({
    every: (cb) => {
      tick = cb;
      return {};
    },
    read,
    rss: () => 10,
    log: (e) => entries.push(e),
  });
  tick();
  assert.deepEqual(entries, [{ event: 'memory_health', rssBytes: 10 }]);
  read.read = () => {
    throw Error('unavailable');
  };
  assert.doesNotThrow(tick);
});
