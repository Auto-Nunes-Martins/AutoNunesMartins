<script lang="ts">
  import VisitSection from '../contact/VisitSection.svelte';
  import CompactFooter from './CompactFooter.svelte';
  import { homeScenes, type SceneBackground } from '../home/homeScenes';

  let {
    onContact,
    background = homeScenes.visit,
  }: { onContact: (event: MouseEvent) => void; background?: SceneBackground } = $props();
</script>

<VisitSection
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
<CompactFooter showContacts={false} compact contactHref="#contactos" {onContact} />
