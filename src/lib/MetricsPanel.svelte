<script lang="ts">
  import type {
    BurnRateInfo,
    CommitmentBreakdown,
    CreditCardRunRate,
    EmergencyReserve,
    FutureDebt,
    SavingsBreakdown,
  } from "$lib/client/finance-metrics";

  interface Props {
    saving: SavingsBreakdown;
    savingMa3: number;
    savingMa12: number;
    burn: BurnRateInfo;
    runRate: CreditCardRunRate;
    commitment: CommitmentBreakdown;
    reserve: EmergencyReserve;
    debt: FutureDebt;
  }

  let { saving, savingMa3, savingMa12, burn, runRate, commitment, reserve, debt }: Props = $props();

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function pct(value: number, digits = 0) {
    return `${value.toFixed(digits)}%`;
  }
</script>

<div class="metrics-panel">
  <!-- Saving rate -->
  <div class="metric">
    <div class="metric-head">
      <span class="metric-label">Taxa de poupança</span>
      <span class="metric-tag" class:tag-good={saving.rate >= 20} class:tag-warn={saving.rate >= 0 && saving.rate < 10} class:tag-bad={saving.rate < 0}>
        {saving.rate >= 20 ? "Saudável" : saving.rate >= 10 ? "Ok" : saving.rate >= 0 ? "Apertado" : "Negativo"}
      </span>
    </div>
    <div class="metric-value" class:positive={saving.rate >= 0} class:negative={saving.rate < 0}>
      {pct(saving.rate, 1)}
    </div>
    <div class="metric-bar">
      <div
        class="metric-bar-fill"
        style="width: {Math.max(0, Math.min(100, saving.rate))}%; background: {saving.rate >= 20 ? 'var(--success)' : saving.rate >= 0 ? 'var(--warning)' : 'var(--danger)'}"
      ></div>
    </div>
    <div class="metric-foot">
      <span>3m: <b>{pct(savingMa3)}</b></span>
      <span>12m: <b>{pct(savingMa12)}</b></span>
    </div>
  </div>

  <!-- Burn rate -->
  <div class="metric">
    <div class="metric-head">
      <span class="metric-label">Burn rate variável</span>
      <span class="metric-tag" class:tag-bad={burn.willOverflow} class:tag-good={!burn.willOverflow && burn.variableBudget > 0}>
        {burn.variableBudget === 0 ? "Sem meta" : burn.willOverflow ? "Vai estourar" : "No ritmo"}
      </span>
    </div>
    <div class="metric-value">{fmt(burn.perDayActual)}<span class="metric-unit">/dia</span></div>
    {#if burn.variableBudget > 0}
      <div class="metric-bar">
        <div
          class="metric-bar-fill"
          style="width: {Math.min(100, (burn.variableSpent / burn.variableBudget) * 100)}%; background: {burn.willOverflow ? 'var(--danger)' : 'var(--primary)'}"
        ></div>
      </div>
      <div class="metric-foot">
        <span>{fmt(burn.variableSpent)} de {fmt(burn.variableBudget)}</span>
        {#if burn.daysUntilOverflow !== null}
          <span class="bad">Estoura em {burn.daysUntilOverflow}d</span>
        {:else}
          <span>{burn.daysRemaining}d restantes</span>
        {/if}
      </div>
    {:else}
      <div class="metric-foot">
        <span>Defina orçamento por categoria para ver projeção.</span>
      </div>
    {/if}
  </div>

  <!-- Credit card run rate -->
  <div class="metric">
    <div class="metric-head">
      <span class="metric-label">Cartão (run-rate)</span>
      <span class="metric-tag tag-info">Projeção</span>
    </div>
    <div class="metric-value">{fmt(runRate.projected)}</div>
    <div class="metric-bar">
      <div
        class="metric-bar-fill"
        style="width: {runRate.projected > 0 ? Math.min(100, (runRate.spent / runRate.projected) * 100) : 0}%; background: var(--info)"
      ></div>
    </div>
    <div class="metric-foot">
      <span>Atual: {fmt(runRate.spent)}</span>
      <span>{fmt(runRate.perDay)}/dia</span>
    </div>
  </div>

  <!-- Reserve -->
  <div class="metric">
    <div class="metric-head">
      <span class="metric-label">Reserva de emergência</span>
      <span class="metric-tag" class:tag-good={reserve.monthsCovered >= reserve.targetMonths} class:tag-warn={reserve.monthsCovered >= 1 && reserve.monthsCovered < reserve.targetMonths} class:tag-bad={reserve.monthsCovered < 1}>
        {reserve.monthsCovered.toFixed(1)} / {reserve.targetMonths}m
      </span>
    </div>
    <div class="metric-value">{pct(Math.min(100, reserve.progressPct), 0)}</div>
    <div class="metric-bar">
      <div
        class="metric-bar-fill"
        style="width: {Math.min(100, reserve.progressPct)}%; background: {reserve.monthsCovered >= reserve.targetMonths ? 'var(--success)' : 'var(--info)'}"
      ></div>
    </div>
    <div class="metric-foot">
      <span>{fmt(reserve.invested)}</span>
      {#if reserve.shortfall > 0}
        <span>Falta {fmt(reserve.shortfall)}</span>
      {:else}
        <span class="good">Meta atingida</span>
      {/if}
    </div>
  </div>

  <!-- Commitment -->
  <div class="metric metric-wide">
    <div class="metric-head">
      <span class="metric-label">Comprometimento de renda</span>
      <span class="metric-tag tag-info">{fmt(commitment.income)}</span>
    </div>
    {#if commitment.income > 0}
      <div class="stack-bar" aria-label="Distribuição da renda">
        <div class="seg seg-fixed" style="width: {commitment.fixedPct}%" title="Fixos {pct(commitment.fixedPct, 0)}"></div>
        <div class="seg seg-variable" style="width: {commitment.variablePct}%" title="Mensais {pct(commitment.variablePct, 0)}"></div>
        <div class="seg seg-credit" style="width: {commitment.creditPct}%" title="Cartão {pct(commitment.creditPct, 0)}"></div>
        <div class="seg seg-invested" style="width: {commitment.investedPct}%" title="Invest. {pct(commitment.investedPct, 0)}"></div>
        <div class="seg seg-free" style="width: {Math.max(0, commitment.freePct)}%" title="Livre {pct(Math.max(0, commitment.freePct), 0)}"></div>
      </div>
      <div class="legend">
        <span class="lg lg-fixed">Fixos {pct(commitment.fixedPct)}</span>
        <span class="lg lg-variable">Mensais {pct(commitment.variablePct)}</span>
        <span class="lg lg-credit">Cartão {pct(commitment.creditPct)}</span>
        <span class="lg lg-invested">Invest. {pct(commitment.investedPct)}</span>
        <span class="lg lg-free">Livre {pct(Math.max(0, commitment.freePct))}</span>
      </div>
    {:else}
      <div class="metric-foot">
        <span>Registre suas entradas para ver a distribuição.</span>
      </div>
    {/if}
  </div>

  <!-- Future debt -->
  <div class="metric metric-wide">
    <div class="metric-head">
      <span class="metric-label">Parcelas pendentes</span>
      <span class="metric-tag tag-info">Próx. 12m</span>
    </div>
    <div class="metric-value">{fmt(debt.totalPending)}<span class="metric-unit">em {debt.countPending}</span></div>
    {#if debt.byMonth.some((m) => m.total > 0)}
      <div class="debt-bars">
        {#each debt.byMonth as bucket}
          {@const max = Math.max(...debt.byMonth.map((m) => m.total), 1)}
          <div class="debt-col" title="{bucket.month}/{bucket.year} — {fmt(bucket.total)}">
            <div class="debt-bar" style="height: {(bucket.total / max) * 100}%"></div>
            <span class="debt-label">{String(bucket.month).padStart(2, "0")}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="metric-foot">
        <span>Nenhuma parcela pendente nos próximos meses.</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .metrics-panel {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .metric {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow);
    transition: box-shadow var(--transition), transform var(--transition);
  }
  .metric:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .metric-wide {
    grid-column: span 2;
  }
  .metric-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .metric-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
  }
  .metric-tag {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    background: var(--surface-hover);
    color: var(--text-secondary);
    white-space: nowrap;
  }
  .tag-good { background: var(--success-light); color: var(--success-text); }
  .tag-warn { background: rgba(245, 158, 11, 0.15); color: #92400e; }
  .tag-bad { background: var(--danger-light); color: var(--danger-text); }
  .tag-info { background: var(--info-light); color: var(--info-text); }
  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .metric-value.positive { color: var(--success); }
  .metric-value.negative { color: var(--danger); }
  .metric-unit {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-left: 4px;
  }
  .metric-bar {
    height: 6px;
    background: var(--border-light);
    border-radius: 100px;
    overflow: hidden;
  }
  .metric-bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .metric-foot {
    display: flex;
    justify-content: space-between;
    font-size: 0.74rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .metric-foot b {
    color: var(--text-secondary);
    font-weight: 600;
  }
  .metric-foot .good { color: var(--success); }
  .metric-foot .bad { color: var(--danger); }
  .stack-bar {
    display: flex;
    height: 14px;
    border-radius: 100px;
    overflow: hidden;
    background: var(--border-light);
  }
  .seg {
    height: 100%;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .seg-fixed { background: #6366f1; }
  .seg-variable { background: #f59e0b; }
  .seg-credit { background: #ec4899; }
  .seg-invested { background: #10b981; }
  .seg-free { background: var(--border); }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .lg {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;
  }
  .lg::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: currentColor;
    opacity: 0.85;
  }
  .lg-fixed { color: #6366f1; }
  .lg-variable { color: #f59e0b; }
  .lg-credit { color: #ec4899; }
  .lg-invested { color: #10b981; }
  .lg-free { color: var(--text-muted); }
  .debt-bars {
    display: flex;
    align-items: flex-end;
    height: 60px;
    gap: 4px;
    padding: 4px 0 0;
  }
  .debt-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
  }
  .debt-bar {
    width: 100%;
    min-height: 2px;
    background: linear-gradient(to top, var(--info), color-mix(in srgb, var(--info) 50%, transparent));
    border-radius: 3px 3px 0 0;
    transition: height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .debt-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 1100px) {
    .metrics-panel { grid-template-columns: repeat(2, 1fr); }
    .metric-wide { grid-column: span 2; }
  }
  @media (max-width: 600px) {
    .metrics-panel { grid-template-columns: 1fr; }
    .metric-wide { grid-column: span 1; }
  }

  @media (max-width: 760px) {
    .metrics-panel {
      display: flex;
      gap: 10px;
      margin: 0 -12px 16px;
      padding: 0 12px 5px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .metrics-panel::-webkit-scrollbar {
      display: none;
    }
    .metric,
    .metric-wide {
      flex: 0 0 min(84vw, 330px);
      grid-column: auto;
      scroll-snap-align: start;
      border-radius: 12px;
      padding: 13px 14px;
      box-shadow: none;
    }
    .metric:hover {
      transform: none;
      box-shadow: none;
    }
    .metric-head {
      align-items: flex-start;
    }
    .metric-label {
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      line-height: 1.25;
    }
    .metric-tag {
      max-width: 48%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metric-value {
      font-size: 1.32rem;
      line-height: 1.15;
      word-break: break-word;
    }
    .metric-foot {
      gap: 8px;
      line-height: 1.35;
    }
    .legend {
      gap: 6px 8px;
    }
    .debt-bars {
      height: 54px;
    }
  }
</style>
