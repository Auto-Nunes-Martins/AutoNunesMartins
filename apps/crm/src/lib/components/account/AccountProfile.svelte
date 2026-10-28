<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { useClerkContext } from 'svelte-clerk';
  import { dark } from '@clerk/themes';
  import { theme } from '$lib/stores/theme';
  import { invalidateAll } from '$app/navigation';
  import { Camera, ShieldCheck, UserRound, Mail, Monitor, Eye, EyeOff } from 'lucide-svelte';
  import Button from '$lib/components/common/Button.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import AccountVerification from './AccountVerification.svelte';
  import { accountSettings, accountFailure, avatarProblem, needsReverification, passwordProblem, passwordRequirements, verificationLevel, type AccountUser, type Email } from '$lib/account/profile';
  import { clearFormErrors, showFormErrors, showInvalidFormFields } from '$lib/forms/formFeedback';
  import '$lib/styles/accountProfile.css';

  const ctx = useClerkContext();
  const user = $derived(ctx.user);
  const settings = $derived(accountSettings(ctx.clerk));
  let verify: AccountVerification;
  let identity = $state('');
  let firstName = $state(''); let lastName = $state(''); let username = $state('');
  let busy = $state(''); let success = $state('');
  let pendingConfirmation = $state<{ account: AccountUser; message: string; after?: () => void } | null>(null);
  const locked = $derived(!!busy || !!pendingConfirmation);
  let currentPassword = $state(''); let newPassword = $state(''); let confirmation = $state('');
  let visiblePasswords = $state(false); let signOutOthers = $state(false);
  let avatar = $state<File | null>(null); let preview = $state('');
  let email = $state(''); let code = $state(''); let verifyingEmail = $state<Email | null>(null);
  let sessions = $state<Awaited<ReturnType<AccountUser['getSessions']>>>([]);
  let sessionsLoading = $state(false); let sessionsError = $state('');
  let sessionRequest = 0;
  let profileForm = $state<HTMLFormElement>(null!); let avatarForm = $state<HTMLFormElement>(null!);
  let passwordForm = $state<HTMLFormElement>(null!); let emailForm = $state<HTMLFormElement>(null!); let securityForm = $state<HTMLFormElement>(null!);
  let active = true;
  const enabled = (field: string) => !!settings?.attributes[field]?.enabled;
  const required = (field: string) => !!settings?.attributes[field]?.required;
  const emailCodeEnabled = $derived(settings?.attributes.email_address?.verifications?.includes('email_code') ?? false);
  const displayName = $derived(user?.fullName || user?.username || 'A sua conta');
  const initials = $derived(displayName.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase());
  const profileDirty = $derived(!!user && (firstName !== (user.firstName ?? '') || lastName !== (user.lastName ?? '') || username !== (user.username ?? '')));

  function clearPreview() { if (preview) URL.revokeObjectURL(preview); preview = ''; avatar = null; }
  function clearSecrets() { currentPassword = ''; newPassword = ''; confirmation = ''; code = ''; visiblePasswords = false; }
  onDestroy(() => { active = false; clearPreview(); clearSecrets(); });
  $effect(() => {
    const id = user?.id ?? '';
    if (id !== identity) untrack(() => {
      identity = id; firstName = user?.firstName ?? ''; lastName = user?.lastName ?? ''; username = user?.username ?? '';
      verify?.cancel(); pendingConfirmation = null; clearPreview(); clearSecrets(); email = ''; verifyingEmail = null; success = ''; sessions = [];
      sessionRequest++; sessionsLoading = false;
      if (id) void loadSessions();
    });
  });

  async function protectedAction<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (!needsReverification(error)) throw error;
      if (!(await verify.verify(verificationLevel(error)))) throw new Error('Verification cancelled');
      return await action(); // Clerk still authorizes the retried request; never skip its checks.
    }
  }
  async function run(form: HTMLFormElement, key: string, action: (account: AccountUser) => Promise<unknown>, message: string, after?: () => void) {
    if (locked || !user) return;
    const account = user; busy = key; success = ''; clearFormErrors(form);
    let sent = false;
    try {
      await protectedAction(() => action(account));
      sent = true;
      if (!active || ctx.user?.id !== account.id) return;
      // Mutations and their fresh read must both succeed before announcing success.
      await account.reload();
      if (!active || ctx.user?.id !== account.id) return;
      after?.(); success = message;
      try { await ctx.session?.getToken({ skipCache: true }); await invalidateAll(); }
      catch { success += ' Os dados foram guardados; não foi possível atualizar o restante painel. Recarregue a página.'; }
    } catch (error) {
      if (active && ctx.user?.id === account.id) {
        if (sent) pendingConfirmation = { account, message, after };
        else showFormErrors(form, error instanceof Error && error.message === 'Verification cancelled'
          ? { error: 'Confirmação cancelada. A alteração não foi concluída.' }
          : accountFailure(error, key === 'avatar' ? 'avatar' : undefined));
      }
    } finally { busy = ''; }
  }
  async function confirmCurrentAccount() {
    const pending = pendingConfirmation; if (!pending || busy) return;
    busy = 'confirm';
    try {
      await pending.account.reload();
      if (!active || ctx.user?.id !== pending.account.id) return;
      pending.after?.(); pendingConfirmation = null; success = pending.message;
      try { await ctx.session?.getToken({ skipCache: true }); await invalidateAll(); }
      catch { success += ' Recarregue a página para atualizar o restante painel.'; }
    } catch { success = 'Ainda não foi possível confirmar os dados atuais. Verifique a ligação e repita a confirmação.'; }
    finally { busy = ''; }
  }
  async function saveProfile(event: SubmitEvent) {
    event.preventDefault(); if (busy || !settings || showInvalidFormFields(profileForm)) return;
    const payload: Parameters<AccountUser['update']>[0] = {};
    if (enabled('first_name') && firstName !== (user?.firstName ?? '')) payload.firstName = firstName.trim() || null;
    if (enabled('last_name') && lastName !== (user?.lastName ?? '')) payload.lastName = lastName.trim() || null;
    if (enabled('username') && username !== (user?.username ?? '')) payload.username = username.trim() || null;
    if (!Object.keys(payload).length) return;
    await run(profileForm, 'profile', account => account.update(payload), 'Perfil atualizado.', () => {
      firstName = user?.firstName ?? ''; lastName = user?.lastName ?? ''; username = user?.username ?? '';
    });
  }
  async function chooseAvatar(event: Event) {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if (!file || busy) return;
    success = ''; clearFormErrors(avatarForm);
    const problem = avatarProblem(file);
    if (problem) { showFormErrors(avatarForm, { issues: [{ path: ['avatar'], message: problem }] }); return; }
    busy = 'avatar-preview'; const accountId = user?.id;
    const candidate = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = candidate; await image.decode();
      if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('Invalid image');
      if (!active || ctx.user?.id !== accountId) { URL.revokeObjectURL(candidate); return; }
      clearPreview(); avatar = file; preview = candidate;
    } catch { URL.revokeObjectURL(candidate); showFormErrors(avatarForm, { issues: [{ path: ['avatar'], message: 'Não foi possível abrir esta fotografia. Escolha outra imagem válida.' }] }); }
    finally { busy = ''; }
  }
  async function saveAvatar(event: SubmitEvent) {
    event.preventDefault(); if (!avatar) return;
    const file = avatar;
    await run(avatarForm, 'avatar', account => account.setProfileImage({ file }), 'Fotografia atualizada.', clearPreview);
  }
  async function savePassword(event: SubmitEvent) {
    event.preventDefault(); if (busy || !settings) return; clearFormErrors(passwordForm);
    const issues: { path: string[]; message: string }[] = [];
    if (user?.passwordEnabled && !currentPassword) issues.push({ path: ['currentPassword'], message: 'Introduza a palavra-passe atual.' });
    const problem = passwordProblem(newPassword, settings); if (problem) issues.push({ path: ['newPassword'], message: problem });
    if (newPassword !== confirmation || !confirmation) issues.push({ path: ['confirmation'], message: 'A confirmação deve ser igual à nova palavra-passe.' });
    if (issues.length) { showFormErrors(passwordForm, { issues }); return; }
    await run(passwordForm, 'password', account => account.updatePassword({ ...(account.passwordEnabled ? { currentPassword } : {}), newPassword, signOutOfOtherSessions: signOutOthers }), 'Palavra-passe atualizada.', () => { clearSecrets(); void loadSessions(); });
  }
  async function sendCode(address: Email) {
    if (!emailCodeEnabled) return;
    await run(emailForm, 'email', async () => { verifyingEmail = address; await address.prepareVerification({ strategy: 'email_code' }); }, 'Código enviado. Confirme o email para o poder utilizar.', () => { code = ''; });
    await tick(); if (verifyingEmail) document.getElementById('account-email-code')?.focus();
  }
  async function addEmail(event: SubmitEvent) {
    event.preventDefault(); if (busy || showInvalidFormFields(emailForm) || !emailCodeEnabled) return;
    const value = email.trim();
    await run(emailForm, 'email', async account => {
      // Reuse an existing pending address after a failed send/read; do not create duplicates.
      const existing = verifyingEmail?.emailAddress === value ? verifyingEmail : account.emailAddresses.find(a => a.emailAddress.toLowerCase() === value.toLowerCase());
      const address = existing ?? await account.createEmailAddress({ email: value });
      verifyingEmail = address;
      await address.prepareVerification({ strategy: 'email_code' });
    }, 'Código enviado para o novo email. A conta ainda mantém o email principal atual.', () => { code = ''; });
  }
  async function confirmEmail(event: SubmitEvent) {
    event.preventDefault(); if (busy || !verifyingEmail) return; clearFormErrors(emailForm);
    if (!code.trim()) { showFormErrors(emailForm, { issues: [{ path: ['code'], message: 'Introduza o código recebido por email.' }] }); return; }
    const address = verifyingEmail;
    await run(emailForm, 'email', async () => {
      const result = await address.attemptVerification({ code: code.trim() });
      if (result.verification.status !== 'verified') throw new Error('Email not verified');
    }, 'Email verificado. Pode agora defini-lo como principal.', () => { verifyingEmail = null; code = ''; email = ''; });
  }
  async function loadSessions() {
    const account = ctx.user; if (!account || sessionsLoading) return;
    const request = ++sessionRequest;
    sessionsLoading = true; sessionsError = '';
    try { const result = await account.getSessions(); if (active && request === sessionRequest && ctx.user?.id === account.id) sessions = result.filter(s => s.status === 'active'); }
    catch { if (active && request === sessionRequest) sessionsError = 'Não foi possível carregar as sessões. Tente novamente.'; }
    finally { if (request === sessionRequest) sessionsLoading = false; }
  }
