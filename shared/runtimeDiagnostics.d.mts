export type DiagnosticPhase =
  | 'lookup'
  | 'receive'
  | 'metadata'
  | 'optimize'
  | 'sanitize'
  | 'storage'
  | 'derivatives'
  | 'variant_encode'
  | 'variant_storage'
  | 'dimensions'
  | 'finalize';
export interface UploadTrace {
  id?: string;
  phase(name: DiagnosticPhase, fields?: Record<string, number>): void;
  fields(values: Record<string, number>): void;
  finish(outcome?: 'ok' | 'error' | 'aborted', values?: Record<string, number>): void;
}
export interface Diagnostics {
  enabled: boolean;
  begin(id?: string, metrics?: Record<string, number>): UploadTrace;
  rejection(): void;
  clientTransfer(id: string, metrics: Record<string, number>, outcome: string): boolean;
  marker(
    kind: string,
    fields?: Record<string, number>,
    context?: { child?: string; signal?: string | null },
  ): void;
  stop(): void;
}
export function getProcessDiagnostics(service?: string): Diagnostics;
export function clientMetrics(header: unknown): Record<string, number>;
export function correlationId(value: unknown): string;
export function safeMetrics(value: unknown): Record<string, number>;
