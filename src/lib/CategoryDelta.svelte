<script lang="ts">
  import type { CategoryDelta } from "$lib/client/finance-metrics";

  let { deltas, prevLabel }: { deltas: CategoryDelta[]; prevLabel: string } = $props();

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
</script>

<div class="cat-delta">
  {#if deltas.length === 0}
    <div class="empty">Sem dados para comparar com {prevLabel}.</div>
  {:else}
    {#each deltas as delta}
      <div class="row" class:up={delta.diff > 0} class:down={delta.diff < 0}>
        <span class="dot" style="background: {delta.color}"></span>
        <span class="name">{delta.name}</span>
        <div class="values">
          <span class="prev mono">{fmt(delta.previous)}</span>
          <span class="arrow">→</span>
          <span class="curr mono">{fmt(delta.current)}</span>
        </div>
        <span class="diff mono" class:plus={delta.diff > 0} class:minus={delta.diff < 0}>
          {#if delta.diff > 0}+{/if}{fmt(delta.diff)}
        </span>
        <span class="pct mono">
          {#if delta.previous === 0 && delta.current > 0}
            novo
          {:else if delta.previous > 0}
            {delta.diff >= 0 ? "↑" : "↓"} {Math.abs(delta.pct).toFixed(0)}%
          {:else}
            —
          {/if}
        </span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .cat-delta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .empty {
    color: var(--text-muted);
    font-size: 0.88rem;
    text-align: center;
    padding: 20px 0;
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto;
    gap: 8px;
    align-items: center;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 0.84rem;
    transition: background var(--transition);
  }
  .row:hover {
    background: var(--surface-hover);
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .name {
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .values {
    display: flex;
    gap: 4px;
    align-items: center;
    color: var(--text-muted);
    font-size: 0.78rem;
  }
  .arrow {
    color: var(--text-muted);
    opacity: 0.5;
  }
  .curr {
    color: var(--text-secondary);
  }
  .diff {
    font-weight: 700;
    color: var(--text-muted);
    text-align: right;
    min-width: 80px;
  }
  .diff.plus { color: var(--danger); }
  .diff.minus { color: var(--success); }
  .pct {
    font-weight: 600;
    font-size: 0.74rem;
    color: var(--text-muted);
    min-width: 50px;
    text-align: right;
  }
  .row.up .pct { color: var(--danger); }
  .row.down .pct { color: var(--success); }

  @media (max-width: 720px) {
    .row {
      grid-template-columns: auto 1fr auto;
      gap: 6px;
    }
    .values { display: none; }
  }
</style>
