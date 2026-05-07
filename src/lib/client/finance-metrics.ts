import type {
  CategoryBudget,
  CreditCardExpense,
  FinanceState,
  FixedExpense,
  Income,
  Investment,
  MonthRecord,
  MonthSummary,
  MonthlyExpense
} from './finance-data';

export interface MonthKey {
  month: number;
  year: number;
}

export interface SavingsBreakdown {
  income: number;
  expenses: number;
  investments: number;
  savings: number;
  rate: number;
}

export interface BurnRateInfo {
  variableSpent: number;
  variableBudget: number;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  perDayActual: number;
  perDayAllowed: number;
  projectedTotal: number;
  willOverflow: boolean;
  daysUntilOverflow: number | null;
}

export interface CommitmentBreakdown {
  income: number;
  fixed: number;
  variable: number;
  credit: number;
  invested: number;
  fixedPct: number;
  variablePct: number;
  creditPct: number;
  investedPct: number;
  freePct: number;
}

export interface CreditCardRunRate {
  spent: number;
  daysElapsed: number;
  daysInMonth: number;
  perDay: number;
  projected: number;
}

export interface FutureDebtMonth {
  month: number;
  year: number;
  total: number;
  count: number;
}

export interface FutureDebt {
  totalPending: number;
  countPending: number;
  byMonth: FutureDebtMonth[];
}

export interface NetWorthPoint {
  month: number;
  year: number;
  label: string;
  income: number;
  expenses: number;
  invested: number;
  netFlow: number;
  cumulativeNet: number;
  cumulativeInvested: number;
}

export interface CategoryDelta {
  id: number;
  name: string;
  color: string;
  current: number;
  previous: number;
  diff: number;
  pct: number;
}

export interface TopExpenseEntry {
  source: 'fixed' | 'monthly' | 'credit';
  id: number;
  name: string;
  value: number;
  category_name?: string;
  category_color?: string;
  date?: string;
}

export interface RecurringExpense {
  name: string;
  normalizedName: string;
  category_id: number | null;
  category_name?: string;
  monthsSeen: number;
  averageValue: number;
  lastValue: number;
  lastMonth: MonthKey;
  alreadyFixed: boolean;
  ids: number[];
}

export interface Forecast {
  month: number;
  year: number;
  expectedIncome: number;
  expectedFixed: number;
  expectedVariable: number;
  expectedCreditFromInstallments: number;
  totalExpense: number;
  expectedBalance: number;
  basis: number;
}

export interface EmergencyReserve {
  invested: number;
  monthlyExpenseTarget: number;
  monthsCovered: number;
  targetMonths: number;
  targetAmount: number;
  progressPct: number;
  shortfall: number;
}

export interface WhatIfResult {
  categoryId: number | null;
  categoryName: string;
  monthlyCut: number;
  yearlyCut: number;
  newBalance: number;
  newSavingRate: number;
}

export interface Insight {
  level: 'info' | 'positive' | 'warning' | 'danger';
  title: string;
  detail?: string;
}

export const MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
] as const;

export const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez'
] as const;

export function compareMonthKey(a: MonthKey, b: MonthKey) {
  return a.year - b.year || a.month - b.month;
}

export function addMonths(key: MonthKey, offset: number): MonthKey {
  const total = key.year * 12 + (key.month - 1) + offset;
  const year = Math.floor(total / 12);
  const month = (total % 12 + 12) % 12 + 1;
  return { month, year };
}

export function monthKeyEquals(a: MonthKey, b: MonthKey) {
  return a.month === b.month && a.year === b.year;
}

export function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function isCurrentMonth(key: MonthKey, today = new Date()) {
  return key.month === today.getMonth() + 1 && key.year === today.getFullYear();
}

export function elapsedDays(key: MonthKey, today = new Date()) {
  const total = daysInMonth(key.month, key.year);
  if (key.year < today.getFullYear() || (key.year === today.getFullYear() && key.month < today.getMonth() + 1)) {
    return total;
  }
  if (key.year > today.getFullYear() || (key.year === today.getFullYear() && key.month > today.getMonth() + 1)) {
    return 0;
  }
  return Math.min(total, today.getDate());
}

export function savingRate(summary: MonthSummary): SavingsBreakdown {
  const income = summary.totalIncome;
  const expenses = summary.totalExpenses;
  const investments = summary.totalInvestments;
  const savings = income - expenses - investments;
  const rate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  return { income, expenses, investments, savings, rate };
}

