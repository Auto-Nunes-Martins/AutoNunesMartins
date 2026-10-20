<script lang="ts">
  import type { VehicleStatus, Priority, DeliveryStatus } from '@anm/types';
  import { taskPriority } from '$lib/components/task/presentation';

  type StatusKind = VehicleStatus | Priority | DeliveryStatus;

  interface Props {
    status: StatusKind;
    label?: string;
  }

  let { status, label }: Props = $props();

  const VEHICLE_LABELS: Record<VehicleStatus, string> = {
    AVAILABLE: 'Disponível',
    RESERVED: 'Reservado',
    SOLD: 'Vendido',
    DELIVERED: 'Entregue',
    DOCS_PENDING: 'Docs Pendentes',
    DRAFT: 'Rascunho',
    RETURNED: 'Devolvida ao cliente',
  };

  const PRIORITY_LABELS: Record<Priority, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  };

  const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    DELIVERED: 'Entregue',
  };

  const STYLES: Record<VehicleStatus | DeliveryStatus, { bg: string; fg: string }> = {
    AVAILABLE: {
      bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
      fg: 'var(--color-success)',
    },
    RESERVED: {
      bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
      fg: 'var(--color-warning)',
    },
    SOLD: {
      bg: 'color-mix(in srgb, var(--color-text-muted) 22%, transparent)',
      fg: 'var(--color-text)',
    },
    DELIVERED: {
      bg: 'color-mix(in srgb, var(--color-info) 12%, transparent)',
      fg: 'var(--color-info)',
    },
    DOCS_PENDING: {
      bg: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
      fg: 'var(--color-danger)',
    },
    DRAFT: {
      bg: 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)',
      fg: 'var(--color-text-muted)',
    },
    RETURNED: {
      bg: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
      fg: 'var(--color-text-muted)',
    },
    PENDING: {
      bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
      fg: 'var(--color-warning)',
    },
    SCHEDULED: {
      bg: 'color-mix(in srgb, var(--color-info) 12%, transparent)',
      fg: 'var(--color-info)',
    },
  };

  function resolveLabel(s: StatusKind): string {
    if (s in VEHICLE_LABELS) return VEHICLE_LABELS[s as VehicleStatus];
    if (s in PRIORITY_LABELS) return PRIORITY_LABELS[s as Priority];
    if (s in DELIVERY_LABELS) return DELIVERY_LABELS[s as DeliveryStatus];
    return s;
  }

  const priorityStyle = $derived(status in PRIORITY_LABELS ? taskPriority(status) : null);
  const style = $derived(
    priorityStyle
      ? {
          bg: `color-mix(in srgb, ${priorityStyle.color} 12%, transparent)`,
          fg: priorityStyle.color,
        }
      : STYLES[status as VehicleStatus | DeliveryStatus],
  );
  const displayLabel = $derived(label ?? resolveLabel(status));
</script>

<span
  class="inline-flex items-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1"
  style="background: {style.bg}; color: {style.fg}; border: 1px solid color-mix(in srgb, {style.fg} 35%, transparent); border-radius: 3px;"
>
  {displayLabel}
</span>
