import type { RequestEvent } from '@sveltejs/kit';
import { apiJson } from './api.js';

export interface NotificationsPayload {
  alerts: {
    stockAged: number;
    tasksDueOrOverdue: number;
    remindersToday: number;
    /** DRAFT vehicles awaiting a price. */
    draftVehicles: number;
  };
  contacts?: {
    unread: number;
    items: Array<{ id: string; name: string; subject: string; createdAt: string; read: boolean }>;
  };
  total: number;
  recent: Array<{
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    message: string;
    createdAt: string;
    actor: { id: string; name: string } | null;
  }>;
}

type Ev = Pick<RequestEvent, 'locals' | 'fetch'>;

export const notificationsApi = {
  get(event: Ev): Promise<NotificationsPayload> {
    return apiJson<NotificationsPayload>(event, '/api/notifications');
  },
};
