import {
  Activity,
  Mail,
  ArrowRightLeft,
  Car,
  CheckCircle2,
  CircleDollarSign,
  ListPlus,
  PencilLine,
  Receipt,
  Trash2,
  UserCog,
  UserPlus,
  Wallet,
} from 'lucide-svelte';
import type { IconComponent } from '$lib/types/ui';

type EventStyle = { icon: IconComponent; color: string; label: string };
const info = 'var(--color-info)';
const success = 'var(--color-success)';
const neutral = 'var(--color-text-muted)';
const danger = 'var(--color-danger)';

/** One meaning per colour across history, dashboard and notifications.
 * Icons and explicit labels identify the entity, without a separate rainbow. */
const events: Record<string, EventStyle> = {
  CONTACT_REQUEST_RECEIVED: { icon: Mail, color: info, label: 'Contacto do website' },
  VEHICLE_ADDED: { icon: Car, color: info, label: 'Viatura adicionada' },
  VEHICLE_UPDATED: { icon: PencilLine, color: neutral, label: 'Viatura editada' },
  VEHICLE_STATUS_CHANGED: { icon: ArrowRightLeft, color: info, label: 'Estado de viatura' },
  VEHICLE_DELETED: { icon: Trash2, color: danger, label: 'Viatura eliminada' },
  SALE_CREATED: { icon: Receipt, color: success, label: 'Venda registada' },
  SALE_UPDATED: { icon: PencilLine, color: neutral, label: 'Venda editada' },
  SALE_CANCELLED: { icon: ArrowRightLeft, color: 'var(--color-warning)', label: 'Venda anulada' },
  TRADE_IN_RECEIVED: { icon: ArrowRightLeft, color: info, label: 'Retoma recebida' },
  CUSTOMER_ADDED: { icon: UserPlus, color: info, label: 'Cliente adicionado' },
  CUSTOMER_UPDATED: { icon: UserCog, color: neutral, label: 'Cliente editado' },
  TASK_CREATED: { icon: ListPlus, color: info, label: 'Tarefa criada' },
  TASK_STATUS_CHANGED: { icon: ArrowRightLeft, color: info, label: 'Tarefa atualizada' },
  TASK_COMPLETED: { icon: CheckCircle2, color: success, label: 'Tarefa concluída' },
  EXPENSE_ADDED: { icon: Wallet, color: neutral, label: 'Despesa registada' },
  EXPENSE_UPDATED: { icon: CircleDollarSign, color: neutral, label: 'Despesa editada' },
};

export function activityStyle(type: string): EventStyle {
  return events[type] ?? { icon: Activity, color: neutral, label: type };
}
