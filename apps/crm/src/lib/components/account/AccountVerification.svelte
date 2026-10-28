<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';
  import Button from '$lib/components/common/Button.svelte';
  import { accountFailure, type Verification } from '$lib/account/profile';
  import { clearFormErrors, showFormErrors } from '$lib/forms/formFeedback';
  const ctx = useClerkContext();
  let dialog: HTMLDialogElement;
  let form: HTMLFormElement;
  let resource = $state<Verification | null>(null);
  let selected = $state('');
  let secret = $state('');
  let busy = $state(false);
  let notice = $state('');
  let request = 0;
  let settle: ((ok: boolean) => void) | null = null;
  const second = $derived(resource?.status === 'needs_second_factor');
  const factors = $derived(second ? resource?.supportedSecondFactors ?? [] : resource?.supportedFirstFactors ?? []);
  const factor = $derived(factors.find((_, i) => String(i) === selected));
  const labels: Record<string, string> = { password: 'Palavra-passe', email_code: 'Código por email', phone_code: 'Código por SMS', totp: 'Aplicação autenticadora', backup_code: 'Código de recuperação', passkey: 'Chave de acesso' };
  const supported = (strategy: string) => strategy in labels;
  export function cancel() {
    request++; secret = ''; resource = null; selected = ''; busy = false;
    dialog?.close(); settle?.(false); settle = null;
  }
  onDestroy(cancel);
  export async function verify(level: 'first_factor' | 'second_factor' | 'multi_factor'): Promise<boolean> {
    cancel(); const current = ++request;
    const result = new Promise<boolean>(resolve => { settle = resolve; });
    await tick(); dialog.showModal(); busy = true; notice = 'A preparar a confirmação de identidade…';
    try {
      if (!ctx.session) throw new Error('Session unavailable');
      const response = await ctx.session.startVerification({ level });
      if (current !== request) return result;
      resource = response; notice = '';
      if (response.status === 'complete') complete();
    } catch { if (current === request) notice = 'Não foi possível iniciar a confirmação. Feche esta janela e tente novamente.'; }
    finally { if (current === request) busy = false; }
    return result;
  }
  function complete() { secret = ''; dialog.close(); settle?.(true); settle = null; resource = null; selected = ''; }
  async function choose(index: string) {
    if (busy || !ctx.session) return;
    const current = request; selected = index; secret = ''; notice = ''; clearFormErrors(form);
    const choice = factors[Number(index)]; if (!choice) return;
    busy = true;
    try {
      if (choice.strategy === 'email_code') {
        await ctx.session.prepareFirstFactorVerification({ strategy: 'email_code', emailAddressId: choice.emailAddressId });
      } else if (choice.strategy === 'phone_code') {
        if (second) await ctx.session.prepareSecondFactorVerification({ strategy: 'phone_code', phoneNumberId: choice.phoneNumberId });
        else await ctx.session.prepareFirstFactorVerification({ strategy: 'phone_code', phoneNumberId: choice.phoneNumberId });
      }
      if (current === request && ['email_code', 'phone_code'].includes(choice.strategy)) notice = 'Código enviado. Introduza-o abaixo.';
    } catch (error) { if (current === request) { selected = ''; showFormErrors(form, accountFailure(error, 'verification')); } }
    finally { if (current === request) busy = false; }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (busy || !ctx.session || !factor) return;
    clearFormErrors(form);
    if (!secret.trim() && factor.strategy !== 'passkey') {
      showFormErrors(form, { issues: [{ path: ['verification'], message: 'Preencha a confirmação de identidade.' }] }); return;
    }
    const current = request; busy = true;
    try {
      let response: Verification;
      if (factor.strategy === 'passkey' && !second) response = await ctx.session.verifyWithPasskey();
      else if (factor.strategy === 'password' && !second) response = await ctx.session.attemptFirstFactorVerification({ strategy: 'password', password: secret });
      else if (second && ['phone_code', 'totp', 'backup_code'].includes(factor.strategy)) {
        response = await ctx.session.attemptSecondFactorVerification({ strategy: factor.strategy as 'phone_code' | 'totp' | 'backup_code', code: secret.trim() });
      } else if (factor.strategy === 'email_code' || factor.strategy === 'phone_code') {
        response = await ctx.session.attemptFirstFactorVerification({ strategy: factor.strategy, code: secret.trim() });
      } else throw new Error('Unsupported verification');
      if (current !== request) return;
      secret = ''; resource = response;
      if (response.status === 'complete') complete();
      else { selected = ''; notice = 'Confirme também o segundo fator da sua conta.'; }
    } catch (error) { if (current === request) showFormErrors(form, accountFailure(error, 'verification')); }
    finally { if (current === request) busy = false; }
  }
</script>

<dialog bind:this={dialog} class="account-verification" aria-labelledby="account-verify-title" oncancel={(e) => { e.preventDefault(); cancel(); }}>
  <form bind:this={form} onsubmit={submit} novalidate class="account-form">
    <span class="account-eyebrow">Segurança da conta</span>
    <h2 id="account-verify-title">Confirme a sua identidade</h2>
    <p>Esta alteração exige uma confirmação adicional. Os dados do formulário ficam guardados nesta página.</p>
    {#if notice}<p role="status">{notice}</p>{/if}
    {#if resource && resource.status !== 'complete'}
      <fieldset disabled={busy}>
        <legend>{second ? 'Segundo fator' : 'Escolha como confirmar'}</legend>
        <div class="account-factor-options">
          {#each factors as option, i}
            {#if supported(option.strategy)}
              <button type="button" aria-pressed={selected === String(i)} onclick={() => choose(String(i))}>
                {labels[option.strategy]} {'safeIdentifier' in option ? option.safeIdentifier : ''}
              </button>
            {/if}
          {/each}
        </div>
        {#if !factors.some(f => supported(f.strategy))}
          <p>Esta conta exige um método que esta página ainda não suporta. Cancele e volte a iniciar sessão com o método da sua organização antes de repetir a alteração.</p>
        {/if}
        {#if factor && factor.strategy !== 'passkey'}
          <label for="account-verification-secret">{factor.strategy === 'password' ? 'Palavra-passe atual' : 'Código de confirmação'}</label>
          <input id="account-verification-secret" name="verification" type={factor.strategy === 'password' ? 'password' : 'text'} autocomplete={factor.strategy === 'password' ? 'current-password' : 'one-time-code'} bind:value={secret} />
          {#if ['email_code', 'phone_code'].includes(factor.strategy)}<button class="account-text-action" type="button" onclick={() => choose(selected)}>Reenviar código</button>{/if}
        {/if}
      </fieldset>
    {/if}
    <div class="account-actions">
      <Button variant="outline" onclick={cancel}>Cancelar confirmação</Button>
      <Button type="submit" loading={busy} disabled={!factor}>Confirmar identidade</Button>
    </div>
  </form>
</dialog>

<style>
  .account-verification {width:min(540px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:26px;border:1px solid var(--color-border-strong);border-radius:var(--radius-card);background:var(--color-bg-elevated);color:var(--color-text);}
  .account-verification::backdrop {background:#0009;backdrop-filter:blur(3px);}
</style>
