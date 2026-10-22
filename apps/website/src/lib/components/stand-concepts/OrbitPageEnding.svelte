<script lang="ts">
  import OrbitVisitStudio from './OrbitVisitStudio.svelte';
  import OrbitCompactFooter from './OrbitCompactFooter.svelte';
  import type { SceneBackground } from './homeVisualFamilies';

  let { onContact, background }: { onContact: () => void; background?: SceneBackground } = $props();
</script>

<OrbitVisitStudio
  id="contactos"
  {background}
  backgroundTone="original"
  formTreatment="original"
  formDivider
  showDemoNote={false}
  showCallIcon
  borderlessPanels
  mapArtwork="original"
  harmonizedTypography
/>
<OrbitCompactFooter showContacts={false} compact contactHref="#contactos" {onContact} />
