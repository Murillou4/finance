<script lang="ts">
  import type { RecurringExpense } from "$lib/client/finance-metrics";

  interface Props {
    items: RecurringExpense[];
    onPromote: (item: RecurringExpense) => void;
  }

  let { items, onPromote }: Props = $props();

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
</script>

<div class="recurring">
  {#if items.length === 0}
    <div class="empty">Nenhum gasto variável recorrente detectado nos últimos meses.</div>
  {:else}
    <p class="lead">
      Esses gastos aparecem em vários meses. Promovê-los para fixos evita re-digitar e melhora as previsões.
    </p>
    <div class="list">
      {#each items as item}
        <div class="row">
          <div class="info">
            <span class="name">{item.name}</span>
            <span class="meta">
              {item.monthsSeen} meses
              {#if item.category_name} · {item.category_name}{/if}
            </span>
          </div>
          <div class="vals">
            <span class="avg mono">média {fmt(item.averageValue)}</span>
            <span class="last mono">último {fmt(item.lastValue)}</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick={() => onPromote(item)}>
            Promover
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .recurring {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .empty {
    color: var(--text-muted);
    font-size: 0.88rem;
    text-align: center;
    padding: 20px 0;
  }
  .lead {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    background: var(--surface-hover);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    transition: all var(--transition);
  }
  .row:hover {
    border-color: var(--border);
    transform: translateY(-1px);
    box-shadow: var(--shadow);
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 0.74rem;
    color: var(--text-muted);
  }
  .vals {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 0.78rem;
  }
  .avg {
    color: var(--text);
    font-weight: 600;
  }
  .last {
    color: var(--text-muted);
    font-size: 0.7rem;
  }
  .mono { font-variant-numeric: tabular-nums; }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr auto;
      gap: 8px;
    }
    .vals {
      grid-column: 1 / -1;
      flex-direction: row;
      justify-content: space-between;
    }
  }
</style>
