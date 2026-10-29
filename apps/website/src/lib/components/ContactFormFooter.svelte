<script lang="ts">
  import type { Snippet } from 'svelte';
  import ContactPrivacyNotice from './ContactPrivacyNotice.svelte';
  let { children }: { children: Snippet } = $props();
</script>

<div class="contact-form-footer">
  <div class="footer-row">
    <ContactPrivacyNotice />
    {@render children()}
  </div>
</div>

<style>
  .contact-form-footer {
    container-type: inline-size;
    width: 100%;
    min-width: 0;
    margin-top: 20px;
  }
  .footer-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 180px;
    align-items: end;
    gap: 20px;
  }
  .footer-row :global(.contact-privacy) {
    min-width: 0;
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
  }
  .footer-row > :global(button[type='submit']) {
    box-sizing: border-box;
    width: 180px !important;
    max-width: 100%;
    min-height: 48px;
    margin: 0 !important;
    justify-self: end;
  }
  @container (max-width: 430px) {
    .footer-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .footer-row > :global(button[type='submit']) {
      width: 100% !important;
    }
  }
</style>
