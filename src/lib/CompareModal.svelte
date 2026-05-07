<script lang="ts">
  import Modal from "$lib/Modal.svelte";
  import { FinanceDataStore, type MonthSummary } from "$lib/client/finance-data";
  import { MONTHS_FULL } from "$lib/client/finance-metrics";

  interface Props {
    open: boolean;
    onClose: () => void;
    finance: FinanceDataStore | null;
    initialMonth: number;
    initialYear: number;
  }

  let { open, onClose, finance, initialMonth, initialYear }: Props = $props();

  let leftMonth = $state(1);
  let leftYear = $state(2024);
  let rightMonth = $state(12);
  let rightYear = $state(2024);
  let initialized = $state(false);

  $effect(() => {
    if (open && !initialized) {
      leftMonth = initialMonth;
      leftYear = initialYear;
      rightMonth = initialMonth === 1 ? 12 : initialMonth - 1;
      rightYear = initialMonth === 1 ? initialYear - 1 : initialYear;
      initialized = true;
    } else if (!open) {
      initialized = false;
    }
  });

  let leftSummary = $derived<MonthSummary | null>(
    finance && open ? finance.peekMonthSummary(leftMonth, leftYear) : null,
  );
  let rightSummary = $derived<MonthSummary | null>(
    finance && open ? finance.peekMonthSummary(rightMonth, rightYear) : null,
  );

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function delta(curr: number, prev: number) {
    const diff = curr - prev;
    if (prev === 0 && curr === 0) return null;
    if (prev === 0) return { diff, pct: 100 };
    return { diff, pct: (diff / Math.abs(prev)) * 100 };
  }

  function deltaLabel(d: ReturnType<typeof delta>, invert = false) {
    if (!d) return "—";
    const arrow = d.diff > 0 ? "↑" : d.diff < 0 ? "↓" : "·";
    return `${arrow} ${Math.abs(d.pct).toFixed(0)}%`;
  }

  function deltaClass(d: ReturnType<typeof delta>, invert = false) {
    if (!d || d.diff === 0) return "";
    const positive = invert ? d.diff < 0 : d.diff > 0;
    return positive ? "good" : "bad";
  }
</script>

