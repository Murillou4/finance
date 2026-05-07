<script lang="ts">
  import type { MonthSummary } from "$lib/client/finance-data";
  import { whatIfCutCategory } from "$lib/client/finance-metrics";

  let { summary }: { summary: MonthSummary } = $props();

  let selectedCategoryId = $state<number | null>(null);
  let cutPct = $state(20);

  let candidates = $derived(
    summary.byCategory.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent),
  );

  let active = $derived(selectedCategoryId ?? candidates[0]?.id ?? null);
  let result = $derived(active !== null ? whatIfCutCategory(summary, active, cutPct) : null);

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
</script>

<div class="whatif">
  {#if candidates.length === 0}
    <div class="empty">Sem categorias com gasto neste mês.</div>
  {:else}
    <div class="controls">
      <div class="control">
        <label for="whatif-cat">Cortar em</label>
        <select
          id="whatif-cat"
          class="select"
          bind:value={selectedCategoryId}
        >
          {#each candidates as cat}
            <option value={cat.id}>{cat.name} ({fmt(cat.spent)})</option>
          {/each}
        </select>
      </div>
      <div class="control">
        <label for="whatif-pct">Reduzir</label>
        <div class="slider-wrap">
          <input
            id="whatif-pct"
            type="range"
            min="0"
            max="100"
            step="5"
            bind:value={cutPct}
          />
          <span class="pct mono">{cutPct}%</span>
        </div>
      </div>
    </div>

    {#if result}
      <div class="results">
        <div class="result-card">
          <span class="r-label">Economia mensal</span>
          <span class="r-value mono positive">{fmt(result.monthlyCut)}</span>
        </div>
        <div class="result-card">
          <span class="r-label">Em 1 ano</span>
          <span class="r-value mono positive">{fmt(result.yearlyCut)}</span>
        </div>
        <div class="result-card">
          <span class="r-label">Novo saldo</span>
          <span class="r-value mono" class:positive={result.newBalance >= 0} class:negative={result.newBalance < 0}>
            {fmt(result.newBalance)}
          </span>
        </div>
        <div class="result-card">
          <span class="r-label">Nova taxa</span>
          <span class="r-value mono" class:positive={result.newSavingRate >= 0} class:negative={result.newSavingRate < 0}>
            {result.newSavingRate.toFixed(1)}%
          </span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .whatif {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .empty {
    color: var(--text-muted);
    font-size: 0.88rem;
    text-align: center;
    padding: 20px 0;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .control label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .slider-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
  }
  input[type="range"] {
    flex: 1;
    accent-color: var(--primary);
  }
  .pct {
    font-weight: 700;
    color: var(--text);
    min-width: 48px;
    text-align: right;
  }
  .results {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .result-card {
    background: var(--surface-hover);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
  .r-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .r-value {
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }
  .mono { font-variant-numeric: tabular-nums; }

  @media (max-width: 640px) {
    .controls { grid-template-columns: 1fr; }
    .results { grid-template-columns: 1fr 1fr; }
  }
</style>
