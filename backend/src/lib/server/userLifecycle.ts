import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { cache } from '../data/cache.js';
import { lockTaskBoard } from './taskBoardOrder.js';
import {
  lockClerkIdentity,
  userIdentitySelect,
  userLifecycleAvailable,
  UserLifecycleMigrationRequired,
} from './userLifecycleSchema.js';

type Profile = { email: string; name: string; imageUrl: string | null };
function invalidateUserViews() {
  cache.invalidate('users:list');
  cache.clearPrefix('dashboard:');
  cache.clearPrefix('notifications:');
}

export class UserDeactivated extends Error {
  readonly status = 403;
  constructor() {
    super('Perfil desativado.');
  }
}

/** Each permission read is fresh. Never reuse a settled/in-flight auth decision. */
export async function readLocalUser(clerkId: string) {
  const ready = await userLifecycleAvailable();
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { ...userIdentitySelect, ...(ready ? { deactivatedAt: true } : {}) },
  });
  if (ready && !user && (await prisma.clerkUserDeletion.findUnique({ where: { clerkId } })))
    throw new UserDeactivated();
  return user;
}

/** Serialize webhook sync and first-access provisioning with deletion. */
export async function syncLocalUser(clerkId: string, profile: Profile, updateExisting = true) {
  const user = await prisma.$transaction(async (tx) => {
    await lockClerkIdentity(tx, clerkId);
    const ready = await userLifecycleAvailable(tx);
    if (ready && (await tx.clerkUserDeletion.findUnique({ where: { clerkId } }))) return null;
    const current = await tx.user.findUnique({
      where: { clerkId },
      select: { ...userIdentitySelect, ...(ready ? { deactivatedAt: true } : {}) },
    });
    if (current?.deactivatedAt) return null;
    return tx.user.upsert({
      where: { clerkId },
      update: updateExisting ? profile : {},
      create: { clerkId, ...profile, role: 'ADMIN' },
      select: { ...userIdentitySelect, ...(ready ? { deactivatedAt: true } : {}) },
    });
  });
  if (user) invalidateUserViews();
  return user;
}

/** No profile/task/history is deleted. Pending work becomes shared/reassignable. */
export async function deactivateLocalUser(clerkId: string) {
  if (!(await userLifecycleAvailable())) throw new UserLifecycleMigrationRequired();
  const result = await prisma.$transaction(async (tx) => {
    // Same order as task assignment: board first, then identity.
    await lockTaskBoard(tx);
    await lockClerkIdentity(tx, clerkId);
    const marker = await tx.clerkUserDeletion.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId },
    });
    const user = await tx.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return { released: 0 };
    await tx.user.updateMany({
      where: { id: user.id, deactivatedAt: null },
      data: { deactivatedAt: marker.deletedAt },
    });
    const tasks = await tx.task.findMany({
      where: { assigneeId: user.id, status: { not: 'DONE' } },
      select: { id: true, title: true },
    });
    await tx.task.updateMany({
      where: { assigneeId: user.id, status: { not: 'DONE' } },
      data: { assigneeId: null, boardVersion: { increment: 1 } },
    });
    if (tasks.length)
      await tx.activityLog.createMany({
        data: tasks.map((task) => ({
          actorId: null,
          type: 'TASK_STATUS_CHANGED' as const,
          entityType: 'task',
          entityId: task.id,
          message: `Tarefa devolvida a Geral: ${task.title}`,
          metadata: { reason: 'assignee-deactivated', previousAssigneeId: user.id },
        })),
      });
    return { released: tasks.length };
  });
  invalidateUserViews();
  return result;
}

/** Called only while holding the shared board lock, which deletion also uses. */
export async function activeAssignee(tx: Prisma.TransactionClient, id: string) {
  const ready = await userLifecycleAvailable(tx);
  return tx.user.findFirst({
    where: { id, ...(ready ? { deactivatedAt: null } : {}) },
    select: { id: true },
  });
}

/** Best-effort avatar refresh must not mutate a terminal profile. */
export async function backfillLocalAvatar(clerkId: string, imageUrl: string) {
  await prisma.$transaction(async (tx) => {
    await lockClerkIdentity(tx, clerkId);
    const ready = await userLifecycleAvailable(tx);
    if (ready && (await tx.clerkUserDeletion.findUnique({ where: { clerkId } }))) return;
    await tx.user.updateMany({
      where: { clerkId, ...(ready ? { deactivatedAt: null } : {}) },
      data: { imageUrl },
    });
  });
}
