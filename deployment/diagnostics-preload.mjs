import { getProcessDiagnostics } from '../shared/runtimeDiagnostics.mjs';
// Installs one exit/crash observer per process, without intercepting normal crash behavior.
getProcessDiagnostics();
