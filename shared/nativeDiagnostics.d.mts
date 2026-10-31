export function nativeDiagnosticSnapshot(): Record<string, unknown>;
export function registerDiagnosticProvider(name: string, provider: () => unknown): void;
