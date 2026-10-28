<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';
  import { goto } from '$app/navigation';
  import { Trash2 } from 'lucide-svelte';
  import Button from '$lib/components/common/Button.svelte';
  import AccountVerification from './AccountVerification.svelte';
  import { accountErrors, accountFailure, accountSettings, canDeleteSelf, needsReverification, verificationLevel, type AccountUser } from '$lib/account/profile';
  import { clearFormErrors, showFormErrors } from '$lib/forms/formFeedback';
  import { listNavigationCache } from '$lib/lists/navigationCache';
  import { crmPath } from '$lib/paths';
  let { disabled = false, onbusychange }: { disabled?: boolean; onbusychange?: (busy: boolean) => void } = $props();
  const ctx = useClerkContext();
  const allowed = $derived(!!ctx.user && canDeleteSelf(ctx.user, accountSettings(ctx.clerk)));
  let dialog: HTMLDialogElement; let form: HTMLFormElement; let verification: AccountVerification;
  let account = $state<AccountUser | null>(null); let identityLabel = $state('');
  let accountId = ''; let sessionId = ''; let generation = 0; let active = true;
  let phrase = $state(''); let acknowledged = $state(false); let message = $state('');
  let phase = $state<'closed' | 'confirm' | 'verifying' | 'deleting' | 'uncertain' | 'checking' | 'deleted'>('closed');
  const working = $derived(['verifying', 'deleting', 'checking'].includes(phase));
  const sameIdentity = () => !!accountId && ctx.user?.id === accountId && ctx.session?.id === sessionId;
  const stillAllowed = () => !!ctx.user && canDeleteSelf(ctx.user, accountSettings(ctx.clerk));
  function reset() { phrase = ''; acknowledged = false; account = null; accountId = ''; sessionId = ''; identityLabel = ''; }
  function cancel() {
    if (['deleting', 'checking', 'uncertain', 'deleted'].includes(phase)) return;
    generation++; verification?.cancel(); dialog?.close(); phase = 'closed'; reset(); onbusychange?.(false);
  }
  onDestroy(() => { active = false; generation++; verification?.cancel(); reset(); onbusychange?.(false); });
  $effect(() => {
    const id = ctx.user?.id, currentSession = ctx.session?.id;
    // A completed deletion clears the identity. A different identity must never
    // inherit a pending confirmation or a verification retry.
    if (account && (id !== accountId || currentSession !== sessionId) && ['confirm', 'verifying'].includes(phase)) cancel();
  });
  async function open() {
    if (disabled || !allowed || !ctx.user || !ctx.session || phase !== 'closed') return;
    generation++; account = ctx.user; accountId = ctx.user.id; sessionId = ctx.session.id;
    identityLabel = ctx.user.primaryEmailAddress?.emailAddress || ctx.user.username || ctx.user.fullName || ctx.user.id;
    phrase = ''; acknowledged = false; message = ''; phase = 'confirm'; onbusychange?.(true);
    await tick(); clearFormErrors(form); dialog.showModal();
  }
  async function goToEntry(deleted: boolean) {
    if (ctx.user && ctx.user.id !== accountId) { message = 'A conta aberta mudou. A conta atualmente aberta não foi alterada.'; return; }
    // User.delete emits Clerk's UserSignOut event. Finish only the captured
    // session if it is still active; never sign out another signed-in identity.
    if (ctx.session?.id === sessionId) {
      try { await ctx.clerk?.signOut({ sessionId }); }
      catch { message = deleted ? 'Conta eliminada. Não foi possível terminar a sessão no navegador. Abra a página de entrada.' : 'Não foi possível terminar a sessão. Abra a página de entrada para confirmar o acesso.'; return; }
    }
    listNavigationCache.clear(401);
    try { await goto(crmPath(deleted ? '/?conta=eliminada' : '/'), { replaceState: true, invalidateAll: true }); }
    catch { message = deleted ? 'Conta eliminada. Abra a página de entrada para continuar.' : 'Abra a página de entrada para confirmar o acesso.'; }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (phase !== 'confirm' || !account || !sameIdentity() || !stillAllowed()) return;
    clearFormErrors(form); const issues = [];
    if (phrase.trim() !== 'ELIMINAR') issues.push({ path: ['deleteConfirmation'], message: 'Escreva ELIMINAR para confirmar esta ação.' });
    if (!acknowledged) issues.push({ path: ['sharedAccess'], message: 'Confirme que compreende a perda de acesso nas aplicações que partilham esta conta.' });
    if (issues.length) { showFormErrors(form, { issues }); return; }
    const target = account, attempt = generation; phase = 'deleting'; message = '';
    try {
      try { await target.delete(); }
      catch (error) {
        if (!needsReverification(error)) throw error;
        phase = 'verifying'; const verified = await verification.verify(verificationLevel(error));
        if (!active || attempt !== generation) return;
        if (!verified) { phase = 'confirm'; showFormErrors(form, { error: 'Confirmação cancelada. A conta não foi eliminada.' }); return; }
        if (!sameIdentity() || !stillAllowed()) { cancel(); return; }
        // Only retry a request explicitly rejected before mutation by Clerk,
        // after completing the requested step-up. Never retry an unknown result.
        phase = 'deleting'; await target.delete();
      }
      if (!active || attempt !== generation) return;
      phase = 'deleted'; phrase = ''; acknowledged = false;
      message = 'A conta de acesso foi eliminada. Os dados e o histórico da empresa foram preservados.';
      await goToEntry(true);
    } catch (error) {
      if (!active || attempt !== generation) return;
      if (accountErrors(error).length) { phase = 'confirm'; showFormErrors(form, { ...accountFailure(error), error: 'Não foi possível eliminar a conta.' }); }
      else { phase = 'uncertain'; message = 'O pedido foi enviado, mas não foi possível confirmar o resultado. Não será repetido automaticamente. Verifique o estado da conta antes de continuar.'; }
    }
  }
  async function checkAccount() {
    if (phase !== 'uncertain' || !account) return; phase = 'checking';
    try {
      const result = await account.reload(); if (!active) return;
      if (result.id !== accountId || !sameIdentity()) throw new Error('Identity changed');
      phase = 'confirm'; message = 'A conta continua disponível. Nenhum novo pedido de eliminação foi enviado. Pode cancelar ou confirmar de novo.';
    } catch { if (active) { phase = 'uncertain'; message = 'Ainda não foi possível confirmar o estado. Uma sessão terminada não prova que a conta foi eliminada. Volte à entrada para verificar o acesso; não foi enviado outro pedido de eliminação.'; } }
  }
