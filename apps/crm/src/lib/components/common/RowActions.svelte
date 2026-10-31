<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { MoreHorizontal, Pencil } from 'lucide-svelte';
  import type { IconComponent } from '$lib/types/ui';

  interface Props {
    label: string;
    editHref: string;
    actions: {
      label: string;
      href?: string;
      icon: IconComponent;
      onselect?: (trigger: HTMLButtonElement | null) => void;
      danger?: boolean;
      disabled?: boolean;
      title?: string;
    }[];
  }
  let { label, editHref, actions }: Props = $props();
  const menuId = $props.id();
  let trigger = $state<HTMLButtonElement | null>(null);
  let menu = $state<HTMLDivElement | null>(null);
  let open = $state(false);
  let left = $state(0);
  let top = $state(0);

  function close() {
    if (open && menu?.matches(':popover-open')) menu.hidePopover();
  }
  async function onToggle(event: ToggleEvent) {
    open = event.newState === 'open';
    if (!open || !trigger || !menu) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    left = Math.max(12, Math.min(innerWidth - bounds.width - 12, anchor.right - bounds.width));
    top =
      anchor.bottom + 6 + bounds.height <= innerHeight - 12
        ? anchor.bottom + 6
        : Math.max(12, anchor.top - bounds.height - 6);
    await tick();
    if (menu.matches(':popover-open'))
      menu
        .querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
        ?.focus({ preventScroll: true });
  }
  function onMenuKey(event: KeyboardEvent) {
    if (!menu) return;
    if (event.key === 'Tab') {
      close();
      return;
    }
    const links = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    if (!links.length) return;
    const index = links.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % links.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + links.length) % links.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = links.length - 1;
    else return;
    event.preventDefault();
    links[next]?.focus();
  }
  onMount(() => {
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !menu?.contains(event.target)) close();
    };
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  });
</script>

<div class="row-actions">
  <a href={editHref} class="edit-link" aria-label={`Editar ${label}`}
    ><Pencil class="h-3.5 w-3.5" />Editar</a
  >
  {#if actions.length > 0}
    <button
      bind:this={trigger}
      type="button"
      class="more-button"
      popovertarget={menuId}
      aria-label={`Mais opções de ${label}`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onkeydown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          menu?.showPopover();
        }
      }}
    >
      <MoreHorizontal class="h-4 w-4" />
    </button>
    <div
      bind:this={menu}
      id={menuId}
      popover="auto"
      role="menu"
      tabindex="-1"
      aria-label={`Ações de ${label}`}
      class="action-menu"
      style={`left: ${left}px; top: ${top}px; visibility: ${open ? 'visible' : 'hidden'};`}
      ontoggle={onToggle}
      onkeydown={onMenuKey}
    >
      {#each actions as action (action.href ?? action.label)}
        {#if action.href}<a href={action.href} role="menuitem" onclick={close}
            ><action.icon class="h-4 w-4" />{action.label}</a
          >{:else}<button
            type="button"
            role="menuitem"
            class:danger={action.danger}
            disabled={action.disabled}
            title={action.title}
            onclick={() => {
              close();
              action.onselect?.(trigger);
            }}><action.icon class="h-4 w-4" />{action.label}</button
          >{/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    white-space: nowrap;
  }
  .edit-link,
  .more-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    background: var(--color-bg-1);
    color: var(--color-text-muted);
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
  }
  .edit-link {
    padding: 0 11px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .more-button {
    width: 36px;
    cursor: pointer;
  }
  .edit-link:hover,
  .more-button:hover,
  .more-button[aria-expanded='true'] {
    color: var(--color-red);
    border-color: color-mix(in oklab, var(--color-red) 45%, var(--color-border));
    background: color-mix(in oklab, var(--color-red) 5%, var(--color-bg-1));
  }
  .edit-link:focus-visible,
  .more-button:focus-visible,
  .action-menu :is(a, button):focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 2px;
  }
  .action-menu {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 5px;
    width: 210px;
    max-width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    color: var(--color-text);
    background: var(--color-bg-1);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-card);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  }
  :global([data-theme='light']) .action-menu {
    background: var(--color-bg-elevated);
    box-shadow: var(--shadow-floating);
  }
  .action-menu :is(a, button) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 8px 10px;
    font-size: 13px;
    border-radius: var(--radius-btn);
    text-align: left;
    width: 100%;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .action-menu :is(a, button):hover:not(:disabled),
  .action-menu :is(a, button):focus-visible {
    color: var(--color-red);
    background: color-mix(in oklab, var(--color-red) 6%, transparent);
  }
  .action-menu button.danger {
    color: var(--color-danger, var(--color-red));
  }
  .action-menu button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  @media (pointer: coarse) {
    .edit-link,
    .more-button {
      height: 44px;
    }
    .more-button {
      width: 44px;
    }
    .action-menu :is(a, button) {
      min-height: 44px;
    }
  }
</style>
