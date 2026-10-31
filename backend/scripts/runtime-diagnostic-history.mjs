// Read only. Connects to the configured remote DB; never starts the application or writes files.
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { sanitizeDiagnostic } from '../../shared/diagnosticEvents.mjs';
const db = new PrismaClient({ log: [] });
try {
  const args = Object.fromEntries(
    process.argv.slice(2).map((s) => {
      const [k, ...v] = s.replace(/^--/, '').split('=');
      return [k, v.join('=') || 'true'];
    }),
  );
  if (Object.keys(args).some((k) => !['from', 'to', 'instance', 'trace', 'events'].includes(k)))
    throw Error('invalid_arguments');
  const to = new Date(args.to ?? Date.now()),
    from = new Date(args.from ?? to.getTime() - 3600000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to ||
    to - from > 7 * 86400000
  )
    throw Error('invalid_interval');
  const filters = [Prisma.sql`"occurredAt">=${from}`, Prisma.sql`"occurredAt"<=${to}`];
  for (const key of ['instance', 'trace'])
    if (args[key]) {
      if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(args[key]))
        throw Error('invalid_filter');
      filters.push(Prisma.sql`${Prisma.raw('"' + key + '"')}=${args[key]}::uuid`);
    }
  const query = async (sql) =>
    db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout='5000'`;
        return tx.$queryRaw(sql);
      },
      { timeout: 10000 },
    );
  const summary = await query(
    Prisma.sql`SELECT count(*)::int AS count,coalesce(max("id"),0)::text AS watermark,min("occurredAt") AS first,max("occurredAt") AS last FROM "RuntimeDiagnosticEvent" WHERE ${Prisma.join(filters, ' AND ')}`,
  );
  const groups = await query(
    Prisma.sql`SELECT "service","event","kind",count(*)::int AS count FROM "RuntimeDiagnosticEvent" WHERE ${Prisma.join(filters, ' AND ')} GROUP BY "service","event","kind" ORDER BY "service","event","kind"`,
  );
  console.log(
    JSON.stringify({
      type: 'summary',
      from: from.toISOString(),
      to: to.toISOString(),
      ...summary[0],
      groups,
    }),
  );
  if (args.events === 'true') {
    let cursor = 0n;
    const end = BigInt(summary[0].watermark);
    while (cursor < end) {
      const rows = await query(
        Prisma.sql`SELECT "id"::text,"receivedAt","payload" FROM "RuntimeDiagnosticEvent" WHERE ${Prisma.join(filters, ' AND ')} AND "id">${cursor} AND "id"<=${end} ORDER BY "id" ASC LIMIT 100`,
      );
      if (!rows.length) break;
      for (const row of rows) {
        const payload = sanitizeDiagnostic(row.payload);
        if (payload)
          console.log(JSON.stringify({ id: row.id, receivedAt: row.receivedAt, payload }));
      }
      cursor = BigInt(rows.at(-1).id);
    }
  }
} catch {
  console.error(
    'Diagnostic history unavailable or invalid query; no application data was modified.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
