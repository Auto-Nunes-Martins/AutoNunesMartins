import { registerDiagnosticProvider } from '../../../../shared/nativeDiagnostics.mjs';

const phaseNames = [
  'manifestDownload',
  'derivativeDownload',
  'masterDownload',
  'bufferMaterialize',
  'manifestMetadata',
  'derivativeMetadata',
  'masterSanitize',
] as const;
type Phase = (typeof phaseNames)[number];
const counterNames = [
  'reads',
  'speculativeReads',
  'cacheHits',
  'cacheMisses',
  'deduplicatedReads',
  'manifestHits',
  'manifestMisses',
  'manifestDeduplicated',
  'fallbackToMaster',
  'warmupsQueued',
  'warmupsStarted',
  'warmupsExpired',
  'warmupsCompleted',
  'warmupsFailed',
] as const;
type Counter = (typeof counterNames)[number];
type Memory = Pick<NodeJS.MemoryUsage, 'rss' | 'heapUsed' | 'external'>;
const bounded = (value: number) =>
  Number.isFinite(value)
    ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, value))
    : 0;

/** Fixed numeric aggregates for the existing 30s snapshot; no request identifiers or queue.
 * Memory differences describe the whole process during each phase, including other work.
 * Overlap counts only concurrent measured phases, not all concurrent HTTP/DB activity.
 */
export function createPhotoReadDiagnostics(options: {
  enabled: () => boolean;
  memory?: () => Memory;
  now?: () => number;
}) {
  const memory = options.memory ?? (() => process.memoryUsage());
  const now = options.now ?? (() => performance.now());
  const counters = Object.fromEntries(counterNames.map((name) => [name, 0])) as Record<
    Counter,
    number
  >;
  const phases = Object.fromEntries(
    phaseNames.map((name) => [
      name,
      {
        started: 0,
        completed: 0,
        failed: 0,
        active: 0,
        peakActive: 0,
        totalMs: 0,
        memorySamples: 0,
        rssDeltaBytes: 0,
        heapDeltaBytes: 0,
        externalDeltaBytes: 0,
        positiveRssDeltaBytes: 0,
        maxRssDeltaBytes: 0,
        overlappedSamples: 0,
      },
    ]),
  ) as Record<
    Phase,
    {
      started: number;
      completed: number;
      failed: number;
      active: number;
      peakActive: number;
      totalMs: number;
      memorySamples: number;
      rssDeltaBytes: number;
      heapDeltaBytes: number;
      externalDeltaBytes: number;
      positiveRssDeltaBytes: number;
      maxRssDeltaBytes: number;
      overlappedSamples: number;
    }
  >;
  let active = 0,
    sequence = 0;
  const sample = () => {
    try {
      return memory();
    } catch {
      return undefined;
    }
  };
  return {
    count(name: Counter) {
      if (options.enabled()) counters[name] = bounded(counters[name] + 1);
    },
    async measure<T>(name: Phase, operation: () => Promise<T>): Promise<T> {
      if (!options.enabled()) return operation();
      const phase = phases[name],
        before = sample(),
        started = now();
      const overlapAtStart = active > 0,
        ownSequence = (sequence = (sequence + 1) % Number.MAX_SAFE_INTEGER);
      active = bounded(active + 1);
      phase.started = bounded(phase.started + 1);
      phase.active = bounded(phase.active + 1);
      phase.peakActive = Math.max(phase.peakActive, phase.active);
      try {
        return await operation();
      } catch (error) {
        phase.failed = bounded(phase.failed + 1);
        throw error;
      } finally {
        const after = sample();
        phase.completed = bounded(phase.completed + 1);
        phase.active--;
        active--;
        phase.totalMs = bounded(phase.totalMs + Math.max(0, now() - started));
        if (overlapAtStart || sequence !== ownSequence)
          phase.overlappedSamples = bounded(phase.overlappedSamples + 1);
        if (
          before &&
          after &&
          [
            before.rss,
            before.heapUsed,
            before.external,
            after.rss,
            after.heapUsed,
            after.external,
          ].every(Number.isFinite)
        ) {
          const rss = after.rss - before.rss;
          phase.memorySamples = bounded(phase.memorySamples + 1);
          phase.rssDeltaBytes = bounded(phase.rssDeltaBytes + rss);
          phase.heapDeltaBytes = bounded(phase.heapDeltaBytes + after.heapUsed - before.heapUsed);
          phase.externalDeltaBytes = bounded(
            phase.externalDeltaBytes + after.external - before.external,
          );
          phase.positiveRssDeltaBytes = bounded(phase.positiveRssDeltaBytes + Math.max(0, rss));
          phase.maxRssDeltaBytes = bounded(Math.max(phase.maxRssDeltaBytes, rss));
        }
      }
    },
    snapshot() {
      return {
        ...counters,
        phases: Object.fromEntries(phaseNames.map((name) => [name, { ...phases[name] }])),
      };
    },
  };
}

export const photoReadDiagnostics = createPhotoReadDiagnostics({
  enabled: () => process.env.RUNTIME_DIAGNOSTICS === 'true',
});
if (process.env.RUNTIME_DIAGNOSTICS === 'true')
  registerDiagnosticProvider('photoreads', () => photoReadDiagnostics.snapshot());