</script>

{#if ctx.isLoaded && ctx.user}
  <section class="account-danger-zone" aria-labelledby="account-delete-heading">
    <div><h2 id="account-delete-heading">Eliminar conta</h2><p>Elimina a sua conta de acesso, incluindo nas outras aplicações e no ambiente de teste que a partilham. No CRM, as viaturas, clientes, vendas, fotografias e histórico da empresa são preservados.</p></div>
    {#if allowed}<button class="account-delete-action" type="button" disabled={disabled || phase !== 'closed'} onclick={open}><Trash2 size={15} aria-hidden="true" />Eliminar a minha conta</button>
    {:else}<p>A eliminação da própria conta não está permitida para este acesso. Esta opção tem de ser disponibilizada pelo responsável pela configuração das contas.</p>{/if}
  </section>
{/if}
<dialog bind:this={dialog} class="account-delete-dialog" aria-labelledby="account-delete-title" oncancel={e => { e.preventDefault(); cancel(); }}>
  <form bind:this={form} class="account-form" onsubmit={submit} novalidate>
    <span class="account-eyebrow">Eliminar conta de acesso</span><h2 id="account-delete-title">Esta ação é permanente</h2>
    <p>Conta a eliminar: <strong>{identityLabel}</strong></p>
    <p>Deixará de poder entrar com esta identidade no CRM, nas outras aplicações e no ambiente de teste que usam a mesma conta de acesso.</p>
    <p>No CRM, esta ação não apaga viaturas, clientes, vendas, fotografias nem histórico da empresa. As referências e a auditoria do trabalho realizado são preservadas.</p>
    {#if message}<p role="status">{message}</p>{/if}
    {#if phase === 'deleted'}<Button onclick={() => goToEntry(true)}>Ir para a entrada</Button>
    {:else if phase === 'uncertain' || phase === 'checking'}<div class="account-actions"><Button variant="outline" loading={phase === 'checking'} onclick={checkAccount}>Verificar estado da conta</Button><Button variant="ghost" disabled={working} onclick={() => goToEntry(false)}>Voltar à entrada</Button></div>
    {:else}
      <fieldset disabled={working}>
        <label for="account-delete-confirmation">Escreva ELIMINAR para confirmar</label><input id="account-delete-confirmation" name="deleteConfirmation" autocomplete="off" spellcheck="false" bind:value={phrase} />
        <label class="account-check"><input name="sharedAccess" type="checkbox" bind:checked={acknowledged} />Compreendo que também perco o acesso nas aplicações que partilham esta conta.</label>
      </fieldset>
      <div class="account-actions"><Button variant="outline" disabled={phase === 'deleting'} onclick={cancel}>Manter a conta</Button><Button variant="danger" type="submit" loading={working} disabled={working}>Eliminar definitivamente a minha conta</Button></div>
    {/if}
  </form>
</dialog>
<AccountVerification bind:this={verification} />

<style>
  .account-danger-zone {margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;border:1px solid var(--color-border);border-radius:var(--radius-card);}
  .account-danger-zone h2 {font-size:14px;font-weight:600;color:var(--color-text);margin:0 0 6px;}
  .account-danger-zone p {color:var(--color-text-muted);font-size:12px;line-height:1.7;max-width:75ch;margin:0;overflow-wrap:anywhere;}
  .account-delete-action {flex-shrink:0;display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:10px 14px;border:1px solid color-mix(in oklab,var(--color-red) 40%,var(--color-border));border-radius:var(--radius-btn);color:var(--color-red);background:transparent;font-size:12px;transition:background-color 140ms;}
  .account-delete-action:hover:not(:disabled) {background:color-mix(in oklab,var(--color-red) 8%,transparent);}
  .account-delete-action:disabled {opacity:0.4;cursor:not-allowed;}
  .account-delete-action:focus-visible {outline:2px solid var(--color-red);outline-offset:4px;}
  .account-delete-dialog h2 {display:flex;align-items:center;gap:10px;font:italic 700 24px/1.2 var(--font-display);margin:6px 0 10px;color:var(--color-danger);}
  .account-delete-dialog p {font-size:13px;line-height:1.7;color:var(--color-text-muted);max-width:85ch;overflow-wrap:anywhere;}
  strong {color:var(--color-text);}
  .account-delete-dialog {width:min(580px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:0;border:1px solid var(--color-border-strong);border-radius:var(--radius-card);background:var(--color-bg-elevated);color:var(--color-text);}
  .account-delete-dialog::backdrop {background:#0009;backdrop-filter:blur(3px);}
  @media(max-width:600px) {.account-danger-zone {flex-direction:column;align-items:start;gap:14px;}.account-delete-action {min-height:44px;}}
</style>
