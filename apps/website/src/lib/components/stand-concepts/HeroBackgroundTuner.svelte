<script lang="ts">
  import { type FadeSide } from './heroBackgroundFade';
  import { standDefaults, standNames, validStandIndex, type StandIndex, type StandSettings } from './heroStandSettings';

  let { active, onchange, settings = $bindable(standDefaults()) }: { active: boolean; onchange: (value: StandSettings) => void; settings?: StandSettings } = $props();
  let resumeAfterEdit = false;
  let open = $state(false);
  let selected = $state<StandIndex>(0), copied = $state(''), showConfig = $state(false);
  const fade = $derived(settings.profiles[selected].fade);
  const profile = $derived(settings.profiles[selected]);
  const config = $derived(JSON.stringify({ images: settings.profiles.map((profile, index) => ({ image: index + 1, name: standNames[index], width: profile.width, height: profile.height, zoom: profile.zoom, horizontal: profile.x, vertical: profile.y, lateralFade: profile.fade })) }, null, 2));

  function updateGeometry(key: 'width' | 'height' | 'zoom' | 'x' | 'y', event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.value === '' || !Number.isFinite(Number(input.value))) return;
    profile[key] = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value)));
    emit();
  }

  function emit(pause = true) {
    if (pause) { if (settings.playing) resumeAfterEdit = true; settings.playing = false; }
    settings.selected = selected;
    settings.revision++;
    onchange({ ...settings, profiles: [...settings.profiles] }); copied = '';
  }
  function select(index: StandIndex) { selected = validStandIndex(index); emit(); }
  function togglePanel() {
    open = !open;
    if (open) { selected = validStandIndex(settings.selected); emit(); }
    else { if (resumeAfterEdit) settings.playing = true; resumeAfterEdit = false; emit(false); }
  }
  function updateFade(side: 'left' | 'right' | 'common', key: keyof FadeSide, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.value === '' || !Number.isFinite(Number(input.value))) return;
    fade[side][key] = Math.min(Number(input.max), Math.max(0, Number(input.value)));
    emit();
  }
  function reset() {
    const initial = standDefaults().profiles[selected];
    settings.profiles[selected] = { ...settings.profiles[selected], width: initial.width, height: initial.height, zoom: initial.zoom, x: initial.x, y: initial.y, fade: initial.fade };
    showConfig = false; emit();
  }
  async function copy() {
    showConfig = true;
    try { await navigator.clipboard.writeText(config); copied = 'Configuração copiada.'; }
    catch { copied = 'Seleccione o texto abaixo para copiar.'; }
  }
</script>

<div class="tuner" hidden={!active}>
  <button class="toggle" aria-expanded={open} aria-controls="hero-background-settings" onclick={togglePanel}>Ajustar fundo {open ? '−' : '+'}</button>
  {#if open}
    <aside id="hero-background-settings" aria-label="Ajustar fundo da opção 1">
      <div class="heading"><strong>Experimentar o fundo</strong><button aria-label="Fechar ajustes do fundo" onclick={togglePanel}>×</button></div>
      <div class="photos" role="group" aria-label="Fotografia do fundo">{#each standNames as name, index}<button aria-pressed={selected === index} onclick={() => select(index as StandIndex)}>Imagem {index + 1} · {name}</button>{/each}</div>
      <p>Ajustes da imagem {selected + 1}. Cada fotografia conserva os seus próprios valores.</p>
      <p>Largura e altura ajustam a área do fundo. Zoom mantém as proporções. As posições conservam os valores da composição 2K; ao estreitar o desktop, o ponto focal mantém a posição relativa e recortam-se as extremidades.</p>
      <div class="controls">
        {#each [{ key: 'width', label: 'Largura', min: 50, max: 120 }, { key: 'height', label: 'Altura', min: 60, max: 120 }, { key: 'zoom', label: 'Zoom', min: 50, max: 160 }, { key: 'x', label: 'Posição horizontal', min: 0, max: 100 }, { key: 'y', label: 'Posição vertical', min: 0, max: 100 }] as control}
          {@const key = control.key as 'width' | 'height' | 'zoom' | 'x' | 'y'}
          {@const value = profile[key] ?? 50}
          <label class="control"><span>{control.label}</span><input aria-label={control.label} type="range" min={control.min} max={control.max} step="1" value={value} oninput={(event) => updateGeometry(key, event)} /><input aria-label={`${control.label} em percentagem`} type="number" min={control.min} max={control.max} value={value} oninput={(event) => updateGeometry(key, event)} /><span>%</span></label>
        {/each}
      </div>
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
      <p>Estes ajustes são apenas experimentais nesta sessão.</p>
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