export function movingAverageSavingRate(summaries: MonthSummary[], windowMonths: number) {
  if (summaries.length === 0) return 0;
  const slice = summaries.slice(-windowMonths);
  const totalIncome = slice.reduce((sum, s) => sum + s.totalIncome, 0);
  const totalExpenses = slice.reduce((sum, s) => sum + s.totalExpenses, 0);
  if (totalIncome <= 0) return 0;
  return ((totalIncome - totalExpenses) / totalIncome) * 100;
}

export function categoryCommitment(summary: MonthSummary): CommitmentBreakdown {
  const income = summary.totalIncome;
  const fixed = summary.totalFixed;
  const variable = summary.totalMonthly;
  const credit = summary.totalCreditCard;
  const invested = summary.totalInvestments;
  const safe = income > 0 ? income : Math.max(fixed + variable + credit + invested, 1);
  return {
    income,
    fixed,
    variable,
    credit,
    invested,
    fixedPct: (fixed / safe) * 100,
    variablePct: (variable / safe) * 100,
    creditPct: (credit / safe) * 100,
    investedPct: (invested / safe) * 100,
    freePct: income > 0 ? Math.max(0, ((income - fixed - variable - credit - invested) / income) * 100) : 0
  };
}

export function variableBudget(summary: MonthSummary) {
  return summary.byCategory
    .filter((cat) => cat.expected > 0)
    .reduce((sum, cat) => sum + cat.expected, 0);
}

export function variableSpent(summary: MonthSummary) {
  return summary.totalMonthly + summary.totalCreditCard;
}

export function burnRate(summary: MonthSummary, today = new Date()): BurnRateInfo {
  const dim = daysInMonth(summary.month, summary.year);
  const elapsed = elapsedDays({ month: summary.month, year: summary.year }, today);
  const remaining = Math.max(0, dim - elapsed);
  const spent = variableSpent(summary);
  const budget = variableBudget(summary);
  const perDayActual = elapsed > 0 ? spent / elapsed : 0;
  const perDayAllowed = budget > 0 && dim > 0 ? budget / dim : 0;
  const projectedTotal = perDayActual * dim;
  const willOverflow = budget > 0 && projectedTotal > budget;

  let daysUntilOverflow: number | null = null;
  if (budget > 0 && perDayActual > 0) {
    if (spent >= budget) {
      daysUntilOverflow = 0;
    } else {
      const totalDaysToOverflow = budget / perDayActual;
      const remainingToOverflow = totalDaysToOverflow - elapsed;
      if (remainingToOverflow <= remaining) {
        daysUntilOverflow = Math.max(0, Math.round(remainingToOverflow));
      }
    }
  }

  return {
    variableSpent: spent,
    variableBudget: budget,
    daysElapsed: elapsed,
    daysInMonth: dim,
    daysRemaining: remaining,
    perDayActual,
    perDayAllowed,
    projectedTotal,
    willOverflow,
    daysUntilOverflow
  };
}

export function creditCardRunRate(summary: MonthSummary, today = new Date()): CreditCardRunRate {
  const spent = summary.totalCreditCard;
  const dim = daysInMonth(summary.month, summary.year);
  const elapsed = elapsedDays({ month: summary.month, year: summary.year }, today);
  const perDay = elapsed > 0 ? spent / elapsed : 0;
  const projected = perDay * dim;
  return { spent, daysElapsed: elapsed, daysInMonth: dim, perDay, projected };
}

