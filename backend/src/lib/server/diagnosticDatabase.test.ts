import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { diagnosticRows } from './diagnosticRemoteStore';
it('real PostgreSQL migration/RPC writes idempotently, preserves origin and restricts public access', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated',
    );
    await pg.exec(
      await readFile(
        new URL(
          '../../../prisma/migrations/20261031010000_runtime_diagnostics/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await pg.exec(
      await readFile(
        new URL(
          '../../../prisma/migrations/20261031011000_runtime_diagnostics_permissions/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const access = (
      await pg.query<any>(
        "SELECT has_function_privilege('anon','public.append_runtime_diagnostics(jsonb)','execute') AS anon,has_function_privilege('authenticated','public.append_runtime_diagnostics(jsonb)','execute') AS authenticated,has_function_privilege('service_role','public.append_runtime_diagnostics(jsonb)','execute') AS service",
      )
    ).rows[0];
    expect(access).toEqual({ anon: false, authenticated: false, service: true });
    const row = {
      event: 'runtime_diagnostics',
      kind: 'upload_end',
      time: new Date().toISOString(),
      instance: randomUUID(),
      boot: randomUUID(),
      eventId: randomUUID(),
      service: 'backend',
      processSequence: 7,
      native: { smapsAnonBytes: 900 },
      password: 'never-store',
    };
    const data = JSON.stringify(diagnosticRows([row]));
    expect(
      (
        await pg.query<{ n: number }>('SELECT public.append_runtime_diagnostics($1::jsonb) AS n', [
          data,
        ])
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await pg.query<{ n: number }>('SELECT public.append_runtime_diagnostics($1::jsonb) AS n', [
          data,
        ])
      ).rows[0].n,
    ).toBe(0);
    const saved = (await pg.query<any>('SELECT * FROM "RuntimeDiagnosticEvent"')).rows[0];
    expect(saved.payload.native.smapsAnonBytes).toBe(900);
    expect(saved.payload.password).toBeUndefined();
    expect(Number(saved.processSequence)).toBe(7);
    expect(saved.receivedAt).toBeDefined();
    const privileges = (
      await pg.query<any>(
        "SELECT relrowsecurity FROM pg_class WHERE relname='RuntimeDiagnosticEvent'",
      )
    ).rows[0];
    expect(privileges.relrowsecurity).toBe(true);
    await pg.exec('CREATE ROLE diagnostic_reader');
    expect(
      (
        await pg.query<any>(
          "SELECT has_function_privilege('diagnostic_reader','public.append_runtime_diagnostics(jsonb)','execute') AS allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await pg.exec(
      'CREATE TABLE unrelated_data (id integer); INSERT INTO unrelated_data VALUES (1); UPDATE "RuntimeDiagnosticEvent" SET "receivedAt"=\'2000-01-01\'',
    );
    const next = JSON.stringify(
      diagnosticRows([{ ...row, eventId: randomUUID(), processSequence: 8 }]),
    );
    await pg.query('SELECT public.append_runtime_diagnostics($1::jsonb)', [next]);
    expect(
      (await pg.query<any>('SELECT count(*) AS n FROM "RuntimeDiagnosticEvent"')).rows[0].n,
    ).toBe(1);
    await pg.exec(
      `INSERT INTO "RuntimeDiagnosticEvent" ("eventId","occurredAt","instance","boot","service","event","processSequence","payload") SELECT md5(i::text)::uuid,now(),'${row.instance}','${row.boot}','backend','runtime_diagnostics',i,'{}' FROM generate_series(1,10001) i`,
    );
    await pg.query('SELECT public.append_runtime_diagnostics($1::jsonb)', [next]);
    expect(
      (await pg.query<any>('SELECT count(*) AS n FROM "RuntimeDiagnosticEvent"')).rows[0].n,
    ).toBe(10000);
    expect((await pg.query<any>('SELECT count(*) AS n FROM unrelated_data')).rows[0].n).toBe(1);
  } finally {
    await pg.close();
  }
});
