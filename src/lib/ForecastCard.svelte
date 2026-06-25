<script lang="ts">
  import type { Forecast } from "$lib/client/finance-metrics";
  import { MONTHS_FULL } from "$lib/client/finance-metrics";

  let { forecast }: { forecast: Forecast } = $props();

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
</script>

<div class="forecast">
  <div class="head">
    <div>
      <span class="label">Previsão para</span>
      <span class="month">{MONTHS_FULL[forecast.month - 1]} de {forecast.year}</span>
    </div>
    {#if forecast.basis === 0}
      <span class="tag warn">Sem dados históricos</span>
    {:else}
      <span class="tag info">Base: {forecast.basis}m</span>
    {/if}
  </div>

  <div class="balance" class:positive={forecast.expectedBalance >= 0} class:negative={forecast.expectedBalance < 0}>
    <span class="b-label">Saldo previsto</span>
    <span class="b-value mono">{fmt(forecast.expectedBalance)}</span>
  </div>

  <div class="rows">
    <div class="row">
      <span>Receita esperada</span>
      <span class="mono positive">{fmt(forecast.expectedIncome)}</span>
    </div>
    <div class="row">
      <span>Fixos (já lançados)</span>
      <span class="mono">{fmt(forecast.expectedFixed)}</span>
    </div>
    <div class="row">
      <span>Variáveis (média)</span>
      <span class="mono">{fmt(forecast.expectedVariable)}</span>
    </div>
    <div class="row">
      <span>Cartão (parcelas pendentes)</span>
      <span class="mono">{fmt(forecast.expectedCreditFromInstallments)}</span>
    </div>
    <div class="row total">
      <span>Total despesas</span>
      <span class="mono negative">{fmt(forecast.totalExpense)}</span>
    </div>
  </div>
</div>

<style>
  .forecast {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .label {
    font-size: 0.74rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    margin-right: 6px;
  }
  .month {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
  }
  .tag {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 9999px;
  }
  .tag.warn {
    background: rgba(245, 158, 11, 0.15);
    color: #92400e;
  }
  .tag.info {
    background: var(--info-light);
    color: var(--info-text);
  }
  .balance {
    background: var(--surface-hover);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .balance.positive {
    background: var(--success-light);
    border-color: rgba(16, 185, 129, 0.18);
  }
  .balance.negative {
    background: var(--danger-light);
    border-color: rgba(239, 68, 68, 0.18);
  }
  .b-label {
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-weight: 600;
  }
  .b-value {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .balance.positive .b-value { color: var(--success); }
  .balance.negative .b-value { color: var(--danger); }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 4px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .row.total {
    border-top: 1px solid var(--border-light);
    margin-top: 4px;
    padding-top: 10px;
    font-weight: 700;
    color: var(--text);
  }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }
  .mono {
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 760px) {
    .head,
    .balance,
    .row {
      align-items: flex-start;
    }
    .head,
    .balance {
      flex-direction: column;
    }
    .month {
      display: block;
      margin-top: 2px;
      line-height: 1.25;
    }
    .tag {
      width: fit-content;
    }
    .b-value {
      font-size: 1.24rem;
      line-height: 1.15;
      word-break: break-word;
    }
    .row {
      gap: 12px;
      line-height: 1.35;
    }
    .row span:last-child {
      text-align: right;
    }
  }
</style>
