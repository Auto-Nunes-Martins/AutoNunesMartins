<script lang="ts">
  import VehicleSpecGlyph from '../../../../../../shared/ui/VehicleSpecGlyph.svelte';
  let {
    form,
    disabled = false,
    transmission = $bindable(''),
    specs = $bindable({
      version: '',
      powerHp: '',
      engineCc: '',
      doors: '',
      seats: '',
      category: '',
      color: '',
      equipment: '',
    }),
  }: {
    form?: string;
    disabled?: boolean;
    transmission?: string;
    specs?: {
      version: string;
      powerHp: string;
      engineCc: string;
      doors: string;
      seats: string;
      category: string;
      color: string;
      equipment: string;
    };
  } = $props();
</script>

<fieldset class="vehicle-characteristics crm-form-layout" data-vehicle-specifications {disabled}>
  <legend>Características e equipamento</legend>
  <input type="hidden" name="specificationsPresent" {form} value="true" />
  <p class="note">
    Preencha apenas características e equipamento confirmados nesta viatura. Os campos vazios não
    aparecem no site.
  </p>
  <div class="fields crm-compact-fields">
    <label style="--field-width: 180px"
      ><span class="spec-field-label"><VehicleSpecGlyph label="Caixa" />Transmissão</span><select
        name="publicTransmission"
        {form}
        bind:value={transmission}
        ><option value="">Não indicada</option><option value="MANUAL">Manual</option><option
          value="AUTOMATIC">Automática</option
        ></select
      ></label
    >
    <label style="--field-width: 260px"
      ><span class="spec-field-label">Versão / motorização <small>(opcional)</small></span><input
        name="version"
        {form}
        maxlength="160"
        bind:value={specs.version}
        placeholder="Ex.: 1.6 TDI S-line"
      /></label
    >
    <label style="--field-width: 150px"
      ><span class="spec-field-label"><VehicleSpecGlyph label="Categoria" />Categoria</span><input
        name="category"
        {form}
        maxlength="80"
        bind:value={specs.category}
      /></label
    >
    <label style="--field-width: 130px"
      ><span class="spec-field-label"><VehicleSpecGlyph label="Cor" />Cor</span><input
        name="color"
        {form}
        maxlength="80"
        bind:value={specs.color}
      /></label
    >
  </div>
  <div class="number-fields">
    <label
      ><span class="spec-field-label"><VehicleSpecGlyph label="Potência" />Potência (cv)</span
      ><input
        name="powerHp"
        {form}
        type="number"
        min="1"
        max="3000"
        step="1"
        bind:value={specs.powerHp}
      /></label
    >
    <label
      ><span class="spec-field-label"><VehicleSpecGlyph label="Cilindrada" />Cilindrada (cm³)</span
      ><input
        name="engineCc"
        {form}
        type="number"
        min="1"
        max="20000"
        step="1"
        bind:value={specs.engineCc}
      /></label
    >
    <label
      ><span class="spec-field-label"><VehicleSpecGlyph label="Portas" />Portas</span><input
        name="doors"
        {form}
        type="number"
        min="1"
        max="8"
        step="1"
        bind:value={specs.doors}
      /></label
    >
    <label
      ><span class="spec-field-label"><VehicleSpecGlyph label="Lugares" />Lugares</span><input
        name="seats"
        {form}
        type="number"
        min="1"
        max="20"
        step="1"
        bind:value={specs.seats}
      /></label
    >
  </div>
  <label
    >Equipamento confirmado (um item por linha)<textarea
      name="equipment"
      {form}
      rows="3"
      bind:value={specs.equipment}
    ></textarea></label
  >
</fieldset>

<style>
  :is(input, select, textarea):focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 3px;
  }
  .spec-field-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 20px;
  }
  .vehicle-characteristics {
    width: 100%;
    min-width: 0;
    margin: 0;
  }
  .vehicle-characteristics legend {
    font-size: 18px;
    font-weight: 600;
    padding: 0;
  }
  .number-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 140px));
    gap: 14px;
    margin-block: 16px;
  }
  .number-fields > label {
    min-width: 0;
    margin-bottom: 0;
    align-content: start;
  }
  .number-fields input {
    min-width: 0;
    width: 100%;
  }
  .number-fields :is([name='doors'], [name='seats']) {
    max-width: 90px;
  }
  .fields :is([name='category'], [name='color']) {
    max-width: 240px;
  }
  .fields [name='version'] {
    max-width: 480px;
  }
  .fields [name='publicTransmission'] {
    max-width: 240px;
  }
  @container (min-width: 480px) {
    .number-fields {
      grid-template-columns: minmax(0, 120px) minmax(0, 140px) repeat(2, minmax(0, 90px));
    }
  }

  .fields {
    display: flex;
    gap: 16px;
    margin-bottom: 18px;
  }
  .fields > label {
    margin-bottom: 0;
  }
  label {
    display: grid;
    gap: 7px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  input,
  select,
  textarea {
    width: 100%;
    background: var(--color-bg-0);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 10px;
    min-height: 44px;
    border-radius: var(--radius-btn);
  }
  fieldset {
    border: 0;
    border-top: 1px solid var(--color-border);
    padding: 16px 0 0;
    min-width: 0;
  }
  .note {
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.7;
    margin: 15px 0;
  }
  small {
    font-size: 11px;
    color: var(--color-text-muted);
  }
</style>
