import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFileSync, existsSync } from 'node:fs';
import { migrateBeforeStart } from './migrate-before-start.mjs';

const database = 'postgresql://postgres:fixture-password@db.fixture.supabase.co:5432/postgres';
const paths = {
  cli: '/fixture/prisma/build/index.js',
  schema: '/fixture/backend/prisma/schema.prisma',
  cwd: '/fixture/backend',
};
function fixture({
  code = 0,
  output = 'No pending migrations to apply.',
  hold = false,
  error = false,
} = {}) {
  const signals = new EventEmitter(),
    events = [],
    logs = [],
    calls = [];
  let child;
  return {
    events,
    logs,
    calls,
    signals,
    options: {
      env: { DATABASE_URL: database },
      signals,
      getPaths: () => paths,
      log: (line) => logs.push(line),
      start: async () => events.push('start'),
      spawn: (...args) => {
        events.push('migrate');
        calls.push(args);
        child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.kill = (signal) => {
          events.push(signal);
          queueMicrotask(() => child.emit('close', null));
          return true;
        };
        if (!hold)
          queueMicrotask(() => {
            if (error) child.emit('error', new Error('private process error'));
            else {
              child.stdout.write(output);
              child.emit('close', code);
            }
          });
        return child;
      },
    },
  };
}
test('uses the installed Prisma CLI and starts services only after a successful no-pending deploy', async () => {
  const f = fixture();
  const original = { ...f.options.env };
  await migrateBeforeStart(f.options);
  assert.deepEqual(f.events, ['migrate', 'start']);
  const [exe, args, options] = f.calls[0];
  assert.equal(exe, process.execPath);
  assert.deepEqual(args, [paths.cli, 'migrate', 'deploy', '--schema', paths.schema]);
  assert.equal(options.cwd, paths.cwd);
  assert.equal(options.env.DIRECT_URL, database);
  assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.deepEqual(f.options.env, original);
});
test('uses an explicit session/direct URL while retaining the runtime database URL', async () => {
  const f = fixture();
  const pooled =
    'postgresql://postgres.fixture:fixture-password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  f.options.env = { DATABASE_URL: pooled, DIRECT_URL: database };
  await migrateBeforeStart(f.options);
  assert.equal(f.calls[0][2].env.DATABASE_URL, pooled);
  assert.equal(f.calls[0][2].env.DIRECT_URL, database);
});
test('does not start any services after failed migrations and redacts credentials from child output', async () => {
  const f = fixture({ code: 1, output: 'Failed ' + database + ' password=fixture-password' });
  await assert.rejects(migrateBeforeStart(f.options), /migration failed/);
  assert.deepEqual(f.events, ['migrate']);
  assert.ok(f.logs.every((line) => !line.includes(database) && !line.includes('fixture-password')));
  assert.equal(f.signals.listenerCount('SIGTERM'), 0);
  assert.equal(f.signals.listenerCount('SIGINT'), 0);
});
test('redacts decoded and percent-encoded passwords', async () => {
  const f = fixture({ code: 1, output: 'password=p%40ssword and p@ssword' });
  f.options.env = {
    DATABASE_URL: 'postgresql://postgres:p%40ssword@db.fixture.supabase.co:5432/postgres',
  };
  await assert.rejects(migrateBeforeStart(f.options));
  assert.ok(f.logs.every((line) => !line.includes('p%40ssword') && !line.includes('p@ssword')));
});
test('fails before invoking Prisma on absent or invalid database configuration', async () => {
  for (const env of [{}, { DATABASE_URL: 'invalid' }, { DATABASE_URL: 'https://example.org' }]) {
    const f = fixture();
    f.options.env = env;
    await assert.rejects(migrateBeforeStart(f.options), /DATABASE_URL|PostgreSQL/);
    assert.deepEqual(f.events, []);
  }
});
test('rejects transaction poolers for migration instead of silently migrating over a pooled runtime connection', async () => {
  for (const env of [
    { DATABASE_URL: database.replace(':5432/', ':6543/') },
    { DATABASE_URL: database + '?pgbouncer=true' },
    { DATABASE_URL: database, DIRECT_URL: database.replace(':5432/', ':6543/') },
  ]) {
    const f = fixture();
    f.options.env = env;
    await assert.rejects(migrateBeforeStart(f.options), /DIRECT_URL/);
    assert.deepEqual(f.events, []);
  }
});
test('rejects mismatched Supabase project or database targets', async () => {
  for (const direct of [
    database.replace('db.fixture.', 'db.other.'),
    database.replace(/\/postgres$/, '/other'),
    database + '?schema=other',
  ]) {
    const f = fixture();
    f.options.env.DIRECT_URL = direct;
    await assert.rejects(migrateBeforeStart(f.options), /same database/);
    assert.deepEqual(f.events, []);
  }
});
test('fails clearly when image dependencies or migration files are missing', async () => {
  const f = fixture();
  f.options.getPaths = () => {
    throw new Error('private underlying details');
  };
  await assert.rejects(migrateBeforeStart(f.options), (error) => {
    assert.match(error.message, /Prisma CLI, schema or migration files/);
    assert.ok(!error.message.includes('private underlying'));
    return true;
  });
  assert.deepEqual(f.events, []);
});
test('handles a child-process startup failure without starting application services', async () => {
  const f = fixture({ error: true });
  await assert.rejects(migrateBeforeStart(f.options), /Could not run/);
  assert.deepEqual(f.events, ['migrate']);
});
test('forwards shutdown during migration and never launches the application afterward', async () => {
  const f = fixture({ hold: true });
  const pending = migrateBeforeStart(f.options);
  f.signals.emit('SIGTERM');
  await assert.rejects(pending, /interrupted/);
  assert.deepEqual(f.events, ['migrate', 'SIGTERM']);
  assert.equal(f.signals.listenerCount('SIGTERM'), 0);
});
test('bounds a stuck migration and prevents application startup', async () => {
  const f = fixture({ hold: true });
  await assert.rejects(migrateBeforeStart({ ...f.options, timeoutMs: 5 }), /timed out/);
  assert.deepEqual(f.events, ['migrate', 'SIGTERM']);
});
test('omits oversized output rather than logging truncated secret fragments', async () => {
  const f = fixture({ code: 1, output: 'x'.repeat(70_000) + 'fixture-password' });
  await assert.rejects(migrateBeforeStart(f.options));
  assert.ok(f.logs.some((line) => line.includes('omitted')));
  assert.ok(f.logs.every((line) => !line.includes('fixture-password')));
});
test('resolves real installed project paths without running a real database command', async () => {
  const f = fixture();
  delete f.options.getPaths;
  await migrateBeforeStart(f.options);
  assert.ok(existsSync(f.calls[0][1][0]));
  assert.ok(existsSync(f.calls[0][1][4]));
});
test('copies migrations into the runtime image and only changes the Docker startup entry path', () => {
  const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const compatibility = readFileSync(new URL('../backend/Dockerfile', import.meta.url), 'utf8');
  assert.equal(compatibility.replaceAll('\r\n', '\n'), docker.replaceAll('\r\n', '\n'));
  const runtime = docker.slice(docker.indexOf('AS runtime'));
  assert.match(runtime, /COPY --from=builder.*\/app\/backend\/prisma\/schema\.prisma/);
  assert.match(runtime, /COPY --from=builder.*\/app\/backend\/prisma\/migrations/);
  assert.match(runtime, /COPY --from=builder.*\/app\/node_modules/);
  assert.match(runtime, /CMD \["node", "deployment\/container-start\.mjs"\]/);
  assert.ok(!docker.includes('RUN prisma migrate'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['start:service'], 'node deployment/start.mjs');
  const start = readFileSync(new URL('./start.mjs', import.meta.url), 'utf8');
  assert.ok(!start.includes('migrateBeforeStart'));
});
