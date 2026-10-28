<script lang="ts">
  import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props = Omit<HTMLInputAttributes, 'type' | 'value'> & { value?: string | null };
  let { value = $bindable(''), ...props }: Props = $props();
  let input: HTMLInputElement;
  let panel: HTMLDivElement;
  let open = $state(false);
  let month = $state(new Date().getMonth());
  let year = $state(new Date().getFullYear());
  let left = $state(0);
  let top = $state(0);
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const uid = $props.id();
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
  const iso = (y: number, m: number, day: number) =>
    `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const today = () => {
    const now = new Date();
    return iso(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const days = $derived(
    Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1),
  );
  const offset = $derived((new Date(year, month, 1).getDay() + 6) % 7);
  const minYear = $derived(props.min ? Number(String(props.min).slice(0, 4)) : 1900);
  const maxYear = $derived(props.max ? Number(String(props.max).slice(0, 4)) : 2100);
  const years = $derived(
    Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, i) => minYear + i),
  );
  function allowed(date: string) {
    if (props.min && date < String(props.min)) return false;
    if (props.max && date > String(props.max)) return false;
    if (props.step && props.step !== 'any') {
      const step = Number(props.step);
      const difference =
        (Date.parse(date) - Date.parse(String(props.min || '1970-01-01'))) / 86400000;
      if (step > 0 && Math.abs(difference / step - Math.round(difference / step)) > 0.000001)
        return false;
    }
    return true;
  }
  function close() {
    panel?.hidePopover();
  }
  function choose(date: string) {
    if (date && !allowed(date)) return;
    input.value = date;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    input.focus();
  }
  function shift(amount: number) {
    const date = new Date(year, month + amount, 1);
    year = date.getFullYear();
    month = date.getMonth();
  }
  function positionPanel() {
    const rect = input.getBoundingClientRect();
    left = Math.max(12, Math.min(rect.left, innerWidth - 300));
    const height = panel.getBoundingClientRect().height;
    top = Math.max(12, Math.min(rect.bottom + 8, innerHeight - height - 12));
  }
  function show() {
    if (props.disabled || props.readonly) return;
    if (open) {
      close();
      return;
    }
    const selected = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : today();
    year = Number(selected.slice(0, 4));
    month = Number(selected.slice(5, 7)) - 1;
    panel.showPopover();
    positionPanel();
    requestAnimationFrame(() =>
      (
        panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ||
        panel.querySelector<HTMLButtonElement>('.date-day:not(:disabled)')
      )?.focus(),
    );
  }
  function navigate(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      input.focus();
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.day) return;
    const delta = (
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>
    )[event.key];
    if (!delta) return;
    event.preventDefault();
    const date = new Date(year, month, Number(target.dataset.day) + delta);
    year = date.getFullYear();
    month = date.getMonth();
    requestAnimationFrame(() =>
      panel.querySelector<HTMLButtonElement>(`[data-day="${date.getDate()}"]`)?.focus(),
    );
  }
</script>

<svelte:window
  onresize={close}
  onscroll={() => {
    if (open) positionPanel();
  }}
/>
<span class="crm-date-control">
  <input
    {...props}
    type="date"
    lang="pt-PT"
    bind:this={input}
    bind:value
    onkeydown={(event) => {
      props.onkeydown?.(event);
      if (!event.defaultPrevented && event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        show();
      }
    }}
  />
  <button
    type="button"
    class="date-trigger"
    aria-label="Escolher data"
    aria-controls={uid}
    aria-expanded={open}
    disabled={!!props.disabled || !!props.readonly}
    onclick={show}><CalendarDays size={17} aria-hidden="true" /></button
  >
</span>
<div
  id={uid}
  bind:this={panel}
  use:portal
  class="crm-date-popover"
  popover="auto"
  role="dialog"
  tabindex="-1"
  aria-label="Escolher data"
  style:left={`${left}px`}
  style:top={`${top}px`}
  ontoggle={(event) => (open = event.newState === 'open')}
  onkeydown={navigate}
>
  <div class="date-heading">
    <button
      type="button"
      aria-label="Mês anterior"
      disabled={year <= minYear && month === 0}
      onclick={() => shift(-1)}><ChevronLeft size={17} /></button
    >
    <select aria-label="Mês" bind:value={month}
      >{#each months as name, index}<option value={index}>{name}</option>{/each}</select
    >
    <select aria-label="Ano" bind:value={year}
      >{#each years as item}<option value={item}>{item}</option>{/each}</select
    >
    <button
      type="button"
      aria-label="Mês seguinte"
      disabled={year >= maxYear && month === 11}
      onclick={() => shift(1)}><ChevronRight size={17} /></button
    >
  </div>
  <div class="date-week" aria-hidden="true">
    {#each ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as day}<span>{day}</span>{/each}
  </div>
  <div class="date-days">
    {#each days as day}
      {@const date = iso(year, month, day)}
      <button
        type="button"
        class="date-day"
        class:today={date === today()}
        data-day={day}
        style:grid-column={day === 1 ? offset + 1 : undefined}
        aria-label={`${day} de ${months[month]} de ${year}`}
        aria-pressed={value === date}
        aria-current={date === today() ? 'date' : undefined}
        disabled={!allowed(date)}
        onclick={() => choose(date)}>{day}</button
      >
    {/each}
  </div>
  <div class="date-footer">
    <button type="button" disabled={!allowed(today())} onclick={() => choose(today())}>Hoje</button>
    {#if !props.required}<button type="button" disabled={!value} onclick={() => choose('')}
        >Limpar</button
      >{/if}
  </div>
</div>

<style>
  .crm-date-control {
    display: block;
    position: relative;
    min-width: 0;
    width: 100%;
  }
  .crm-date-control input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 44px;
    min-height: 44px;
    padding: 8px 44px 8px 12px !important;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    background: var(--color-bg-0);
    color: var(--color-text);
    font: 14px/1.5 var(--font-sans);
    letter-spacing: normal;
    text-transform: none;
    outline: none;
  }
  .crm-date-control input:focus {
    border-color: var(--color-red);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-red) 12%, transparent);
  }
  .crm-date-control input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  input::-webkit-calendar-picker-indicator {
    display: none;
  }
  .date-trigger {
    position: absolute;
    right: 4px;
    top: 4px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-btn);
    cursor: pointer;
  }
  .date-trigger:hover {
    color: var(--color-text);
    background: var(--color-interaction-hover);
  }
  .date-trigger:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .crm-date-popover {
    position: fixed;
    margin: 0;
    width: 288px;
    max-width: calc(100vw - 24px);
    padding: 12px;
    box-sizing: border-box;
    color: var(--color-text);
    background: var(--color-bg-1);
    border: 1px solid var(--color-border-strong);
    border-radius: 8px;
    box-shadow: 0 16px 48px #0004;
    font: 13px var(--font-sans);
    text-transform: none;
    letter-spacing: normal;
  }
  :global([data-theme='light']) .crm-date-popover {
    background: var(--color-bg-elevated);
    box-shadow: var(--shadow-floating);
  }
  .date-heading {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 76px 28px;
    align-items: center;
    gap: 3px;
    margin-bottom: 12px;
  }
  .date-heading button {
    display: grid;
    place-items: center;
    padding: 0;
    height: 32px;
  }
  .date-heading select {
    height: 32px !important;
    min-height: 32px !important;
    padding: 4px 3px !important;
    font-size: 12px !important;
    background: var(--color-bg-0);
    color: inherit;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }
  .date-week,
  .date-days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }
  .date-week {
    color: var(--color-text-muted);
    text-align: center;
    font-size: 10px;
    padding-bottom: 6px;
  }
  .crm-date-popover button {
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
  }
  .date-day {
    height: 34px;
    padding: 0;
  }
  .crm-date-popover button:hover {
    background: var(--color-interaction-hover);
  }
  .date-day.today {
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
  }
  .date-day[aria-pressed='true'] {
    background: var(--color-red);
    color: white;
  }
  .crm-date-popover button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .date-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--color-border);
    padding-top: 8px;
    margin-top: 10px;
  }
  .date-footer button {
    padding: 6px 10px;
    font-size: 12px;
  }
  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 2px;
  }
  @media (pointer: coarse) {
    .crm-date-control input {
      font-size: 16px;
    }
  }
</style>