</script>

<div class="account-profile" id="perfil">
  {#if !ctx.isLoaded}<p role="status">A carregar a sua conta…</p>
  {:else if !user}<p role="status">A sessão terminou. Entre novamente para gerir a sua conta.</p>
  {:else}
    <header class="account-intro">
      <div><span class="account-eyebrow">Conta pessoal</span><h2>O seu perfil</h2><p>A sua identificação e segurança no Auto Nunes Martins.</p></div>
      <span class="account-security-note"><ShieldCheck size={16} aria-hidden="true" /> Conta protegida</span>
    </header>
    <p class="account-success" role="status" aria-live="polite">{success}</p>
    {#if pendingConfirmation}<div class="account-notice"><p>A alteração foi enviada, mas não foi possível voltar a ler os dados da conta. Confirme o estado antes de fazer outra alteração; o pedido original não será reenviado.</p><Button variant="outline" loading={busy === 'confirm'} onclick={confirmCurrentAccount}>Confirmar estado da conta</Button></div>{/if}
    {#if !settings}<p class="account-notice">Não foi possível obter as opções da sua conta. A edição está temporariamente indisponível. Recarregue a página ou use as opções avançadas de segurança abaixo.</p>{/if}
    <div class="account-grid">
      <Panel>
        <PanelHeader icon={Camera} title="Fotografia" />
        <form bind:this={avatarForm} class="account-form account-photo-form" onsubmit={saveAvatar} novalidate>
          <div class="account-avatar">{#if preview || user.hasImage}<img src={preview || user.imageUrl} alt={preview ? 'Pré-visualização da nova fotografia' : 'A sua fotografia'} />{:else}<span>{initials}</span>{/if}</div>
          <div><h3>{displayName}</h3><p>JPEG, PNG ou WebP, até 5 MB. A fotografia só muda depois de guardar.</p></div>
          <fieldset disabled={locked}>
            <label class="account-upload" for="account-avatar-file">{user.hasImage ? 'Escolher outra fotografia' : 'Escolher fotografia'}</label>
            <input id="account-avatar-file" class="sr-only" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" onchange={chooseAvatar} />
            {#if preview}<p>Pré-visualização · por guardar</p><div class="account-actions"><Button type="submit" loading={busy === 'avatar'}>Guardar fotografia</Button><Button variant="ghost" onclick={clearPreview}>Descartar</Button></div>{/if}
            {#if user.hasImage && !preview}<Button variant="ghost" onclick={() => run(avatarForm, 'avatar', account => account.setProfileImage({ file: null }), 'Fotografia removida.', clearPreview)}>Remover fotografia</Button>{/if}
          </fieldset>
        </form>
      </Panel>
      <Panel>
        <PanelHeader icon={UserRound} title="Identificação" />
        <form bind:this={profileForm} class="account-form" onsubmit={saveProfile} novalidate>
          <fieldset disabled={locked || !settings}>
            <div class="account-field-grid">
              {#if enabled('first_name')}<div><label for="account-first-name">Nome {required('first_name') ? '*' : ''}</label><input id="account-first-name" name="firstName" autocomplete="given-name" required={required('first_name')} bind:value={firstName} /></div>{/if}
              {#if enabled('last_name')}<div><label for="account-last-name">Apelido {required('last_name') ? '*' : ''}</label><input id="account-last-name" name="lastName" autocomplete="family-name" required={required('last_name')} bind:value={lastName} /></div>{/if}
            </div>
            {#if enabled('username')}<label for="account-username">Nome de utilizador {required('username') ? '*' : ''}</label><input id="account-username" name="username" autocomplete="username" required={required('username')} minlength={settings?.usernameSettings.min_length} maxlength={settings?.usernameSettings.max_length} bind:value={username} /><p>Entre {settings?.usernameSettings.min_length} e {settings?.usernameSettings.max_length} caracteres. A disponibilidade é confirmada ao guardar.</p>{:else if settings}<p>O nome de utilizador não está disponível nesta conta.</p>{/if}
            {#if !enabled('first_name') && !enabled('last_name') && settings}<p>O nome é gerido pelo fornecedor de acesso da sua conta.</p>{/if}
            <div class="account-actions"><Button type="submit" disabled={!profileDirty || locked} loading={busy === 'profile'}>Guardar perfil</Button></div>
          </fieldset>
        </form>
      </Panel>
      <Panel>
        <PanelHeader icon={Mail} title="Email" />
        <div class="account-form">
          <ul class="account-list">{#each user.emailAddresses as address (address.id)}<li><div><strong>{address.emailAddress}</strong><p>{address.id === user.primaryEmailAddressId ? 'Principal · ' : ''}{address.verification.status === 'verified' ? 'Verificado' : 'Por verificar'}</p></div><div class="account-actions">
            {#if address.verification.status !== 'verified' && emailCodeEnabled}<Button size="sm" variant="outline" disabled={locked} onclick={() => sendCode(address)}>Verificar email</Button>{/if}
            {#if address.verification.status === 'verified' && address.id !== user.primaryEmailAddressId}<Button size="sm" variant="outline" disabled={locked} onclick={() => run(emailForm, 'email', account => account.update({ primaryEmailAddressId: address.id }), 'Email principal atualizado.')}>Definir como principal</Button>{/if}
          </div></li>{/each}</ul>
          <form bind:this={emailForm} onsubmit={verifyingEmail ? confirmEmail : addEmail} class="account-form account-nested-form" novalidate>
            <fieldset disabled={locked || !settings}>
              {#if verifyingEmail}<label for="account-email-code">Código enviado para {verifyingEmail.emailAddress}</label><input id="account-email-code" name="code" type="text" autocomplete="one-time-code" inputmode="numeric" bind:value={code} /><div class="account-actions"><Button type="submit" loading={busy === 'email'}>Confirmar email</Button><Button variant="outline" onclick={() => sendCode(verifyingEmail!)}>Reenviar código</Button><Button variant="ghost" onclick={() => { verifyingEmail = null; code = ''; clearFormErrors(emailForm); }}>Voltar</Button></div>
              {:else if enabled('email_address') && emailCodeEnabled}<label for="account-new-email">Adicionar novo email</label><input id="account-new-email" name="email" type="email" autocomplete="email" required bind:value={email} /><p>O email atual mantém-se até verificar o novo endereço e o definir como principal.</p><div class="account-actions"><Button type="submit" loading={busy === 'email'}>Enviar código de verificação</Button></div>
              {:else}<p>A alteração de email desta conta exige as opções avançadas de segurança.</p>{/if}
            </fieldset>
          </form>
        </div>
      </Panel>
      <Panel>
        <PanelHeader icon={ShieldCheck} title="Palavra-passe" />
        <form bind:this={passwordForm} onsubmit={savePassword} class="account-form" novalidate autocomplete="on">
          {#if enabled('password')}
            {#if !user.passwordEnabled}<p>A sua conta ainda não tem palavra-passe. Pode criar uma; o fornecedor poderá pedir uma confirmação de identidade.</p>{/if}
            <fieldset disabled={locked || !settings}>
              {#if user.passwordEnabled}<label for="account-current-password">Palavra-passe atual</label><input id="account-current-password" name="currentPassword" type={visiblePasswords ? 'text' : 'password'} autocomplete="current-password" bind:value={currentPassword} />{/if}
              <label for="account-new-password">Nova palavra-passe</label><input id="account-new-password" name="newPassword" type={visiblePasswords ? 'text' : 'password'} autocomplete="new-password" bind:value={newPassword} aria-describedby="account-password-policy" />
              <div id="account-password-policy" class="account-policy"><p>Requisitos da sua conta</p><ul>{#if settings}{#each passwordRequirements(settings) as requirement}<li>{requirement}</li>{/each}{/if}</ul><p>A segurança e a disponibilidade são sempre confirmadas pelo fornecedor da conta.</p></div>
              <label for="account-confirm-password">Confirmar nova palavra-passe</label><input id="account-confirm-password" name="confirmation" type={visiblePasswords ? 'text' : 'password'} autocomplete="new-password" bind:value={confirmation} />
              <button class="account-text-action" type="button" aria-pressed={visiblePasswords} onclick={() => visiblePasswords = !visiblePasswords}>{#if visiblePasswords}<EyeOff size={16} />{:else}<Eye size={16} />{/if}{visiblePasswords ? 'Ocultar palavras-passe' : 'Mostrar palavras-passe'}</button>
              <label class="account-check"><input type="checkbox" bind:checked={signOutOthers} />Terminar as outras sessões ao guardar</label>
              <div class="account-actions"><Button type="submit" loading={busy === 'password'}>{user.passwordEnabled ? 'Alterar palavra-passe' : 'Criar palavra-passe'}</Button></div>
            </fieldset>
          {:else}<p>Esta conta usa {user.externalAccounts.map(a => a.provider).join(', ') || 'outro método de acesso'}. A palavra-passe não está disponível. Continue a usar o seu fornecedor de acesso.</p>{/if}
        </form>
      </Panel>
    </div>
    <Panel>
      <PanelHeader icon={Monitor} title="Sessões e segurança" />
      <form bind:this={securityForm} class="account-form" onsubmit={e => e.preventDefault()}>
        <p>{user.twoFactorEnabled ? 'Autenticação de dois fatores ativa.' : 'A autenticação de dois fatores ainda não está ativa.'}</p>
        {#if user.externalAccounts.length}<p>Contas associadas: {user.externalAccounts.map(a => a.provider).join(', ')}.</p>{/if}
        {#if sessionsLoading}<p role="status">A carregar sessões…</p>{/if}
        {#if sessionsError}<p role="status">{sessionsError}</p>{/if}
        <ul class="account-list">{#each sessions as session (session.id)}<li><div><strong>{session.latestActivity?.browserName || 'Navegador'} · {session.latestActivity?.deviceType || (session.latestActivity?.isMobile ? 'Telemóvel' : 'Computador')}</strong><p>{session.id === ctx.session?.id ? 'Esta sessão · ' : ''}Última atividade: {new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(session.lastActiveAt)}</p></div>{#if session.id !== ctx.session?.id}<Button variant="outline" size="sm" disabled={locked} onclick={() => run(securityForm, 'session', () => session.revoke(), 'Sessão terminada.', () => { sessions = sessions.filter(s => s.id !== session.id); })}>Terminar sessão</Button>{/if}</li>{/each}</ul>
        <div class="account-actions"><Button variant="outline" disabled={sessionsLoading || locked} onclick={loadSessions}>Atualizar sessões</Button><Button variant="ghost" disabled={locked} onclick={() => ctx.clerk?.openUserProfile({ __experimental_startPath: '/security', apiKeysProps: { hide: true }, appearance: { baseTheme: $theme === 'dark' ? dark : undefined } })}>Opções avançadas de segurança</Button></div>
        <p>As opções avançadas abrem a gestão segura do fornecedor da conta para configurar dois fatores, chaves de acesso, telefones e contas associadas. A edição de fotografia, identificação, email e palavra-passe é feita aqui.</p>
      </form>
    </Panel>
  {/if}
</div>
<AccountVerification bind:this={verify} />
