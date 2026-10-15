<script lang="ts">
  import { type FadeSide } from './heroBackgroundFade';
  import { standDefaults, standNames, validStandIndex, type StandIndex, type StandSettings } from './heroStandSettings';
  let { active, onchange, settings = $bindable(standDefaults()) }: { active: boolean; onchange: (value: StandSettings) => void; settings?: StandSettings } = $props();
  let resumeAfterEdit = false;
  let open = $state(false);
  let width = $state(104), height = $state(100), zoom = $state(65);
  let x = $state<number | null>(50), y = $state<number | null>(72);
  let cropLeft = $state(0), cropRight = $state(0);
  let symmetricCrop = $state(true);
  let fade = $state(standDefaults().profiles[0].fade);
  let selected = $state<StandIndex>(0), copied = $state(''), showConfig = $state(false), viewportWidth = $state(1280);
  const originalX = $derived(viewportWidth <= 700 ? 54 : 50);
  const originalY = $derived(viewportWidth <= 700 ? 50 : 54);
  const config = $derived(JSON.stringify({ selectedImage: settings.selected + 1, autoplay: settings.playing, intervalSeconds: settings.interval, preserveProportions: true, images: settings.profiles.map((profile, index) => ({ image: index + 1, name: standNames[index], width: profile.width, height: profile.height, zoom: profile.zoom, horizontal: profile.x ?? originalX, vertical: profile.y ?? originalY, cropLeft: profile.cropLeft, cropRight: profile.cropRight, symmetricCrop: profile.symmetricCrop, cropPossible: profile.cropPossible, lateralFade: profile.fade, rendering: profile.rendering })) }, null, 2));
  $effect(() => {
    const profile = settings.profiles[selected];
    if (profile.symmetricCrop) { cropLeft = profile.cropLeft; cropRight = profile.cropRight; }
  });
  function emit(pause = true) {
    if (pause) { if (settings.playing) resumeAfterEdit = true; settings.playing = false; }
    settings.selected = selected;
    settings.profiles[settings.selected] = { width, height, zoom, x, y, cropLeft, cropRight, symmetricCrop, cropPossible: settings.profiles[settings.selected].cropPossible, fade, rendering: settings.profiles[settings.selected].rendering };
    settings.revision++;
    onchange({ ...settings, profiles: [...settings.profiles] }); copied = '';
  }
  function select(index: StandIndex) {
    emit(); selected = validStandIndex(index);
    const profile = settings.profiles[selected];
    width = profile.width; height = profile.height; zoom = profile.zoom; x = profile.x; y = profile.y; cropLeft = profile.cropLeft; cropRight = profile.cropRight; symmetricCrop = profile.symmetricCrop; fade = profile.fade;
    emit();
  }
  function togglePanel() {
    open = !open;
    if (open) emit();
    else { if (resumeAfterEdit) settings.playing = true; resumeAfterEdit = false; emit(false); }
  }
  function updateFade(side: 'left' | 'right' | 'common', key: keyof FadeSide, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.value === '' || !Number.isFinite(Number(input.value))) return;
    fade[side][key] = Math.min(Number(input.max), Math.max(0, Number(input.value)));
    emit();
  }
  function update(key: string, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const value = Number(input.value);
    if (input.value === '' || !Number.isFinite(value)) return;
    const next = Math.min(Number(input.max), Math.max(Number(input.min), value));
    if (key === 'width') width = next; else if (key === 'height') height = next; else if (key === 'zoom') zoom = next; else if (key === 'x') x = next; else if (key === 'y') y = next; else if (key === 'cropLeft') cropLeft = next; else if (key === 'cropRight') cropRight = next;
    emit();
  }
  function reset() { const defaults = standDefaults(); const profile = defaults.profiles[selected]; settings.interval = defaults.interval; width = profile.width; height = profile.height; zoom = profile.zoom; x = profile.x; y = profile.y; cropLeft = profile.cropLeft; cropRight = profile.cropRight; symmetricCrop = profile.symmetricCrop; fade = profile.fade; showConfig = false; emit(); }
  async function copy() {
    showConfig = true;
    try { await navigator.clipboard.writeText(config); copied = 'Configuração copiada.'; }
    catch { copied = 'Seleccione o texto abaixo para copiar.'; }
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} />
<div class="tuner" hidden={!active}>
  <button class="toggle" aria-expanded={open} aria-controls="hero-background-settings" onclick={togglePanel}>Ajustar fundo {open ? '−' : '+'}</button>
  {#if open}
    <aside id="hero-background-settings" aria-label="Ajustar fundo da opção 3">
      <div class="heading"><strong>Experimentar o fundo</strong><button aria-label="Fechar ajustes do fundo" onclick={togglePanel}>×</button></div>
      <div class="photos" role="group" aria-label="Fotografia do fundo">{#each standNames as name, index}<button aria-pressed={selected === index} onclick={() => select(index as StandIndex)}>Imagem {index + 1} · {name}</button>{/each}</div>
      <p>Ajustes da imagem {selected + 1}. Cada fotografia conserva os seus próprios valores.</p>
      <button onclick={() => { resumeAfterEdit = false; settings.playing = !settings.playing; emit(false); }}>{settings.playing ? 'Pausar alternância' : 'Retomar alternância'}</button>
      <label class="interval">Intervalo (segundos)<input aria-label="Intervalo da alternância em segundos" type="number" min="3" max="30" value={settings.interval} oninput={(event) => { const number = Number(event.currentTarget.value); if (event.currentTarget.value && Number.isFinite(number)) { settings.interval = Math.min(30, Math.max(3, number)); emit(false); } }} /></label>
      <p>Largura e altura ajustam a área do fundo. Zoom mantém as proporções da fotografia. Estes valores são a referência para desktop 2K; em ecrãs menores, o enquadramento adapta-se à fachada do stand.</p>
      <div class="controls">
        {#each [{ key: 'width', label: 'Largura', value: width, min: 50, max: 120 }, { key: 'height', label: 'Altura', value: height, min: 60, max: 120 }, { key: 'zoom', label: 'Zoom', value: zoom, min: 50, max: 160 }, { key: 'x', label: 'Posição horizontal', value: x ?? originalX, min: 0, max: 100 }, { key: 'y', label: 'Posição vertical', value: y ?? originalY, min: 0, max: 100 }] as control}
          <label class="control"><span>{control.label}</span><input aria-label={control.label} type="range" min={control.min} max={control.max} step="1" value={control.value} oninput={(event) => update(control.key, event)} /><input aria-label={`${control.label} em percentagem`} type="number" min={control.min} max={control.max} value={control.value} oninput={(event) => update(control.key, event)} /><span>%</span></label>
        {/each}
      </div>
      <fieldset class="fades">
        <legend>Recortes laterais</legend>
        <label class="symmetry"><input type="checkbox" checked={symmetricCrop} onchange={(event) => { symmetricCrop = event.currentTarget.checked; emit(); }} />Recorte simétrico à página</label>
        {#if symmetricCrop}<p>Recorta apenas o lado que ultrapassa mais o centro da página. Os valores abaixo são calculados e actualizados ao redimensionar.</p>{/if}
        {#if symmetricCrop && !settings.profiles[selected].cropPossible}<p role="status">Este enquadramento não permite igualar os lados com um recorte seguro. Desligue o recorte simétrico para ajustar manualmente.</p>{/if}
        <p>Reduzem só a área visível desse lado, sem mudar o zoom. Valores em % da imagem.</p>
        <div class="controls">
          {#each [{ key: 'cropLeft', label: 'Recorte esquerdo', value: cropLeft }, { key: 'cropRight', label: 'Recorte direito', value: cropRight }] as control}
            <label class="control"><span>{control.label}</span><input disabled={symmetricCrop} aria-label={control.label} type="range" min="0" max="45" step="0.001" value={control.value} oninput={(event) => update(control.key, event)} /><input disabled={symmetricCrop} aria-label={`${control.label} em percentagem`} type="number" min="0" max="45" step="0.001" value={control.value} oninput={(event) => update(control.key, event)} /><span>%</span></label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="fades">
        <legend>Fades laterais</legend>
        <label class="symmetry"><input type="checkbox" checked={fade.symmetric} onchange={(event) => { fade.symmetric = event.currentTarget.checked; emit(); }} />Fade simétrico</label>
        <p>Desligado: ajuste cada lado. Suavidade maior espalha a transição; intensidade ou largura a zero retira o fade desse lado.</p>
        {#each fade.symmetric ? ['common'] as const : ['left', 'right'] as const as side}
          <strong>{side === 'common' ? 'Ambos os lados' : side === 'left' ? 'Esquerda' : 'Direita'}</strong>
          <div class="controls">
            {#each [{ key: 'intensity', label: 'Intensidade', max: 100 }, { key: 'width', label: 'Largura do fade', max: fade.symmetric ? 49 : 80 }, { key: 'softness', label: 'Suavidade', max: 100 }] as control}
              {@const key = control.key as keyof FadeSide}
              {@const label = `${control.label} ${side === 'common' ? 'dos dois lados' : side === 'left' ? 'à esquerda' : 'à direita'}`}
              <label class="control"><span>{control.label}</span><input aria-label={label} type="range" min="0" max={control.max} value={fade[side][key]} oninput={(event) => updateFade(side, key, event)} /><input aria-label={`${label} em percentagem`} type="number" min="0" max={control.max} value={fade[side][key]} oninput={(event) => updateFade(side, key, event)} /><span>%</span></label>
            {/each}
          </div>
        {/each}
      </fieldset>
      <p>As duas fotografias já estão no site. Estes ajustes são apenas experimentais nesta sessão.</p>
      <div class="actions"><button onclick={reset}>Repor ajustes iniciais</button><button onclick={copy}>Copiar configuração</button></div>
      {#if showConfig}<label class="configuration">Configuração actual<textarea readonly value={config} rows="5" aria-label="Configuração actual"></textarea></label>{/if}
      <span role="status">{copied}</span>
    </aside>
  {/if}
</div>

<style>
  .tuner { color: var(--text); }
  .tuner[hidden] { display: none; }
  button { min-height: 44px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
  .toggle { position: fixed; z-index: 45; bottom: 18px; left: 180px; box-shadow: 0 4px 20px #0002; }
  aside { position: fixed; z-index: 46; right: max(18px, env(safe-area-inset-right)); bottom: max(88px, calc(env(safe-area-inset-bottom) + 88px)); width: 360px; max-height: calc(100svh - 240px); overflow-y: auto; box-sizing: border-box; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--bg); box-shadow: 0 8px 30px #0004; }
  .heading, .actions, .photos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .heading { justify-content: space-between; }
  .interval { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; }
  .interval input { width: 65px; }
  p { font-size: 12px; line-height: 1.6; margin: 10px 0; color: var(--muted); }
  .controls { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 16px 0; }
  .fades { border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 12px; }
  .fades .control { grid-template-columns: 94px minmax(0, 1fr) 76px 10px; }
  .symmetry { display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .symmetry input { width: 18px; height: 18px; }
  .control { display: grid; grid-template-columns: 112px minmax(0, 1fr) 55px 12px; align-items: center; gap: 6px; font-size: 12px; }
  input { min-width: 0; width: 100%; accent-color: var(--red); }
  input[type=number], textarea { border: 1px solid var(--line); border-radius: 5px; padding: 8px; background: var(--bg); color: var(--text); }
  button[aria-pressed=true] { border-color: var(--red); }
  button:disabled { opacity: .45; cursor: default; }
  .configuration { display: block; margin-top: 12px; font-size: 12px; }
  textarea { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; resize: vertical; }
  :is(button,input,textarea):focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
  [role=status] { font-size: 12px; }
  @media(max-width:700px) { aside { right: 12px; width: calc(100vw - 24px); max-height: min(52svh, calc(100svh - 210px)); padding: 14px; } .toggle { left: 172px; bottom: 18px; max-width: calc(100vw - 240px); padding: 8px; font-size: 11px; } }
</style>
