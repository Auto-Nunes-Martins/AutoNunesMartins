import { spawn as spawnProcess } from 'node:child_process';
import { accessSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
function migrationPaths(root) {
  const cli = createRequire(join(root, 'backend/package.json')).resolve('prisma/build/index.js');
  const schema = join(root, 'backend/prisma/schema.prisma');
  accessSync(cli);
  accessSync(schema);
  accessSync(join(dirname(schema), 'migrations/migration_lock.toml'));
  return { cli, schema, cwd: join(root, 'backend') };
}
function migrationEnvironment(env) {
  if (!env.DATABASE_URL?.trim())
    throw new Error('DATABASE_URL is required for container migrations.');
  const direct = env.DIRECT_URL?.trim() || env.DATABASE_URL;
  let runtimeUrl, migrationUrl;
  try {
    runtimeUrl = new URL(env.DATABASE_URL);
    migrationUrl = new URL(direct);
    if (
      ![runtimeUrl, migrationUrl].every((url) =>
        ['postgres:', 'postgresql:'].includes(url.protocol),
      )
    )
      throw new Error();
  } catch {
    throw new Error('Database migration configuration must use valid PostgreSQL URLs.');
  }
  if (migrationUrl.port === '6543' || migrationUrl.searchParams.get('pgbouncer') === 'true')
    throw new Error('Set DIRECT_URL to a direct or session connection, not a transaction pooler.');
  const project = (url) =>
    url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ||
    (url.hostname.endsWith('.pooler.supabase.com')
      ? decodeURIComponent(url.username).match(/^postgres\.(.+)$/)?.[1]
      : undefined);
  const runtimeProject = project(runtimeUrl),
    migrationProject = project(migrationUrl);
  if (
    (runtimeProject && migrationProject && runtimeProject !== migrationProject) ||
    runtimeUrl.pathname !== migrationUrl.pathname ||
    (runtimeUrl.searchParams.get('schema') || 'public') !==
      (migrationUrl.searchParams.get('schema') || 'public')
  )
    throw new Error('DATABASE_URL and DIRECT_URL must target the same database.');
  return { ...env, DIRECT_URL: direct, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' };
}
export function redactMigrationOutput(text, env) {
  const values = [];
  for (const [key, value] of Object.entries(env))
    if (/SECRET|TOKEN|KEY|PASSWORD|URL/.test(key) && value) values.push(value);
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    try {
      const password = new URL(env[key]).password;
      if (password) values.push(password, decodeURIComponent(password));
    } catch {
      /* Invalid configuration is rejected before spawning Prisma. */
    }
  }
  for (const value of values.sort((a, b) => b.length - a.length))
    text = text.split(value).join('[redacted]');
  return text.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted database URL]');
}

/** Docker-only entry path. Ordinary development commands do not call this function. */
export async function migrateBeforeStart({
  env = process.env,
  root = defaultRoot,
  spawn = spawnProcess,
  getPaths = migrationPaths,
  start,
  signals = process,
  log = console.info,
  timeoutMs = 300_000,
}) {
  if (typeof start !== 'function')
    throw new Error('Container service startup callback is missing.');
  const childEnv = migrationEnvironment(env);
  let paths;
  try {
    paths = getPaths(root);
  } catch {
    throw new Error('Installed Prisma CLI, schema or migration files are missing from the image.');
  }
  log('Applying pending database migrations before starting services.');
  await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, [paths.cli, 'migrate', 'deploy', '--schema', paths.schema], {
        cwd: paths.cwd,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      reject(new Error('Could not start the installed Prisma migration command.'));
      return;
    }
    let output = '',
      omitted = false,
      stopped = false,
      timedOut = false,
      forceTimer;
    const collect = (chunk) => {
      if (omitted) return;
      const next = output + chunk.toString();
      if (Buffer.byteLength(next) > 65_536) {
        output = '';
        omitted = true;
      } else output = next;
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    const stop = (signal) => {
      stopped = true;
      child.kill(signal);
      forceTimer ??= setTimeout(() => child.kill('SIGKILL'), 10_000);
      forceTimer.unref();
    };
    const term = () => stop('SIGTERM'),
      interrupt = () => stop('SIGINT');
    signals.on('SIGTERM', term);
    signals.on('SIGINT', interrupt);
    const timer = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      signals.removeListener('SIGTERM', term);
      signals.removeListener('SIGINT', interrupt);
    };
    child.once('error', () => {
      cleanup();
      reject(new Error('Could not run the installed Prisma migration command.'));
    });
    child.once('close', (code) => {
      cleanup();
      if (output.trim()) log(redactMigrationOutput(output.trim(), childEnv));
      if (omitted) log('Prisma output omitted because it exceeded the safe log size limit.');
      if (timedOut) reject(new Error('Database migration timed out; services were not started.'));
      else if (stopped)
        reject(new Error('Database migration interrupted; services were not started.'));
      else if (code !== 0)
        reject(new Error('Database migration failed; services were not started.'));
      else resolve();
    });
  });
  log('Database migrations complete. Starting services.');
  await start();
}
