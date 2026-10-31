export function recordDiagnostic(row: unknown): void;
export function sanitizeDiagnostic(row: unknown): Record<string, unknown> | undefined;
export function acceptDiagnosticEvents(rows: unknown): boolean;
export function setDiagnosticSender(
  send: (rows: unknown[], callback: (error?: unknown) => void) => void,
): void;
export function setDiagnosticConsumer(
  consume: (rows: Record<string, unknown>[]) => Promise<void>,
): void;
export function flushDiagnosticEvents(): Promise<void>;
export function diagnosticTransportStats(): {
  transportQueued: number;
  transportDropped: number;
  transportInFlight: boolean;
  transportRetries: number;
  transportConsecutiveFailures: number;
  transportLastFailureEpochMs: number;
  transportOldestQueuedAgeMs: number;
};
