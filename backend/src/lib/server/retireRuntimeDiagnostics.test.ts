import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('retires diagnostic persistence compatibly, then removes only its objects after writers drain', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      'CREATE ROLE service_role; CREATE TABLE business_data(id integer PRIMARY KEY); INSERT INTO business_data VALUES (7)',
    );
    const migration = (name: string) =>
      readFile(new URL('../../../prisma/' + name, import.meta.url), 'utf8');
    await pg.exec(await migration('migrations/20261031010000_runtime_diagnostics/migration.sql'));
    await pg.exec(
      `INSERT INTO "RuntimeDiagnosticEvent" ("eventId","occurredAt",instance,boot,service,event,"processSequence",payload) VALUES ('00000000-0000-4000-8000-000000000001',now(),'00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','backend','sample',1,'{}')`,
    );
    await pg.exec(
      await migration('migrations/20261102043000_retire_runtime_diagnostics/migration.sql'),
    );
    expect(
      (await pg.query('SELECT count(*)::int AS n FROM "RuntimeDiagnosticEvent"')).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (await pg.query("SELECT public.append_runtime_diagnostics('[{}]'::jsonb) AS n")).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (
        await pg.query(
          "SELECT has_function_privilege('service_role','public.append_runtime_diagnostics(jsonb)','execute') AS ok",
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    await pg.exec(
      await migration('deferred-migrations/20261102043100_drop_runtime_diagnostics/migration.sql'),
    );
    expect(
      (await pg.query(`SELECT to_regclass('public."RuntimeDiagnosticEvent"') IS NULL AS removed`))
        .rows,
    ).toEqual([{ removed: true }]);
    expect((await pg.query('SELECT * FROM business_data')).rows).toEqual([{ id: 7 }]);
  } finally {
    await pg.close();
  }
}, 30000);
