import { randomUUID, createHash } from 'node:crypto';

export const PHOTO_UPLOAD_LEASE_MS = 15 * 60_000;
export const PHOTO_DRAFT_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const PHOTO_DISCARD_GRACE_MS = 10 * 60_000;
export interface PhotoConnection {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
}
export interface PhotoDatabase extends PhotoConnection {
  transaction<T>(work: (tx: PhotoConnection) => Promise<T>): Promise<T>;
}
type Owner = { id: string; createdAt: Date; photos: string[]; publicPhotoPaths: string[] };
type Job = {
  path: string;
  vehicleId: string;
  vehicleCreatedAt: Date;
  state: string;
  token: string | null;
  expiresAt: Date;
  nextAttemptAt: Date;
  attempts: number;
  reason: string | null;
};
export class PhotoLifecycleError extends Error {
  readonly field = 'photos';
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function validatePhotoOwner(vehicleId: string, paths: string[]) {
  if (
    !/^[a-zA-Z0-9_-]+$/.test(vehicleId) ||
    paths.length > 20 ||
    new Set(paths).size !== paths.length ||
    paths.some(
      (p) =>
        p.length > 160 ||
        !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(p) ||
        !p.startsWith(vehicleId + '/'),
    )
  )
    throw new PhotoLifecycleError('Fotografia preparada inválida.');
}
export function createPhotoLifecycle(options: {
  db: PhotoDatabase;
  remove: (paths: string[]) => Promise<void>;
  now?: () => Date;
  report?: () => void;
}) {
  const { db, remove } = options,
    now = options.now ?? (() => new Date());
  const report = options.report ?? (() => {});
  const future = (ms: number) => new Date(now().getTime() + ms);
  async function owner(tx: PhotoConnection, id: string) {
    return (
      await tx.query<Owner>(
        'SELECT id,"createdAt",photos,"publicPhotoPaths" FROM "Vehicle" WHERE id=$1 FOR UPDATE',
        [id],
      )
    )[0];
  }
  async function job(tx: PhotoConnection, path: string) {
    return (
      await tx.query<Job>('SELECT * FROM "VehiclePhotoJob" WHERE path=$1 FOR UPDATE', [path])
    )[0];
  }
  const referenced = (v: Owner | undefined, path: string) =>
    !!v && (v.photos.includes(path) || v.publicPhotoPaths.includes(path));
  function checkGeneration(v: Owner, j: Job | undefined) {
    if (j && new Date(j.vehicleCreatedAt).getTime() !== new Date(v.createdAt).getTime())
      throw new PhotoLifecycleError(
        'A viatura foi restaurada entretanto. Volte a selecionar a fotografia.',
      );
  }
  async function put(
    tx: PhotoConnection,
    v: Owner,
    path: string,
    state: string,
    expires: Date,
    token: string | null,
    reason: string | null,
  ) {
    await tx.query(
      `INSERT INTO "VehiclePhotoJob" (path,"vehicleId","vehicleCreatedAt",state,token,"expiresAt","nextAttemptAt",reason)
      VALUES ($1,$2,$3::timestamptz,$4,$5::uuid,$6::timestamptz,$6::timestamptz,$7) ON CONFLICT(path) DO UPDATE SET state=EXCLUDED.state,token=EXCLUDED.token,
      "expiresAt"=EXCLUDED."expiresAt","nextAttemptAt"=EXCLUDED."nextAttemptAt",reason=EXCLUDED.reason,"updatedAt"=CURRENT_TIMESTAMP RETURNING path`,
      [path, v.id, v.createdAt, state, token, expires, reason],
    );
  }
  async function capacity(tx: PhotoConnection, id: string, exists: boolean) {
    if (
      !exists &&
      Number(
        (
          await tx.query<{ n: number }>(
            'SELECT count(*)::int AS n FROM "VehiclePhotoJob" WHERE "vehicleId"=$1',
            [id],
          )
        )[0]?.n,
      ) >= 100
    )
      throw new PhotoLifecycleError(
        'Existem demasiadas fotografias por guardar. Conclua ou descarte os rascunhos anteriores.',
        429,
      );
  }
  async function beginUpload(id: string, path: string) {
    validatePhotoOwner(id, [path]);
    return db.transaction(async (tx) => {
      const v = await owner(tx, id);
      if (!v) throw new PhotoLifecycleError('Viatura não encontrada.', 404);
      if (referenced(v, path))
        throw new PhotoLifecycleError('A fotografia já foi guardada. Atualize a galeria.');
      const existing = await job(tx, path);
      checkGeneration(v, existing);
      if (existing?.state === 'UPLOADING' && new Date(existing.expiresAt) > now())
        throw new PhotoLifecycleError(
          'Esta fotografia ainda está a ser enviada. Tente novamente.',
          429,
        );
      await capacity(tx, id, !!existing);
      const token = randomUUID();
      await put(tx, v, path, 'UPLOADING', future(PHOTO_UPLOAD_LEASE_MS), token, null);
      return { path, token };
    });
  }
  async function checkUpload(path: string, token: string) {
    const result = await db.query(
      `UPDATE "VehiclePhotoJob" SET "expiresAt"=$3,"nextAttemptAt"=$3,"updatedAt"=CURRENT_TIMESTAMP
      WHERE path=$1 AND token=$2::uuid AND state='UPLOADING' AND "expiresAt">$4::timestamptz RETURNING path`,
      [path, token, future(PHOTO_UPLOAD_LEASE_MS), now()],
    );
    if (!result.length)
      throw new PhotoLifecycleError('O envio expirou ou foi cancelado. Tente novamente.');
  }
  async function finishUpload(path: string, token: string) {
    const result = await db.query(
      `UPDATE "VehiclePhotoJob" SET state='STAGED',"expiresAt"=$3,"nextAttemptAt"=$3,"updatedAt"=CURRENT_TIMESTAMP
      WHERE path=$1 AND token=$2::uuid AND state='UPLOADING' AND "expiresAt">$4::timestamptz RETURNING path`,
      [path, token, future(PHOTO_DRAFT_RETENTION_MS), now()],
    );
    if (!result.length) throw new PhotoLifecycleError('O envio expirou. Tente novamente.');
  }
  async function failUpload(path: string, token: string) {
    await db.query(
      `UPDATE "VehiclePhotoJob" SET state='DELETE_PENDING',reason='failed_upload',"expiresAt"=$3,"nextAttemptAt"=$3,"updatedAt"=CURRENT_TIMESTAMP
      WHERE path=$1 AND token=$2::uuid RETURNING path`,
      [path, token, now()],
    );
  }
  async function retain(id: string, paths: string[]) {
    validatePhotoOwner(id, paths);
    if (!paths.length) return { adopted: [] as string[] };
    return db.transaction(async (tx) => {
      const v = await owner(tx, id);
      if (!v) throw new PhotoLifecycleError('Viatura não encontrada.', 404);
      const adopted: string[] = [];
      for (const path of paths) {
        const existing = await job(tx, path);
        checkGeneration(v, existing);
        if (referenced(v, path)) {
          await tx.query('DELETE FROM "VehiclePhotoJob" WHERE path=$1 RETURNING path', [path]);
          continue;
        }
        if (existing?.state === 'UPLOADING' && new Date(existing.expiresAt) > now())
          throw new PhotoLifecycleError('A fotografia ainda está a ser enviada.');
        if (existing?.reason === 'revoked')
          throw new PhotoLifecycleError(
            'A fotografia foi retirada da galeria. Volte a selecioná-la.',
          );
        await capacity(tx, id, !!existing);
        if (!existing) adopted.push(path);
        await put(tx, v, path, 'STAGED', future(PHOTO_DRAFT_RETENTION_MS), null, null);
      }
      return { adopted };
    });
  }
  async function assertStaged(tx: PhotoConnection, id: string, paths: string[]) {
    validatePhotoOwner(id, paths);
    if (!paths.length) return;
    const v = await owner(tx, id);
    if (!v) throw new PhotoLifecycleError('Viatura não encontrada.', 404);
    for (const path of paths) {
      if (referenced(v, path)) continue;
      const existing = await job(tx, path);
      checkGeneration(v, existing);
      if (!existing || existing.state !== 'STAGED' || new Date(existing.expiresAt) <= now())
        throw new PhotoLifecycleError(
          'Uma fotografia preparada expirou. Volte a enviá-la antes de guardar.',
        );
    }
  }
  async function attached(tx: PhotoConnection, paths: string[]) {
    for (const path of paths)
      await tx.query('DELETE FROM "VehiclePhotoJob" WHERE path=$1 RETURNING path', [path]);
  }
  async function queueRemoved(tx: PhotoConnection, id: string, paths: string[]) {
    validatePhotoOwner(id, paths);
    if (!paths.length) return;
    const v = await owner(tx, id);
    if (!v) throw new PhotoLifecycleError('Viatura não encontrada.', 404);
    for (const path of paths) {
      if (referenced(v, path))
        throw new PhotoLifecycleError('A fotografia continua em utilização.');
      await put(tx, v, path, 'DELETE_PENDING', now(), null, 'revoked');
    }
  }
  async function discard(id: string, paths: string[]) {
    validatePhotoOwner(id, paths);
    if (!paths.length) return;
    await db.transaction(async (tx) => {
      const v = await owner(tx, id);
      if (!v) return; // Whole-vehicle cleanup already owns the namespace.
      for (const path of paths) {
        if (referenced(v, path)) continue;
        const existing = await job(tx, path);
        checkGeneration(v, existing);
        if (existing?.state === 'UPLOADING' && new Date(existing.expiresAt) > now()) continue;
        if (existing?.reason === 'revoked') continue;
        await capacity(tx, id, !!existing);
        await put(tx, v, path, 'DELETE_PENDING', future(PHOTO_DISCARD_GRACE_MS), null, 'abandoned');
      }
    });
  }
  async function process(path: string) {
    try {
      return await db.transaction(async (tx) => {
        const hint = (
          await tx.query<Job>('SELECT * FROM "VehiclePhotoJob" WHERE path=$1', [path])
        )[0];
        if (!hint) return true;
        const v = await owner(tx, hint.vehicleId),
          current = await job(tx, path);
        if (
          !current ||
          new Date(current.nextAttemptAt) > now() ||
          new Date(current.expiresAt) > now()
        )
          return false;
        validatePhotoOwner(current.vehicleId, [path]);
        const live = await tx.query(
          'SELECT id FROM "Vehicle" WHERE $1=ANY(photos) OR $1=ANY("publicPhotoPaths") LIMIT 1',
          [path],
        );
        if (live.length) {
          await attached(tx, [path]);
          return true;
        }
        const wholeDeletion = await tx.query(
          'SELECT "vehicleId" FROM "VehiclePhotoCleanup" WHERE "vehicleId"=$1',
          [current.vehicleId],
        );
        if (
          v &&
          (wholeDeletion.length ||
            new Date(v.createdAt).getTime() !== new Date(current.vehicleCreatedAt).getTime())
        ) {
          await tx.query(
            'UPDATE "VehiclePhotoJob" SET "nextAttemptAt"=$2 WHERE path=$1 RETURNING path',
            [path, future(3_600_000)],
          );
          return false; // Preserve a restored vehicle exactly like whole-vehicle cleanup.
        }
        // Keep the owner/job locks until bounded Storage removal completes. Attach/renew
        // takes the same locks and cannot commit a reference after validation races deletion.
        await remove([path]);
        await tx.query('DELETE FROM "VehiclePhotoDimensions" WHERE version=$1 RETURNING version', [
          createHash('sha256').update(path).digest('hex'),
        ]);
        await attached(tx, [path]);
        return true;
      });
    } catch {
      try {
        await db.query(
          `UPDATE "VehiclePhotoJob" SET attempts=attempts+1,"nextAttemptAt"=greatest("expiresAt",$2::timestamptz +
          (least(3600,30*power(2,least(attempts,7)))::text || ' seconds')::interval) WHERE path=$1 RETURNING path`,
          [path, now()],
        );
      } catch {
        /* The original durable job remains; restart will retry. */
      }
      report();
      return false;
    }
  }
  async function sweep(stopped: () => boolean = () => false) {
    const due = await db.query<{ path: string }>(
      'SELECT path FROM "VehiclePhotoJob" WHERE "nextAttemptAt"<=$1 ORDER BY "nextAttemptAt",path LIMIT 5',
      [now()],
    );
    for (const { path } of due) {
      if (stopped()) break;
      await process(path);
    }
  }
  return {
    beginUpload,
    checkUpload,
    finishUpload,
    failUpload,
    retain,
    assertStaged,
    attached,
    queueRemoved,
    discard,
    process,
    sweep,
  };
}
