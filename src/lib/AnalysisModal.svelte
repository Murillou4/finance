<script lang="ts">
  import Modal from "$lib/Modal.svelte";
  import NetWorthChart from "$lib/NetWorthChart.svelte";
  import TopExpenses from "$lib/TopExpenses.svelte";
  import CategoryDelta from "$lib/CategoryDelta.svelte";
  import ForecastCard from "$lib/ForecastCard.svelte";
  import WhatIfSimulator from "$lib/WhatIfSimulator.svelte";
  import RecurringSuggestions from "$lib/RecurringSuggestions.svelte";
  import type { MonthSummary } from "$lib/client/finance-data";
  import type {
    CategoryDelta as CategoryDeltaType,
    Forecast,
    NetWorthPoint,
    RecurringExpense,
    TopExpenseEntry,
  } from "$lib/client/finance-metrics";

  interface Props {
    open: boolean;
    onClose: () => void;
    summary: MonthSummary;
    netWorthPoints: NetWorthPoint[];
    topExpenses: TopExpenseEntry[];
    deltas: CategoryDeltaType[];
    prevLabel: string;
    forecast: Forecast;
    recurring: RecurringExpense[];
    onPromoteRecurring: (item: RecurringExpense) => void;
  }

  let {
    open,
    onClose,
    summary,
    netWorthPoints,
    topExpenses: topItems,
    deltas,
    prevLabel,
    forecast,
    recurring,
    onPromoteRecurring,
  }: Props = $props();

  type Tab = "overview" | "categorias" | "previsao" | "simulador" | "recorrentes";
  let active = $state<Tab>("overview");
</script>

<Modal {open} {onClose} title="Análise" size="lg">
  <div class="modal-body analysis-body">
    <div class="sub-tabs">
      <button class="sub-tab" class:active={active === "overview"} onclick={() => (active = "overview")}>Visão Geral</button>
      <button class="sub-tab" class:active={active === "categorias"} onclick={() => (active = "categorias")}>Categorias</button>
      <button class="sub-tab" class:active={active === "previsao"} onclick={() => (active = "previsao")}>Previsão</button>
      <button class="sub-tab" class:active={active === "simulador"} onclick={() => (active = "simulador")}>Simulador</button>
      <button class="sub-tab" class:active={active === "recorrentes"} onclick={() => (active = "recorrentes")}>
        Recorrentes
        {#if recurring.length > 0}
          <span class="badge-count">{recurring.length}</span>
        {/if}
      </button>
    </div>

    {#if active === "overview"}
      <section>
        <NetWorthChart points={netWorthPoints} variant="full" height={120} />
      </section>
      <section>
        <h3>Top 5 gastos do mês</h3>
        <TopExpenses items={topItems} total={summary.totalExpenses} />
      </section>
    {/if}

    {#if active === "categorias"}
      <section>
        <h3>Variação vs {prevLabel}</h3>
        <CategoryDelta {deltas} {prevLabel} />
      </section>
    {/if}

    {#if active === "previsao"}
      <ForecastCard {forecast} />
    {/if}

    {#if active === "simulador"}
      <section>
        <h3>E se eu cortar uma categoria?</h3>
        <p class="hint">Simule o impacto anual de reduzir gastos em qualquer categoria.</p>
        <WhatIfSimulator {summary} />
      </section>
    {/if}

    {#if active === "recorrentes"}
      <section>
        <h3>Recorrentes detectados</h3>
        <RecurringSuggestions items={recurring} onPromote={onPromoteRecurring} />
      </section>
    {/if}
  </div>
</Modal>

<style>
  .analysis-body {
    gap: 16px;
  }
  .sub-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border-light);
    margin: -4px -4px 4px;
    padding: 0 4px;
    overflow-x: auto;
  }
  .sub-tab {
    border: none;
    background: transparent;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all var(--transition);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sub-tab:hover { color: var(--text); }
  .sub-tab.active {
    color: var(--text);
    border-bottom-color: var(--primary);
  }
  .badge-count {
    background: var(--primary);
    color: white;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  section h3 {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin: 0;
  }
  .hint {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: -4px 0 0;
  }

  @media (max-width: 760px) {
    .analysis-body {
      gap: 14px;
    }
    .sub-tabs {
      gap: 8px;
      margin: -2px -16px 2px;
      padding: 0 16px 6px;
      border-bottom: 0;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .sub-tabs::-webkit-scrollbar {
      display: none;
    }
    .sub-tab {
      min-height: 38px;
      padding: 8px 11px;
      margin: 0;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      scroll-snap-align: start;
    }
    .sub-tab.active {
      background: var(--primary-light);
      border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
      border-bottom-color: color-mix(in srgb, var(--primary) 45%, var(--border));
    }
    section h3 {
      font-size: 0.74rem;
      letter-spacing: 0.04em;
    }
  }
</style>
