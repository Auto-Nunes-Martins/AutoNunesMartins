// Safe synthetic fixture workload: no database, network, Storage or real vehicles.
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ProcessDiagnostics } from '../../shared/runtimeDiagnostics.mjs';
import { optimizePhoto } from '../src/lib/server/photoOptimization.ts';
import { buildPhotoVariants } from '../src/lib/server/photoVariants.ts';
globalThis.fetch = async () => {
  throw Error('Network forbidden in memory harness');
};
const width = 800,
  height = 1200;
let raw = Buffer.alloc(width * height * 3);
for (let i = 0; i < raw.length; i++) raw[i] = ((i * 17) ^ (i >>> 9)) & 255;
const input = await sharp(raw, { raw: { width, height, channels: 3 } })
  .jpeg({ quality: 90 })
  .toBuffer();
raw = undefined;
const ends = [];
const diagnostics = new ProcessDiagnostics({
  env: {
    RUNTIME_DIAGNOSTICS: 'true',
    RUNTIME_DIAGNOSTICS_SAMPLE_MS: '100',
    RUNTIME_DIAGNOSTICS_IDLE_MS: '5000',
  },
  service: 'harness',
  sink: (row) => {
    process.stdout.write(JSON.stringify(row) + '\n');
    if (row.kind === 'upload_end') ends.push(row);
  },
});
try {
  for (const count of [1, 10]) {
    for (let i = 0; i < count; i++) {
      // New opaque correlation each time, no per-vehicle reset or production identifiers.
      const trace = diagnostics.begin(randomUUID(), { originalBytes: input.length });
      try {
        trace.phase('receive');
        trace.fields({ inputBytes: input.length });
        const master = await optimizePhoto(input, trace);
        trace.phase('storage'); // Storage is deliberately simulated without writes.
        trace.phase('variant_encode');
        const variants = await buildPhotoVariants(master.buffer);
        trace.phase('variant_storage', { variants: variants.files.length });
        trace.fields({
          outputBytes: master.buffer.length,
          width: variants.manifest.width,
          height: variants.manifest.height,
        });
        trace.phase('finalize');
        trace.finish('ok', { status: 201 });
      } catch (error) {
        trace.finish('error');
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5500));
    console.log(
      JSON.stringify({
        event: 'photo_diagnostic_harness',
        batch: count,
        total: diagnostics.sequence,
        active: diagnostics.active.size,
        retainedNumericSummaries: diagnostics.recent.size,
      }),
    );
  }
  assert.equal(ends.length, 11);
  assert.deepEqual(
    ends.map((row) => row.upload),
    Array.from({ length: 11 }, (_, i) => i + 1),
  );
  assert.equal(diagnostics.active.size, 0);
  assert.ok(ends.some((row) => row.samples > 6));
} finally {
  diagnostics.stop();
}
