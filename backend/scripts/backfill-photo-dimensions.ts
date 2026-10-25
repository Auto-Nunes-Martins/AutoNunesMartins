/** Defaults to inspection. --apply writes derived dimensions only, never photos/publication. */
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('tsx --env-file=.env scripts/backfill-photo-dimensions.ts [--dry-run|--apply] [--include-private] [--limit=100] [--batch-size=25] [--concurrency=2] [--after=vehicle-id]');
  console.log('At most 1000 vehicles, 50 per DB batch, four sidecar reads at once. Default is dry-run. --apply requires the additive migration. Output contains counts and a resume cursor, not storage paths.');
  console.log('Default scope: currently approved public photos. --include-private includes other owned photos without changing publication or approval.');
} else {
  for (const arg of args) if (!/^(?:--apply|--dry-run|--include-private|--(?:limit|batch-size|concurrency)=\d+|--after=[a-zA-Z0-9_-]+)$/.test(arg)) throw Error('Unknown argument; use --help');
  if (args.includes('--apply') && args.includes('--dry-run')) throw Error('Choose --apply or --dry-run');
  const number = (name: string, fallback: number) => Number(args.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
  const { PrismaClient } = await import('@prisma/client');
  const { backfillPhotoDimensions } = await import('../src/lib/server/backfillPhotoDimensions.js');
  const { readVariantManifest } = await import('../src/lib/server/photoVariants.js');
  const db = new PrismaClient();
  try {
    const result = await backfillPhotoDimensions(db, readVariantManifest, {
      apply: args.includes('--apply'), limit: number('limit', 100), batchSize: number('batch-size', 25),
      concurrency: number('concurrency', 2), after: args.find(arg => arg.startsWith('--after='))?.slice(8), includePrivate: args.includes('--include-private'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.failed) process.exitCode = 1;
  } catch {
    console.error('Backfill failed. Verify environment, limits and migration before retrying; no original images are modified.');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
export {};
