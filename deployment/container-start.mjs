import { migrateBeforeStart } from './migrate-before-start.mjs';

try {
  await migrateBeforeStart({ start: () => import('./start.mjs') });
} catch (error) {
  // Migration errors are sanitized by the orchestration layer; never dump child/process state.
  console.error(error instanceof Error ? error.message : 'Container startup failed.');
  process.exitCode = 1;
}
