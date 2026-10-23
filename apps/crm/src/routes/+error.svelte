<script lang="ts">
  import { crmPath } from '$lib/paths';
  import Button from '$lib/components/common/Button.svelte';
  import { page } from '$app/stores';
  import { AlertOctagon } from 'lucide-svelte';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import CrmBrandHead from '$lib/components/brand/CrmBrandHead.svelte';
  import ErrorRecovery from '$lib/components/common/ErrorRecovery.svelte';

  const status = $derived($page.status);
  const message = $derived($page.error?.message ?? 'Ocorreu um erro inesperado.');
</script>

<CrmBrandHead />

<svelte:head>
  <title>{status} · Auto Nunes Martins</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center bg-[var(--color-bg-0)] p-8">
  <div class="max-w-md w-full text-center space-y-6">
    <div class="flex justify-center"><Wordmark size="md" /></div>
    <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-red)]">
      ● {status} · Erro
    </div>
    <ItalicHero
      text={status === 401 ? 'Valide a sua ' : status === 403 ? 'Acesso ' : 'Algo '}
      accent={status === 401 ? 'sessão' : status === 403 ? 'restrito' : 'correu mal'}
      size="md"
    />
    <div
      class="flex items-start gap-3 p-4 border border-[var(--color-border)] bg-[var(--color-bg-1)] text-left"
      style="border-radius: var(--radius-card);"
    >
      <AlertOctagon class="h-5 w-5 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
      <p class="text-[14px] leading-relaxed text-[var(--color-text-muted)]">
        {status === 401
          ? 'A sua sessão precisa de ser validada. Tente recuperar o acesso sem fechar esta página.'
          : status === 403
            ? 'A sua conta não tem autorização para aceder a esta página.'
            : message}
      </p>
    </div>
    <ErrorRecovery {status} />
    <Button variant="primary" reload href={crmPath('/')}>Voltar ao início</Button>
  </div>
</main>
