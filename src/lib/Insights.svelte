<script lang="ts">
  import type { Insight } from "$lib/client/finance-metrics";

  let { insights }: { insights: Insight[] } = $props();
  let expanded = $state(false);

  let visible = $derived(expanded ? insights : insights.slice(0, 2));
</script>

{#if insights.length > 0}
  <div class="insights">
    <div class="insights-head">
      <span class="insights-title">Insights</span>
      {#if insights.length > 2}
        <button class="insights-toggle" onclick={() => (expanded = !expanded)}>
          {expanded ? "Ver menos" : `Ver todos (${insights.length})`}
        </button>
      {/if}
    </div>
    <ul class="insights-list">
      {#each visible as insight}
        <li class="insight insight-{insight.level}">
          <span class="insight-dot" aria-hidden="true"></span>
          <div class="insight-content">
            <span class="insight-title">{insight.title}</span>
            {#if insight.detail}
              <span class="insight-detail">{insight.detail}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .insights {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 18px 16px;
    margin-bottom: 18px;
    box-shadow: var(--shadow);
  }
  .insights-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .insights-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .insights-toggle {
    border: none;
    background: transparent;
    color: var(--primary);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    transition: background var(--transition);
  }
  .insights-toggle:hover {
    background: var(--primary-light);
  }
  .insights-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .insight {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    border-left: 3px solid var(--text-muted);
  }
  .insight-info {
    border-left-color: var(--info);
  }
  .insight-positive {
    border-left-color: var(--success);
    background: var(--success-light);
  }
  .insight-warning {
    border-left-color: var(--warning);
    background: rgba(245, 158, 11, 0.08);
  }
  .insight-danger {
    border-left-color: var(--danger);
    background: var(--danger-light);
  }
  .insight-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 6px;
    background: var(--text-muted);
  }
  .insight-info .insight-dot {
    background: var(--info);
  }
  .insight-positive .insight-dot {
    background: var(--success);
  }
  .insight-warning .insight-dot {
    background: var(--warning);
  }
  .insight-danger .insight-dot {
    background: var(--danger);
  }
  .insight-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .insight-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.4;
  }
  .insight-detail {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
</style>
