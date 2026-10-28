<script lang="ts">
  import { ChartNoAxesCombined } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import { formatEUR, formatInt } from '$lib/utils/format';
  import type { SalesChartData } from '$lib/server/dashboard';
  import { salesChartGeometry } from './salesChartGeometry';

  let { data }: { data: SalesChartData } = $props();
  const chart = $derived(salesChartGeometry(data.sold));
  const gradientId = $props.id();
  let selected = $state<number | null>(null);
  let hovered = $state<number | null>(null);
  const activeIndex = $derived(
    hovered !== null && hovered < data.sold.length
      ? hovered
      : selected !== null && selected < data.sold.length
        ? selected
        : data.sold.length - 1,
  );
  const activeMonth = $derived(data.months[activeIndex] ?? `Mês ${activeIndex + 1}`);

  function moveSelection(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = Math.min(data.sold.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = data.sold.length - 1;
    else return;
    event.preventDefault();
    selected = next;
    const container = (event.currentTarget as HTMLButtonElement).parentElement;
    container?.querySelectorAll('button')[next]?.focus();
  }
</script>

<Panel>
  <PanelHeader
    variant="dashboard"
    icon={ChartNoAxesCombined}
    iconClass="text-[var(--color-red)]"
    title="Vendas Mensais"
    meta="ÚLTIMOS 12 MESES"
  />

  <dl class="totals">
    <div>
      <dt>Vendidos · ano atual</dt>
      <dd>{formatInt(data.ytdSold)} <span>un.</span></dd>
    </div>
    <div>
      <dt>Faturação · ano atual</dt>
      <dd>{formatEUR(data.ytdRevenue)}</dd>
    </div>
    <div>
      <dt>Margem média · ano atual</dt>
      <dd>{data.ytdAvgMarginPct !== null ? `${data.ytdAvgMarginPct.toFixed(1)}%` : '—'}</dd>
    </div>
    <div>
      <dt>Lucro das vendas · ano atual</dt>
      <dd>{formatEUR(data.ytdProfit)}</dd>
    </div>
    <div>
      <dt>Despesas operacionais · ano atual</dt>
      <dd>{formatEUR(data.ytdOperatingExpenses)}</dd>
    </div>
    <div>
      <dt>Resultado após despesas · ano atual</dt>
      <dd>{formatEUR(data.ytdResultAfterExpenses)}</dd>
    </div>
  </dl>

  {#if data.sold.length === 0}
    <p class="empty">Sem vendas mensais disponíveis</p>
  {:else}
    <div class="chart-body">
      <div class="chart-caption">
        <span class="legend"><span aria-hidden="true"></span>Viaturas vendidas</span>
        <span class="selection" aria-live="polite" aria-atomic="true">
          <span>{activeMonth}</span>
          <strong>{formatInt(data.sold[activeIndex] ?? 0)} un.</strong>
          <span class="revenue"
            >{data.revenue[activeIndex] !== undefined
              ? formatEUR(String(data.revenue[activeIndex]))
              : ''}</span
          >
        </span>
      </div>
      <div
        class="chart-scroll"
        aria-label="Vendas por mês. Selecione um mês para consultar o total e a faturação."
      >
        <div class="plot" style={`--months: ${data.sold.length};`}>
          <div class="axis" aria-hidden="true">
            {#each chart.ticks as tick (tick)}<span>{tick}</span>{/each}
          </div>
          <svg
            class="data-layer"
            viewBox="0 0 1000 176"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--color-red)" stop-opacity="0.34" />
                <stop offset="100%" stop-color="var(--color-red)" stop-opacity="0.015" />
              </linearGradient>
            </defs>
            {#each chart.ticks as tick, i (tick)}
              <line
                x1="0"
                x2="1000"
                y1={i * 44}
                y2={i * 44}
                stroke="var(--color-border)"
                stroke-dasharray={i === 4 ? undefined : '3 5'}
                vector-effect="non-scaling-stroke"
              />
            {/each}
            {#if chart.area}<path d={chart.area} fill={`url(#${gradientId})`} />{/if}
            <path
              d={chart.line}
              fill="none"
              stroke="var(--color-red)"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="months" role="group" aria-label="Vendas mensais">
            {#each chart.points as point, i (i)}
              {@const month = data.months[i] ?? `Mês ${i + 1}`}
              <button
                type="button"
                class="month"
                class:active={i === activeIndex}
                aria-pressed={i === (selected ?? data.sold.length - 1)}
                aria-label={`${month}: ${point.value} ${point.value === 1 ? 'viatura vendida' : 'viaturas vendidas'}${data.revenue[i] !== undefined ? `; faturação ${formatEUR(String(data.revenue[i]))}` : ''}`}
                title={`${month}: ${point.value} ${point.value === 1 ? 'venda' : 'vendas'}`}
                onclick={() => {
                  selected = i;
                  hovered = null;
                }}
                onfocus={() => {
                  selected = i;
                  hovered = null;
                }}
                onpointerenter={(event) => {
                  if (event.pointerType === 'mouse') hovered = i;
                }}
                onpointerleave={() => (hovered = null)}
                onkeydown={(event) => moveSelection(event, i)}
              >
                <span class="point-track" aria-hidden="true">
                  {#if i === activeIndex}<span class="crosshair"></span>{/if}
                  <span class="point" style={`top: ${100 - point.percent}%;`}></span>
                </span>
                <span class="month-label" aria-hidden="true">{month}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
      {#if data.sold.every((value) => value === 0)}
        <p class="zero-note">Sem vendas registadas neste período.</p>
      {/if}
    </div>
  {/if}
</Panel>

<style>
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 36px;
    margin: 0;
    padding: 20px;
  }
  dt {
    color: var(--color-text-faint);
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  dd {
    margin: 7px 0 0;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
  .totals > div:first-child dd {
    color: var(--color-red);
  }
  dd span {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-text-faint);
    letter-spacing: 0;
  }
  .chart-body {
    padding: 0 20px 20px;
  }
  .chart-caption {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 16px;
    min-height: 36px;
    margin-bottom: 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
  }
  .legend,
  .selection {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .legend > span {
    width: 16px;
    height: 2px;
    background: var(--color-red);
  }
  .selection {
    padding: 8px 10px;
    color: #fff;
    background: var(--color-red);
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
  .selection > span:first-child {
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .selection strong {
    color: #fff;
    font-weight: 600;
  }
  .revenue {
    border-left: 1px solid rgba(255, 255, 255, 0.35);
    padding-left: 8px;
  }
  .chart-scroll {
    overflow-x: auto;
    padding: 6px 3px 3px;
    margin: -6px -3px -3px;
  }
  .plot {
    position: relative;
    height: 194px;
    min-width: calc(var(--months) * 34px + 32px);
  }
  .axis {
    position: absolute;
    width: 21px;
    top: 8px;
    bottom: 26px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    text-align: right;
  }
  .axis span {
    line-height: 0;
  }
  .data-layer {
    position: absolute;
    left: 32px;
    top: 8px;
    width: calc(100% - 32px);
    height: calc(100% - 34px);
    overflow: visible;
  }
  .months {
    position: absolute;
    inset: 0 0 0 32px;
    display: grid;
    grid-template-columns: repeat(var(--months), minmax(0, 1fr));
  }
  .month {
    position: relative;
    min-width: 0;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    border-radius: 2px;
    color: var(--color-text-muted);
  }
  .month:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 1px;
  }
  .point-track {
    position: absolute;
    left: 0;
    right: 0;
    top: 8px;
    bottom: 26px;
  }
  .point {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: var(--color-bg-1);
    border: 1.5px solid var(--color-red);
    border-radius: 50%;
  }
  .month.active .point {
    width: 10px;
    height: 10px;
    background: var(--color-red);
    border: 2px solid var(--color-bg-1);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-red) 25%, transparent);
  }
  .crosshair {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    border-left: 1px dashed color-mix(in oklab, var(--color-red) 35%, transparent);
  }
  .month-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 18px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .month.active .month-label {
    color: var(--color-red);
    font-weight: 600;
  }
  .empty {
    margin: 0;
    padding: 50px 20px;
    text-align: center;
    color: var(--color-text-faint);
    font-size: 12px;
  }
  .zero-note {
    margin: 14px 0 0;
    color: var(--color-text-muted);
    font-size: 11px;
  }
  @media (max-width: 640px) {
    .totals {
      gap: 16px 24px;
    }
    dd {
      font-size: 21px;
    }
    .plot {
      height: 182px;
    }
    .chart-caption {
      margin-bottom: 16px;
    }
  }
</style>
