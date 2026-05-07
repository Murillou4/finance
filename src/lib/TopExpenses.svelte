<script lang="ts">
  import type { TopExpenseEntry } from "$lib/client/finance-metrics";

  let { items, total }: { items: TopExpenseEntry[]; total: number } = $props();

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function sourceLabel(source: TopExpenseEntry["source"]) {
    if (source === "fixed") return "Fixo";
    if (source === "monthly") return "Mensal";
    return "Cartão";
  }
</script>

<div class="top-expenses">
  {#if items.length === 0}
    <div class="empty">Sem gastos registrados.</div>
  {:else}
    {#each items as item, i}
      {@const share = total > 0 ? (item.value / total) * 100 : 0}
      <div class="row">
        <span class="rank">#{i + 1}</span>
        <div class="info">
          <div class="info-top">
            <span class="name">{item.name}</span>
            <span class="value mono">{fmt(item.value)}</span>
          </div>
          <div class="info-bottom">
            <div class="meta">
              <span class="src src-{item.source}">{sourceLabel(item.source)}</span>
              {#if item.category_name}
                <span
                  class="cat"
                  style="background: {item.category_color}20; color: {item.category_color}; border: 1px solid {item.category_color}40"
                >
                  {item.category_name}
                </span>
              {/if}
              {#if item.date}
                <span class="date mono">{item.date}</span>
              {/if}
            </div>
            <span class="share mono">{share.toFixed(1)}%</span>
          </div>
          <div class="bar">
            <div
              class="bar-fill"
              style="width: {share}%; background: {item.category_color || 'var(--primary)'}"
            ></div>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .top-expenses {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.88rem;
    padding: 20px 0;
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: flex-start;
  }
  .rank {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface-hover);
    border-radius: 6px;
    padding: 3px 7px;
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .info-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text);
  }
  .info-bottom {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .src {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--surface-hover);
    color: var(--text-muted);
  }
  .src-fixed { background: rgba(99, 102, 241, 0.15); color: var(--info); }
  .src-monthly { background: rgba(245, 158, 11, 0.15); color: #92400e; }
  .src-credit { background: rgba(236, 72, 153, 0.15); color: var(--badge-credit-color); }
  .cat {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 4px;
  }
  .date {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .share {
    font-size: 0.74rem;
    color: var(--text-muted);
    font-weight: 600;
    flex-shrink: 0;
  }
  .bar {
    height: 4px;
    background: var(--border-light);
    border-radius: 100px;
    overflow: hidden;
    margin-top: 2px;
  }
  .bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
</style>
