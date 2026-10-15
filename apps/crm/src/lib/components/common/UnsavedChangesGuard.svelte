<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { hasUnsavedForms } from '$lib/forms/formFeedback';

  beforeNavigate((navigation) => {
    // Refresh and external navigation use the browser's native beforeunload dialog.
    if (navigation.willUnload) return;
    if (
      navigation.to?.url.pathname === navigation.from?.url.pathname &&
      navigation.to?.url.search === navigation.from?.url.search
    )
      return;
    if (hasUnsavedForms() && !window.confirm('Tem alterações por guardar. Sair sem guardar?'))
      navigation.cancel();
  });
</script>