export function futureDebt(state: FinanceState, fromMonth: MonthKey, monthsAhead = 12): FutureDebt {
  const monthsById = new Map<number, MonthRecord>();
  for (const month of state.months) {
    monthsById.set(month.id, month);
  }

  const buckets = new Map<string, FutureDebtMonth>();
  for (let offset = 1; offset <= monthsAhead; offset++) {
    const key = addMonths(fromMonth, offset);
    buckets.set(`${key.year}-${key.month}`, {
      month: key.month,
      year: key.year,
      total: 0,
      count: 0
    });
  }

  let totalPending = 0;
  let countPending = 0;
  for (const expense of state.credit_card_expenses) {
    const month = monthsById.get(expense.month_id);
    if (!month) continue;
    const cmp = compareMonthKey(month, fromMonth);
    if (cmp <= 0) continue;
    if (expense.paid) continue;
    const key = `${month.year}-${month.month}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += expense.value;
    bucket.count += 1;
    totalPending += expense.value;
    countPending += 1;
  }

  return {
    totalPending,
    countPending,
    byMonth: [...buckets.values()].sort((a, b) => compareMonthKey(a, b))
  };
}

export interface NetWorthOptions {
  monthsBack?: number;
  endMonth: MonthKey;
}

export function netWorthSeries(
  state: FinanceState,
  options: NetWorthOptions
): NetWorthPoint[] {
  const months = options.monthsBack ?? 12;
  const start = addMonths(options.endMonth, -(months - 1));

  const monthsById = new Map<number, MonthRecord>();
  for (const month of state.months) {
    monthsById.set(month.id, month);
  }
  const incomeByMonth = groupByMonth(state.income, monthsById);
  const fixedByMonth = groupByMonth(state.fixed_expenses, monthsById);
  const variableByMonth = groupByMonth(state.monthly_expenses, monthsById);
  const creditByMonth = groupByMonth(state.credit_card_expenses, monthsById);
  const investByMonth = groupByMonth(state.investments, monthsById);

  const points: NetWorthPoint[] = [];
  let cumulativeNet = 0;
  let cumulativeInvested = 0;

  for (let offset = 0; offset < months; offset++) {
    const key = addMonths(start, offset);
    const id = `${key.year}-${key.month}`;
    const income = sumValues(incomeByMonth.get(id));
    const expenses =
      sumValues(fixedByMonth.get(id)) +
      sumValues(variableByMonth.get(id)) +
      sumValues(creditByMonth.get(id));
    const invested = sumValues(investByMonth.get(id));
    const netFlow = income - expenses - invested;
    cumulativeNet += netFlow;
    cumulativeInvested += invested;
    points.push({
      month: key.month,
      year: key.year,
      label: `${MONTHS_SHORT[key.month - 1]}/${String(key.year).slice(-2)}`,
      income,
      expenses,
      invested,
      netFlow,
      cumulativeNet,
      cumulativeInvested
    });
  }

  return points;
}

function groupByMonth<T extends { month_id: number; value: number }>(
  rows: T[],
  monthsById: Map<number, MonthRecord>
) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const month = monthsById.get(row.month_id);
    if (!month) continue;
    const key = `${month.year}-${month.month}`;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function sumValues<T extends { value: number }>(rows?: T[]) {
  if (!rows) return 0;
  return rows.reduce((sum, row) => sum + row.value, 0);
}

export function categoryDeltas(curr: MonthSummary, prev: MonthSummary): CategoryDelta[] {
  return curr.byCategory
    .map((cat) => {
      const prevCat = prev.byCategory.find((p) => p.id === cat.id);
      const previous = prevCat?.spent ?? 0;
      const diff = cat.spent - previous;
      const pct = previous > 0 ? (diff / previous) * 100 : cat.spent > 0 ? 100 : 0;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        current: cat.spent,
        previous,
        diff,
        pct
      };
    })
    .filter((d) => d.current > 0 || d.previous > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

export function topExpenses(summary: MonthSummary, limit = 5): TopExpenseEntry[] {
  const entries: TopExpenseEntry[] = [];
  for (const expense of summary.fixed) {
    entries.push({
      source: 'fixed',
      id: expense.id,
      name: expense.name,
      value: expense.value,
      category_name: expense.category_name,
      category_color: expense.category_color
    });
  }
  for (const expense of summary.monthly) {
    entries.push({
      source: 'monthly',
      id: expense.id,
      name: expense.name,
      value: expense.value,
      date: expense.date,
      category_name: expense.category_name,
      category_color: expense.category_color
    });
  }
  for (const expense of summary.creditCard) {
    entries.push({
      source: 'credit',
      id: expense.id,
      name: expense.name,
      value: expense.value,
      date: expense.date,
      category_name: expense.category_name,
      category_color: expense.category_color
    });
  }
  return entries.sort((a, b) => b.value - a.value).slice(0, limit);
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectRecurring(
  state: FinanceState,
  upTo: MonthKey,
  options: { minMonths?: number; lookbackMonths?: number } = {}
): RecurringExpense[] {
  const minMonths = options.minMonths ?? 3;
  const lookback = options.lookbackMonths ?? 6;

  const earliest = addMonths(upTo, -(lookback - 1));
  const monthsById = new Map<number, MonthRecord>();
  for (const month of state.months) {
    monthsById.set(month.id, month);
  }

  const buckets = new Map<string, MonthlyExpense[]>();
  for (const expense of state.monthly_expenses) {
    const month = monthsById.get(expense.month_id);
    if (!month) continue;
    if (compareMonthKey(month, earliest) < 0 || compareMonthKey(month, upTo) > 0) continue;
    const key = normalizeName(expense.name);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(expense);
    else buckets.set(key, [expense]);
  }

  const fixedNames = new Set<string>();
  for (const fixed of state.fixed_expenses) {
    const month = monthsById.get(fixed.month_id);
    if (!month) continue;
    if (compareMonthKey(month, earliest) < 0 || compareMonthKey(month, upTo) > 0) continue;
    fixedNames.add(normalizeName(fixed.name));
  }

  const categories = new Map(state.categories.map((cat) => [cat.id, cat]));
  const result: RecurringExpense[] = [];

  for (const [key, expenses] of buckets) {
    const monthsSet = new Set<string>();
    for (const expense of expenses) {
      const month = monthsById.get(expense.month_id);
      if (!month) continue;
      monthsSet.add(`${month.year}-${month.month}`);
    }
    if (monthsSet.size < minMonths) continue;
    const sorted = [...expenses].sort((a, b) => {
      const am = monthsById.get(a.month_id)!;
      const bm = monthsById.get(b.month_id)!;
      return compareMonthKey(bm, am);
    });
    const last = sorted[0];
    const lastMonthRec = monthsById.get(last.month_id)!;
    const total = expenses.reduce((sum, e) => sum + e.value, 0);
    const cat = last.category_id ? categories.get(last.category_id) : null;
    result.push({
      name: last.name,
      normalizedName: key,
      category_id: last.category_id,
      category_name: cat?.name,
      monthsSeen: monthsSet.size,
      averageValue: total / expenses.length,
      lastValue: last.value,
      lastMonth: { month: lastMonthRec.month, year: lastMonthRec.year },
      alreadyFixed: fixedNames.has(key),
      ids: expenses.map((e) => e.id)
    });
  }

  return result
    .filter((r) => !r.alreadyFixed)
    .sort((a, b) => b.monthsSeen - a.monthsSeen || b.averageValue - a.averageValue);
}

export function forecastNextMonth(
  state: FinanceState,
  current: MonthKey,
  options: { lookbackMonths?: number } = {}
): Forecast {
  const lookback = options.lookbackMonths ?? 3;
  const monthsById = new Map<number, MonthRecord>();
  for (const month of state.months) {
    monthsById.set(month.id, month);
  }

  const start = addMonths(current, -(lookback - 1));

  let totalIncome = 0;
  let totalVariable = 0;
  let basis = 0;

  for (let offset = 0; offset < lookback; offset++) {
    const key = addMonths(start, offset);
    const month = state.months.find((m) => monthKeyEquals(m, key));
    if (!month) continue;
    basis += 1;
    totalIncome += sumByMonth(state.income, month.id, (i) => i.value);
    totalVariable += sumByMonth(state.monthly_expenses, month.id, (e) => e.value);
  }

  const expectedIncome = basis > 0 ? totalIncome / basis : 0;
  const expectedVariable = basis > 0 ? totalVariable / basis : 0;

  const next = addMonths(current, 1);
  const nextMonth = state.months.find((m) => monthKeyEquals(m, next));
  let expectedFixed = 0;
  let expectedCreditFromInstallments = 0;
  if (nextMonth) {
    expectedFixed = sumByMonth(state.fixed_expenses, nextMonth.id, (e) => e.value);
    expectedCreditFromInstallments = sumByMonth(
      state.credit_card_expenses,
      nextMonth.id,
      (e) => e.value
    );
  } else {
    const currentMonthRec = state.months.find((m) => monthKeyEquals(m, current));
    if (currentMonthRec) {
      expectedFixed = sumByMonth(state.fixed_expenses, currentMonthRec.id, (e) => e.value);
    }
  }

  const totalExpense = expectedFixed + expectedVariable + expectedCreditFromInstallments;
  const expectedBalance = expectedIncome - totalExpense;

  return {
    month: next.month,
    year: next.year,
    expectedIncome,
    expectedFixed,
    expectedVariable,
    expectedCreditFromInstallments,
    totalExpense,
    expectedBalance,
    basis
  };
}

function sumByMonth<T extends { month_id: number }>(
  rows: T[],
  monthId: number,
  getValue: (row: T) => number
) {
  let total = 0;
  for (const row of rows) {
    if (row.month_id === monthId) total += getValue(row);
  }
  return total;
}

export function emergencyReserve(
  state: FinanceState,
  current: MonthKey,
  targetMonths = 6,
  options: { lookbackMonths?: number } = {}
): EmergencyReserve {
  const lookback = options.lookbackMonths ?? 3;
  const monthsById = new Map<number, MonthRecord>();
  for (const month of state.months) {
    monthsById.set(month.id, month);
  }

  let totalExpense = 0;
  let basis = 0;
  for (let offset = 0; offset < lookback; offset++) {
    const key = addMonths(current, -offset);
    const month = state.months.find((m) => monthKeyEquals(m, key));
    if (!month) continue;
    const fixed = sumByMonth(state.fixed_expenses, month.id, (e) => e.value);
    const variable = sumByMonth(state.monthly_expenses, month.id, (e) => e.value);
    const credit = sumByMonth(state.credit_card_expenses, month.id, (e) => e.value);
    totalExpense += fixed + variable + credit;
    basis += 1;
  }
  const monthlyExpenseTarget = basis > 0 ? totalExpense / basis : 0;
  const invested = state.investments.reduce((sum, item) => sum + item.value, 0);
  const targetAmount = monthlyExpenseTarget * targetMonths;
  const monthsCovered = monthlyExpenseTarget > 0 ? invested / monthlyExpenseTarget : 0;
  const progressPct = targetAmount > 0 ? (invested / targetAmount) * 100 : 0;
  const shortfall = Math.max(0, targetAmount - invested);

  return {
    invested,
    monthlyExpenseTarget,
    monthsCovered,
    targetMonths,
    targetAmount,
    progressPct,
    shortfall
  };
}

export function whatIfCutCategory(
  summary: MonthSummary,
  categoryId: number | null,
  percentCut: number
): WhatIfResult {
  const cat = summary.byCategory.find((c) => c.id === categoryId);
  const baseSpent = cat?.spent ?? 0;
  const monthlyCut = baseSpent * (percentCut / 100);
  const yearlyCut = monthlyCut * 12;
  const newBalance = summary.balance + monthlyCut;
  const adjustedExpenses = summary.totalExpenses - monthlyCut;
  const newSavingRate =
    summary.totalIncome > 0
      ? ((summary.totalIncome - adjustedExpenses) / summary.totalIncome) * 100
      : 0;
  return {
    categoryId,
    categoryName: cat?.name ?? '',
    monthlyCut,
    yearlyCut,
    newBalance,
    newSavingRate
  };
}

export function buildInsights(params: {
  current: MonthSummary;
  previous: MonthSummary;
  burn: BurnRateInfo;
  reserve: EmergencyReserve;
  forecast: Forecast;
  recurring: RecurringExpense[];
  futureDebt: FutureDebt;
  deltas: CategoryDelta[];
  savingsBreakdown: SavingsBreakdown;
}): Insight[] {
  const out: Insight[] = [];
  const { current, previous, burn, reserve, forecast, recurring, futureDebt: debt, deltas, savingsBreakdown } = params;

  if (current.totalIncome === 0 && current.totalExpenses === 0) {
    out.push({
      level: 'info',
      title: 'Sem dados neste mês ainda — comece registrando suas entradas e gastos.'
    });
    return out;
  }

  if (savingsBreakdown.rate >= 20) {
    out.push({
      level: 'positive',
      title: `Taxa de poupança de ${savingsBreakdown.rate.toFixed(0)}% — acima do recomendado (≥ 20%).`
    });
  } else if (current.totalIncome > 0 && savingsBreakdown.rate < 0) {
    out.push({
      level: 'danger',
      title: `Você está gastando mais do que ganha (${savingsBreakdown.rate.toFixed(0)}%).`,
      detail: `Saldo do mês: ${formatBRL(current.balance)}.`
    });
  } else if (current.totalIncome > 0 && savingsBreakdown.rate < 10) {
    out.push({
      level: 'warning',
      title: `Taxa de poupança baixa: ${savingsBreakdown.rate.toFixed(0)}%.`,
      detail: 'Tente abrir espaço cortando gastos variáveis.'
    });
  }

  if (burn.willOverflow) {
    const over = burn.projectedTotal - burn.variableBudget;
    out.push({
      level: 'warning',
      title: `No ritmo atual, o orçamento variável estoura em ${formatBRL(over)}.`,
      detail:
        burn.daysUntilOverflow !== null
          ? `Dias até estourar: ${burn.daysUntilOverflow}.`
          : undefined
    });
  } else if (burn.variableBudget > 0 && burn.daysElapsed > 7) {
    const remaining = burn.variableBudget - burn.variableSpent;
    out.push({
      level: 'positive',
      title: `Orçamento variável saudável: ${formatBRL(remaining)} disponíveis para o resto do mês.`
    });
  }

  if (previous.totalExpenses > 0) {
    const diff = current.totalExpenses - previous.totalExpenses;
    if (Math.abs(diff) >= previous.totalExpenses * 0.1) {
      const pct = (diff / previous.totalExpenses) * 100;
      out.push({
        level: diff > 0 ? 'warning' : 'positive',
        title: `Gastos ${diff > 0 ? 'subiram' : 'caíram'} ${Math.abs(pct).toFixed(0)}% vs o mês passado.`,
        detail: `${formatBRL(previous.totalExpenses)} → ${formatBRL(current.totalExpenses)}`
      });
    }
  }

  if (deltas.length > 0) {
    const top = deltas[0];
    if (Math.abs(top.diff) >= 50) {
      out.push({
        level: top.diff > 0 ? 'warning' : 'positive',
        title: `${top.name} ${top.diff > 0 ? 'subiu' : 'caiu'} ${formatBRL(Math.abs(top.diff))} vs mês anterior.`,
        detail: `${formatBRL(top.previous)} → ${formatBRL(top.current)}`
      });
    }
  }

  if (debt.totalPending > 0) {
    out.push({
      level: debt.totalPending > current.totalIncome ? 'danger' : 'info',
      title: `${formatBRL(debt.totalPending)} em parcelas futuras nos próximos meses.`,
      detail: `${debt.countPending} parcela(s) pendentes.`
    });
  }

  if (reserve.invested > 0) {
    if (reserve.monthsCovered >= reserve.targetMonths) {
      out.push({
        level: 'positive',
        title: `Reserva de emergência completa: ${reserve.monthsCovered.toFixed(1)} meses cobertos.`
      });
    } else if (reserve.monthsCovered >= 1) {
      out.push({
        level: 'info',
        title: `Reserva cobre ${reserve.monthsCovered.toFixed(1)} meses (meta: ${reserve.targetMonths}).`,
        detail: `Falta ${formatBRL(reserve.shortfall)} para atingir a meta.`
      });
    } else {
      out.push({
        level: 'warning',
        title: `Reserva ainda baixa: cobre menos de 1 mês de despesas.`
      });
    }
  }

  if (forecast.expectedBalance < 0 && forecast.basis > 0) {
    out.push({
      level: 'warning',
      title: `Previsão para o próximo mês: saldo negativo de ${formatBRL(Math.abs(forecast.expectedBalance))}.`,
      detail: `Receita esperada ${formatBRL(forecast.expectedIncome)} vs ${formatBRL(forecast.totalExpense)} de despesas.`
    });
  }

  if (recurring.length > 0) {
    out.push({
      level: 'info',
      title: `${recurring.length} gasto(s) variável(eis) parecem recorrentes — considere virar fixos.`,
      detail: recurring.slice(0, 3).map((r) => r.name).join(', ')
    });
  }

  return out;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface DueAlert {
  expenseId: number;
  name: string;
  value: number;
  dueDay: number;
  daysUntil: number;
  monthKey: string;
  paid: boolean;
}

export function pendingDueAlerts(
  state: FinanceState,
  today = new Date()
): DueAlert[] {
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const monthRecord = state.months.find((m) => m.month === month && m.year === year);
  if (!monthRecord) return [];

  const dim = daysInMonth(month, year);
  const alerts: DueAlert[] = [];
  const aheadDays = state.settings.due_alert_days_ahead;

  for (const expense of state.fixed_expenses) {
    if (expense.month_id !== monthRecord.id) continue;
    if (!expense.due_day) continue;
    const dueDay = Math.min(dim, Math.max(1, expense.due_day));
    const daysUntil = dueDay - today.getDate();
    if (daysUntil > aheadDays) continue;
    if (daysUntil < -3) continue;
    alerts.push({
      expenseId: expense.id,
      name: expense.name,
      value: expense.value,
      dueDay,
      daysUntil,
      monthKey: `${year}-${month}-${expense.id}`,
      paid: expense.paid > 0
    });
  }

  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