<Modal {open} {onClose} title="Comparar meses" size="lg">
  <div class="modal-body compare-body">
    <div class="selectors">
      <div class="selector">
        <label for="cmp-l-month">Mês A</label>
        <div class="picker">
          <select id="cmp-l-month" class="select" bind:value={leftMonth}>
            {#each MONTHS_FULL as name, i}
              <option value={i + 1}>{name}</option>
            {/each}
          </select>
          <input class="input year-input" type="number" bind:value={leftYear} />
        </div>
      </div>
      <span class="vs">vs</span>
      <div class="selector">
        <label for="cmp-r-month">Mês B</label>
        <div class="picker">
          <select id="cmp-r-month" class="select" bind:value={rightMonth}>
            {#each MONTHS_FULL as name, i}
              <option value={i + 1}>{name}</option>
            {/each}
          </select>
          <input class="input year-input" type="number" bind:value={rightYear} />
        </div>
      </div>
    </div>

    {#if leftSummary && rightSummary}
      {@const dExpenses = delta(leftSummary.totalExpenses, rightSummary.totalExpenses)}
      {@const dIncome = delta(leftSummary.totalIncome, rightSummary.totalIncome)}
      {@const dBalance = delta(leftSummary.balance, rightSummary.balance)}
      {@const dInvested = delta(leftSummary.totalInvestments, rightSummary.totalInvestments)}

      <div class="compare-grid">
        <div class="cmp-row">
          <span class="cmp-label">Receita</span>
          <span class="cmp-val mono positive">{fmt(leftSummary.totalIncome)}</span>
          <span class="cmp-delta {deltaClass(dIncome)}">{deltaLabel(dIncome)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalIncome)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">Despesas</span>
          <span class="cmp-val mono negative">{fmt(leftSummary.totalExpenses)}</span>
          <span class="cmp-delta {deltaClass(dExpenses, true)}">{deltaLabel(dExpenses)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalExpenses)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">Saldo</span>
          <span class="cmp-val mono" class:positive={leftSummary.balance >= 0} class:negative={leftSummary.balance < 0}>
            {fmt(leftSummary.balance)}
          </span>
          <span class="cmp-delta {deltaClass(dBalance)}">{deltaLabel(dBalance)}</span>
          <span class="cmp-val mono right" class:positive={rightSummary.balance >= 0} class:negative={rightSummary.balance < 0}>
            {fmt(rightSummary.balance)}
          </span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">Investimentos</span>
          <span class="cmp-val mono">{fmt(leftSummary.totalInvestments)}</span>
          <span class="cmp-delta {deltaClass(dInvested)}">{deltaLabel(dInvested)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalInvestments)}</span>
        </div>
        <div class="cmp-row sub">
          <span class="cmp-label">Fixos</span>
          <span class="cmp-val mono">{fmt(leftSummary.totalFixed)}</span>
          <span class="cmp-delta">{deltaLabel(delta(leftSummary.totalFixed, rightSummary.totalFixed), true)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalFixed)}</span>
        </div>
        <div class="cmp-row sub">
          <span class="cmp-label">Mensais</span>
          <span class="cmp-val mono">{fmt(leftSummary.totalMonthly)}</span>
          <span class="cmp-delta">{deltaLabel(delta(leftSummary.totalMonthly, rightSummary.totalMonthly), true)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalMonthly)}</span>
        </div>
        <div class="cmp-row sub">
          <span class="cmp-label">Cartão</span>
          <span class="cmp-val mono">{fmt(leftSummary.totalCreditCard)}</span>
          <span class="cmp-delta">{deltaLabel(delta(leftSummary.totalCreditCard, rightSummary.totalCreditCard), true)}</span>
          <span class="cmp-val mono right">{fmt(rightSummary.totalCreditCard)}</span>
        </div>
      </div>

      <div class="cat-section">
        <h3>Categorias</h3>
        <div class="cat-list">
          {#each leftSummary.byCategory.filter((c) => c.spent > 0 || (rightSummary?.byCategory.find((p) => p.id === c.id)?.spent ?? 0) > 0) as cat}
            {@const prevCat = rightSummary?.byCategory.find((p) => p.id === cat.id)}
            {@const prevSpent = prevCat?.spent ?? 0}
            {@const cd = delta(cat.spent, prevSpent)}
            <div class="cat-row">
              <span class="dot" style="background: {cat.color}"></span>
              <span class="cat-name">{cat.name}</span>
              <span class="cat-val mono">{fmt(cat.spent)}</span>
              <span class="cat-delta {deltaClass(cd, true)}">{deltaLabel(cd)}</span>
              <span class="cat-val mono right">{fmt(prevSpent)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style>
  .compare-body {
    gap: 18px;
  }
  .selectors {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 14px;
    align-items: center;
  }
  .selector {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .selector label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .picker {
    display: flex;
    gap: 6px;
  }
  .year-input {
    width: 80px;
  }
  .vs {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-top: 18px;
  }
  .compare-grid {
    background: var(--surface-hover);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 6px;
    display: flex;
    flex-direction: column;
  }
  .cmp-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr auto 1fr;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 6px;
    transition: background var(--transition);
  }
  .cmp-row:hover { background: var(--surface); }
  .cmp-row.sub {
    font-size: 0.84rem;
    color: var(--text-secondary);
  }
  .cmp-label {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text);
  }
  .cmp-row.sub .cmp-label {
    padding-left: 12px;
    color: var(--text-secondary);
  }
  .cmp-val {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .cmp-val.right {
    text-align: right;
    color: var(--text-muted);
  }
  .cmp-delta {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-muted);
    min-width: 60px;
    text-align: center;
  }
  .cmp-delta.good { color: var(--success); }
  .cmp-delta.bad { color: var(--danger); }
  .cat-section h3 {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin: 0 0 10px;
  }
  .cat-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cat-row {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto;
    gap: 10px;
    padding: 6px 10px;
    align-items: center;
    border-radius: 6px;
    font-size: 0.84rem;
  }
  .cat-row:hover { background: var(--surface-hover); }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .cat-name {
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cat-val {
    font-variant-numeric: tabular-nums;
    min-width: 90px;
    text-align: right;
  }
  .cat-val.right {
    color: var(--text-muted);
  }
  .cat-delta {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--text-muted);
    min-width: 50px;
    text-align: right;
  }
  .cat-delta.good { color: var(--success); }
  .cat-delta.bad { color: var(--danger); }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }
  .mono { font-variant-numeric: tabular-nums; }

  @media (max-width: 720px) {
    .selectors { grid-template-columns: 1fr; }
    .vs { margin: 0; text-align: center; }
    .cmp-row, .cat-row {
      grid-template-columns: 1fr auto auto;
      gap: 8px;
    }
    .cmp-val.right, .cat-val.right { display: none; }
  }
</style>
