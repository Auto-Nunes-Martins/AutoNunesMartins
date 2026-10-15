import { describe, expect, it, vi } from 'vitest';
vi.mock('./appSettings.js', () => ({ appSettings: { stockAgingDays: vi.fn() } }));
import { buildVehicleWhere } from './vehicle.js';
import { buildTaskWhere, taskAttentionWhere } from './task.js';

describe('dashboard attention filters', () => {
  const now = new Date(2026, 9, 15, 14, 30);
  it('uses the configured stock age and limits the result to available stock', () => {
    expect(buildVehicleWhere({ agedStock: true, q: 'BMW' }, now, 45)).toMatchObject({
      status: { not: 'RETURNED' },
      AND: [
        { status: 'AVAILABLE' },
        { acquisitionDate: { lt: new Date(now.getTime() - 45 * 86_400_000) } },
      ],
      OR: expect.arrayContaining([{ brand: { contains: 'BMW', mode: 'insensitive' } }]),
    });
  });
  it('does not add an age cutoff to ordinary stock lists', () => {
    expect(buildVehicleWhere({}, now)).not.toHaveProperty('AND');
  });
  it('includes every unfinished task due through the end of today', () => {
    expect(taskAttentionWhere('due', now)).toEqual({
      status: { not: 'DONE' },
      dueDate: { lte: new Date(2026, 9, 15, 23, 59, 59, 999) },
    });
  });
  it('selects reminders for today independently of their due date', () => {
    expect(taskAttentionWhere('reminders', now)).toEqual({
      status: { not: 'DONE' },
      reminderDate: { gte: new Date(2026, 9, 15), lte: new Date(2026, 9, 15, 23, 59, 59, 999) },
    });
  });
  it('retains the requesting user visibility restriction when filtering reminders', () => {
    const where = buildTaskWhere({ attention: 'reminders', actorId: 'admin-a', q: 'seguro' });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { OR: [{ assigneeId: null }, { assigneeId: 'admin-a' }] },
        expect.objectContaining({ status: { not: 'DONE' }, reminderDate: expect.any(Object) }),
        expect.objectContaining({
          OR: expect.arrayContaining([{ title: { contains: 'seguro', mode: 'insensitive' } }]),
        }),
      ]),
    );
  });
});
