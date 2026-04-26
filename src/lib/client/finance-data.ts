export const STORAGE_KEY = 'finance:data:v1';

const BACKUP_TABLES = [
  'categories',
  'months',
  'income',
  'fixed_expenses',
  'monthly_expenses',
  'credit_card_expenses',
  'investments',
  'category_budgets'
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface MonthRecord {
  id: number;
  month: number;
  year: number;
}

export interface Income {
  id: number;
  month_id: number;
  name: string;
  value: number;
}

export interface FixedExpense {
  id: number;
  month_id: number;
  name: string;
  paid: number;
  payment_type: string;
  category_id: number | null;
  value: number;
  payment_code: string | null;
  payment_code_type: string | null;
}

export interface MonthlyExpense {
  id: number;
  month_id: number;
  name: string;
  paid: number;
  date: string;
  category_id: number | null;
  value: number;
  payment_code: string | null;
  payment_code_type: string | null;
}

export interface CreditCardExpense {
  id: number;
  month_id: number;
  name: string;
  paid: number;
  total_installments: number;
  current_installment: number;
  date: string;
  category_id: number | null;
  value: number;
  original_expense_id: number | null;
  payment_code: string | null;
  payment_code_type: string | null;
}

export interface Investment {
  id: number;
  month_id: number;
  name: string;
  value: number;
}

export interface CategoryBudget {
  id: number;
  month_id: number;
  category_id: number;
  expected_value: number;
}

export interface FinanceState {
  categories: Category[];
  months: MonthRecord[];
  income: Income[];
  fixed_expenses: FixedExpense[];
  monthly_expenses: MonthlyExpense[];
  credit_card_expenses: CreditCardExpense[];
  investments: Investment[];
  category_budgets: CategoryBudget[];
}

export interface FinanceBackup {
  meta: {
    app: 'finance';
    formatVersion: 1;
    exportedAt: string;
  };
  data: FinanceState;
}

type ExpenseWithCategory<T> = T & {
  category_name?: string;
  category_color?: string;
};

export interface MonthSummary {
  month: number;
  year: number;
  monthId: number;
  totalFixed: number;
  totalMonthly: number;
  totalCreditCard: number;
  totalExpenses: number;
  totalIncome: number;
  totalInvestments: number;
  balance: number;
  debitTotal: number;
  creditTotal: number;
  byCategory: (Category & {
    spent: number;
    expected: number;
    percentage: number;
  })[];
  fixed: ExpenseWithCategory<FixedExpense>[];
  monthly: ExpenseWithCategory<MonthlyExpense>[];
  creditCard: ExpenseWithCategory<CreditCardExpense>[];
  income: Income[];
  investments: Investment[];
  categories: Category[];
}

const DEFAULT_CATEGORIES = [
  ['Mercado', '#6b7280'],
  ['Despesas eventuais', '#f59e0b'],
  ['Necessidades', '#3b82f6'],
  ['Roupa', '#ec4899'],
  ['Saúde', '#f97316'],
  ['Presentes', '#a855f7'],
  ['Beleza', '#14b8a6'],
  ['Desenvolvimento', '#6366f1'],
  ['Lazer', '#22c55e'],
  ['Eletrônicos', '#eab308'],
  ['Assinaturas', '#64748b'],
  ['Uber/transporte', '#78716c'],
  ['IFood/restaurante', '#ef4444'],
  ['Aluguel', '#0ea5e9'],
  ['Contas', '#e11d48'],
  ['Móveis', '#8b5cf6']
] as const;

export function createInitialState(): FinanceState {
  return {
    categories: DEFAULT_CATEGORIES.map(([name, color], index) => ({
      id: index + 1,
      name,
      color,
      sort_order: index
    })),
    months: [],
    income: [],
    fixed_expenses: [],
    monthly_expenses: [],
    credit_card_expenses: [],
    investments: [],
    category_budgets: []
  };
}

export function createEmptyMonthSummary(month: number, year: number): MonthSummary {
  const categories = createInitialState().categories;

  return {
    month,
    year,
    monthId: 0,
    totalFixed: 0,
    totalMonthly: 0,
    totalCreditCard: 0,
    totalExpenses: 0,
    totalIncome: 0,
    totalInvestments: 0,
    balance: 0,
    debitTotal: 0,
    creditTotal: 0,
    byCategory: categories.map((category) => ({
      ...category,
      spent: 0,
      expected: 0,
      percentage: 0
    })),
    fixed: [],
    monthly: [],
    creditCard: [],
    income: [],
    investments: [],
    categories
  };
}

export class FinanceDataStore {
  private state: FinanceState;
  private storage: StorageLike | null;

  constructor(options: { storage?: StorageLike | null; state?: FinanceState } = {}) {
    this.storage = options.storage ?? getBrowserStorage();
    this.state = normalizeState(options.state ?? loadState(this.storage));
    this.save();
  }

  getSnapshot() {
    return clone(this.state);
  }

  getOrCreateMonth(month: number, year: number) {
    const normalizedMonth = clampMonth(month);
    const normalizedYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
    const existing = this.state.months.find((item) => item.month === normalizedMonth && item.year === normalizedYear);

    if (existing) return clone(existing);

    const created: MonthRecord = {
      id: this.nextId('months'),
      month: normalizedMonth,
      year: normalizedYear
    };

    this.state.months.push(created);
    this.save();
    return clone(created);
  }

  getCategories() {
    return clone(sortCategories(this.state.categories));
  }

  getMonthSummary(month: number, year: number): MonthSummary {
    const monthRecord = this.getOrCreateMonth(month, year);
    const fixed = this.withCategory(
      this.state.fixed_expenses.filter((expense) => expense.month_id === monthRecord.id)
    );
    const monthly = this.withCategory(
      this.state.monthly_expenses.filter((expense) => expense.month_id === monthRecord.id)
    );
    const creditCard = this.withCategory(
      this.state.credit_card_expenses.filter((expense) => expense.month_id === monthRecord.id)
    );
    const income = this.state.income.filter((item) => item.month_id === monthRecord.id).map(clone);
    const investments = this.state.investments.filter((item) => item.month_id === monthRecord.id).map(clone);
    const categories = this.getCategories();
    const budgets = this.state.category_budgets.filter((budget) => budget.month_id === monthRecord.id);

    const totalFixed = sumBy(fixed, (expense) => expense.value);
    const totalMonthly = sumBy(monthly, (expense) => expense.value);
    const totalCreditCard = sumBy(creditCard, (expense) => expense.value);
    const totalIncome = sumBy(income, (item) => item.value);
    const totalInvestments = sumBy(investments, (item) => item.value);
    const totalExpenses = totalFixed + totalMonthly + totalCreditCard;
    const balance = totalIncome - totalExpenses;
    const debitTotal =
      sumBy(
        fixed.filter((expense) => expense.payment_type === 'debito'),
        (expense) => expense.value
      ) + totalMonthly;
    const creditTotal =
      sumBy(
        fixed.filter((expense) => expense.payment_type === 'credito'),
        (expense) => expense.value
      ) + totalCreditCard;
    const allExpenses = [...fixed, ...monthly, ...creditCard];

    const byCategory = categories.map((category) => {
      const spent = sumBy(
        allExpenses.filter((expense) => expense.category_id === category.id),
        (expense) => expense.value
      );
      const budget = budgets.find((item) => item.category_id === category.id);
      const percentage = totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0;

      return {
        ...category,
        spent,
        expected: budget?.expected_value || 0,
        percentage: Math.round(percentage * 100) / 100
      };
    });

    return {
      month: monthRecord.month,
      year: monthRecord.year,
      monthId: monthRecord.id,
      totalFixed,
      totalMonthly,
      totalCreditCard,
      totalExpenses,
      totalIncome,
      totalInvestments,
      balance,
      debitTotal,
      creditTotal,
      byCategory,
      fixed,
      monthly,
      creditCard,
      income,
      investments,
      categories
    };
  }

  addIncome(monthId: number, name: string, value: number) {
    this.state.income.push({
      id: this.nextId('income'),
      month_id: monthId,
      name,
      value
    });
    this.save();
  }

  updateIncome(id: number, name: string, value: number) {
    const income = this.state.income.find((item) => item.id === id);
    if (!income) return;
    income.name = name;
    income.value = value;
    this.save();
  }

  deleteIncome(id: number) {
    this.state.income = this.state.income.filter((item) => item.id !== id);
    this.save();
  }

  addFixedExpense(
    monthId: number,
    data: {
      name: string;
      paid?: number;
      payment_type: string;
      category_id: number | null;
      value: number;
      payment_code?: string | null;
      payment_code_type?: string | null;
    }
  ) {
    const expense: FixedExpense = {
      id: this.nextId('fixed_expenses'),
      month_id: monthId,
      name: data.name,
      paid: data.paid || 0,
      payment_type: data.payment_type || 'debito',
      category_id: data.category_id,
      value: data.value,
      payment_code: data.payment_code || null,
      payment_code_type: data.payment_code_type || null
    };

    this.state.fixed_expenses.push(expense);
    this.save();
    return clone(expense);
  }

  updateFixedExpense(id: number, data: Partial<Omit<FixedExpense, 'id' | 'month_id'>>) {
    this.patchById(this.state.fixed_expenses, id, data);
  }

  deleteFixedExpense(id: number) {
    this.state.fixed_expenses = this.state.fixed_expenses.filter((item) => item.id !== id);
    this.save();
  }

  copyFixedExpenses(sourceMonthId: number, targetMonthId: number) {
    const sourceExpenses = this.state.fixed_expenses
      .filter((expense) => expense.month_id === sourceMonthId)
      .sort((a, b) => a.id - b.id);

    let copied = 0;
    let skipped = 0;

    for (const expense of sourceExpenses) {
      const existing = this.state.fixed_expenses.find(
        (candidate) =>
          candidate.month_id === targetMonthId &&
          candidate.name === expense.name &&
          candidate.payment_type === expense.payment_type &&
          nullKey(candidate.category_id) === nullKey(expense.category_id) &&
          candidate.value === expense.value &&
          nullKey(candidate.payment_code) === nullKey(expense.payment_code) &&
          nullKey(candidate.payment_code_type) === nullKey(expense.payment_code_type)
      );

      if (existing) {
        skipped++;
        continue;
      }

      this.state.fixed_expenses.push({
        id: this.nextId('fixed_expenses'),
        month_id: targetMonthId,
        name: expense.name,
        paid: 0,
        payment_type: expense.payment_type,
        category_id: expense.category_id,
        value: expense.value,
        payment_code: expense.payment_code,
        payment_code_type: expense.payment_code_type
      });
      copied++;
    }

    this.save();

    return {
      total: sourceExpenses.length,
      copied,
      skipped
    };
  }

  addMonthlyExpense(
    monthId: number,
    data: {
      name: string;
      date: string;
      paid?: number;
      category_id: number | null;
      value: number;
      payment_code?: string | null;
      payment_code_type?: string | null;
    }
  ) {
    const expense: MonthlyExpense = {
      id: this.nextId('monthly_expenses'),
      month_id: monthId,
      name: data.name,
      paid: data.paid || 0,
      date: data.date || '',
      category_id: data.category_id,
      value: data.value,
      payment_code: data.payment_code || null,
      payment_code_type: data.payment_code_type || null
    };

    this.state.monthly_expenses.push(expense);
    this.save();
    return clone(expense);
  }

  updateMonthlyExpense(id: number, data: Partial<Omit<MonthlyExpense, 'id' | 'month_id'>>) {
    this.patchById(this.state.monthly_expenses, id, data);
  }

  deleteMonthlyExpense(id: number) {
    this.state.monthly_expenses = this.state.monthly_expenses.filter((item) => item.id !== id);
    this.save();
  }

  addCreditCardExpense(
    monthId: number,
    data: {
      name: string;
      paid?: number;
      total_installments: number;
      date: string;
      category_id: number | null;
      value: number;
      payment_code?: string | null;
      payment_code_type?: string | null;
    }
  ) {
    const currentMonth = this.state.months.find((item) => item.id === monthId);
    if (!currentMonth) {
      throw new Error('Mes de origem nao encontrado.');
    }

    const originalId = this.nextId('credit_card_expenses');
    const totalInstallments = Math.max(1, Math.trunc(data.total_installments || 1));

    this.state.credit_card_expenses.push({
      id: originalId,
      month_id: monthId,
      name: data.name,
      paid: data.paid || 0,
      total_installments: totalInstallments,
      current_installment: 1,
      date: data.date || '',
      category_id: data.category_id,
      value: data.value,
      original_expense_id: null,
      payment_code: data.payment_code || null,
      payment_code_type: data.payment_code_type || null
    });

    for (let installment = 2; installment <= totalInstallments; installment++) {
      const future = addMonths(currentMonth.month, currentMonth.year, installment - 1);
      const futureMonth = this.getOrCreateMonth(future.month, future.year);

      this.state.credit_card_expenses.push({
        id: this.nextId('credit_card_expenses'),
        month_id: futureMonth.id,
        name: data.name,
        paid: 0,
        total_installments: totalInstallments,
        current_installment: installment,
        date: data.date || '',
        category_id: data.category_id,
        value: data.value,
        original_expense_id: originalId,
        payment_code: data.payment_code || null,
        payment_code_type: data.payment_code_type || null
      });
    }

    this.save();
    return clone(this.state.credit_card_expenses.find((expense) => expense.id === originalId)!);
  }

  updateCreditCardExpense(id: number, data: Partial<Omit<CreditCardExpense, 'id' | 'month_id'>>) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    const expense = this.state.credit_card_expenses.find((item) => item.id === id);

    if (!expense || entries.length === 0) return;

    for (const [key, value] of entries) {
      (expense as unknown as Record<string, unknown>)[key] = value;
    }

    const propagatedEntries = entries.filter(([key]) => key !== 'current_installment' && key !== 'paid');
    if (propagatedEntries.length > 0) {
      for (const child of this.state.credit_card_expenses.filter((item) => item.original_expense_id === id)) {
        for (const [key, value] of propagatedEntries) {
          (child as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }

    this.save();
  }

  deleteCreditCardExpense(id: number) {
    this.state.credit_card_expenses = this.state.credit_card_expenses.filter(
      (item) => item.original_expense_id !== id && item.id !== id
    );
    this.save();
  }

  addInvestment(monthId: number, name: string, value: number) {
    this.state.investments.push({
      id: this.nextId('investments'),
      month_id: monthId,
      name,
      value
    });
    this.save();
  }

  updateInvestment(id: number, name: string, value: number) {
    const investment = this.state.investments.find((item) => item.id === id);
    if (!investment) return;
    investment.name = name;
    investment.value = value;
    this.save();
  }

  deleteInvestment(id: number) {
    this.state.investments = this.state.investments.filter((item) => item.id !== id);
    this.save();
  }

  upsertCategoryBudget(monthId: number, categoryId: number, expectedValue: number) {
    const existing = this.state.category_budgets.find(
      (item) => item.month_id === monthId && item.category_id === categoryId
    );

    if (existing) {
      existing.expected_value = expectedValue;
    } else {
      this.state.category_budgets.push({
        id: this.nextId('category_budgets'),
        month_id: monthId,
        category_id: categoryId,
        expected_value: expectedValue
      });
    }

    this.save();
  }

  moveExpense(
    monthId: number,
    data: {
      source: string;
      target: string;
      id: number;
      name: string;
      value: number;
      paid: number;
      category_id: number | null;
      payment_code: string;
      payment_code_type: string;
      payment_type: string;
      date: string;
    }
  ) {
    if (data.source === data.target) return;

    if (data.source === 'fixed') {
      this.state.fixed_expenses = this.state.fixed_expenses.filter((expense) => expense.id !== data.id);
    } else if (data.source === 'monthly') {
      this.state.monthly_expenses = this.state.monthly_expenses.filter((expense) => expense.id !== data.id);
    }

    if (data.target === 'fixed') {
      this.state.fixed_expenses.push({
        id: this.nextId('fixed_expenses'),
        month_id: monthId,
        name: data.name,
        paid: data.paid,
        payment_type: data.payment_type || 'debito',
        category_id: data.category_id,
        value: data.value,
        payment_code: data.payment_code || null,
        payment_code_type: data.payment_code_type || null
      });
    } else if (data.target === 'monthly') {
      this.state.monthly_expenses.push({
        id: this.nextId('monthly_expenses'),
        month_id: monthId,
        name: data.name,
        date: data.date || '',
        paid: data.paid,
        category_id: data.category_id,
        value: data.value,
        payment_code: data.payment_code || null,
        payment_code_type: data.payment_code_type || null
      });
    }

    this.save();
  }

  importTabularData(month: number, year: number, raw: string) {
    const monthRecord = this.getOrCreateMonth(month, year);
    const categories = this.getCategories();
    let imported = 0;

    for (const line of raw.split('\n').filter((item) => item.trim())) {
      const parts = splitImportLine(line);
      if (parts.length < 4) continue;

      const name = parts[0];
      const paidRaw = parts[1]?.toUpperCase();
      const paid = paidRaw === 'TRUE' || paidRaw === 'VERDADEIRO' || paidRaw === '1';
      const typeRaw = normalizeText(parts[2] || '');
      const paymentType = typeRaw.includes('cred') ? 'credito' : 'debito';
      const categoryName = parts[3];
      const valueRaw = parts[4] || '0';
      const value = parseCurrency(valueRaw);
      const category = categories.find((item) => normalizeText(item.name) === normalizeText(categoryName));
      const result = this.addFixedExpense(monthRecord.id, {
        name,
        paid: paid ? 1 : 0,
        payment_type: paymentType,
        category_id: category?.id || null,
        value,
        payment_code: '',
        payment_code_type: ''
      });

      if (result.id) imported++;
    }

    this.save();
    return { imported };
  }

  exportBackupData(): FinanceBackup {
    return {
      meta: {
        app: 'finance',
        formatVersion: 1,
        exportedAt: new Date().toISOString()
      },
      data: {
        categories: sortById(this.state.categories),
        months: [...this.state.months].sort((a, b) => a.year - b.year || a.month - b.month || a.id - b.id).map(clone),
        income: sortById(this.state.income),
        fixed_expenses: sortById(this.state.fixed_expenses),
        monthly_expenses: sortById(this.state.monthly_expenses),
        credit_card_expenses: sortById(this.state.credit_card_expenses),
        investments: sortById(this.state.investments),
        category_budgets: sortById(this.state.category_budgets)
      }
    };
  }

  importBackupData(payload: unknown) {
    const backup = parseBackupPayload(payload);
    this.state = normalizeState(backup.data, { seedDefaultCategories: false });
    this.save();

    const totalRecords = BACKUP_TABLES.reduce((sum, table) => sum + this.state[table].length, 0);

    return {
      totalRecords,
      categories: this.state.categories.length,
      months: this.state.months.length
    };
  }

  private withCategory<T extends { category_id: number | null }>(expenses: T[]) {
    return expenses
      .sort((a: T & { id?: number }, b: T & { id?: number }) => (a.id || 0) - (b.id || 0))
      .map((expense) => {
        const category = this.state.categories.find((item) => item.id === expense.category_id);
        return {
          ...clone(expense),
          category_name: category?.name,
          category_color: category?.color
        };
      });
  }

  private patchById<T extends { id: number }>(rows: T[], id: number, data: Partial<Omit<T, 'id'>>) {
    const row = rows.find((item) => item.id === id);
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);

    if (!row || entries.length === 0) return;

    for (const [key, value] of entries) {
      (row as Record<string, unknown>)[key] = value;
    }

    this.save();
  }

  private nextId(table: BackupTable) {
    return Math.max(0, ...this.state[table].map((item) => item.id)) + 1;
  }

  private save() {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}

function getBrowserStorage() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function loadState(storage: StorageLike | null): FinanceState {
  if (!storage) return createInitialState();

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createInitialState();

  try {
    return JSON.parse(raw) as FinanceState;
  } catch {
    return createInitialState();
  }
}

function normalizeState(
  source: Partial<Record<BackupTable, any[]>>,
  options: { seedDefaultCategories?: boolean } = {}
) {
  const seedDefaultCategories = options.seedDefaultCategories ?? true;
  const initial = createInitialState();

  return {
    categories:
      source.categories && source.categories.length > 0
        ? source.categories.map((item, index) => ({
            id: toNumber(item.id),
            name: String(item.name || ''),
            color: String(item.color || '#6b7280'),
            sort_order: toNumber(item.sort_order ?? index)
          }))
        : seedDefaultCategories
          ? initial.categories
          : [],
    months: (source.months || []).map((item) => ({
      id: toNumber(item.id),
      month: clampMonth(item.month),
      year: toNumber(item.year)
    })),
    income: (source.income || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      name: String(item.name || ''),
      value: toNumber(item.value)
    })),
    fixed_expenses: (source.fixed_expenses || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      name: String(item.name || ''),
      paid: toBoolNumber(item.paid),
      payment_type: String(item.payment_type || 'debito'),
      category_id: toNullableNumber(item.category_id),
      value: toNumber(item.value),
      payment_code: toNullableString(item.payment_code),
      payment_code_type: toNullableString(item.payment_code_type)
    })),
    monthly_expenses: (source.monthly_expenses || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      name: String(item.name || ''),
      paid: toBoolNumber(item.paid),
      date: String(item.date || ''),
      category_id: toNullableNumber(item.category_id),
      value: toNumber(item.value),
      payment_code: toNullableString(item.payment_code),
      payment_code_type: toNullableString(item.payment_code_type)
    })),
    credit_card_expenses: (source.credit_card_expenses || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      name: String(item.name || ''),
      paid: toBoolNumber(item.paid),
      total_installments: toNumber(item.total_installments || 1),
      current_installment: toNumber(item.current_installment || 1),
      date: String(item.date || ''),
      category_id: toNullableNumber(item.category_id),
      value: toNumber(item.value),
      original_expense_id: toNullableNumber(item.original_expense_id),
      payment_code: toNullableString(item.payment_code),
      payment_code_type: toNullableString(item.payment_code_type)
    })),
    investments: (source.investments || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      name: String(item.name || ''),
      value: toNumber(item.value)
    })),
    category_budgets: (source.category_budgets || []).map((item) => ({
      id: toNumber(item.id),
      month_id: toNumber(item.month_id),
      category_id: toNumber(item.category_id),
      expected_value: toNumber(item.expected_value)
    }))
  };
}

function parseBackupPayload(payload: unknown) {
  const parsed = typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload;

  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new Error('Arquivo de backup invalido.');
  }

  const data = parsed.data;

  return {
    data: {
      categories: getRecordArray(data, 'categories'),
      months: getRecordArray(data, 'months'),
      income: getRecordArray(data, 'income'),
      fixed_expenses: getRecordArray(data, 'fixed_expenses'),
      monthly_expenses: getRecordArray(data, 'monthly_expenses'),
      credit_card_expenses: getRecordArray(data, 'credit_card_expenses'),
      investments: getRecordArray(data, 'investments'),
      category_budgets: getRecordArray(data, 'category_budgets')
    }
  };
}

function getRecordArray(source: Record<string, unknown>, key: string) {
  const value = source[key];

  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`O backup nao contem a colecao "${key}" no formato esperado.`);
  }

  return value as Record<string, unknown>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addMonths(month: number, year: number, offset: number) {
  let futureMonth = month + offset;
  let futureYear = year;

  while (futureMonth > 12) {
    futureMonth -= 12;
    futureYear++;
  }

  return {
    month: futureMonth,
    year: futureYear
  };
}

function splitImportLine(line: string) {
  const parts = line.includes('\t') ? line.split(/\t+/) : line.split(/\s{2,}/);
  return parts.map((part) => part.trim());
}

function parseCurrency(raw: string) {
  return parseFloat(raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

function sortById<T extends { id: number }>(items: T[]) {
  return [...items].sort((a, b) => a.id - b.id).map(clone);
}

function sumBy<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((sum, item) => sum + getValue(item), 0);
}

function nullKey(value: string | number | null | undefined) {
  return value ?? '';
}

function clampMonth(value: unknown) {
  const month = toNumber(value);
  if (month < 1) return 1;
  if (month > 12) return 12;
  return Math.trunc(month);
}

function toNumber(value: unknown) {
  const number = typeof value === 'number' ? value : parseFloat(String(value || 0));
  return Number.isFinite(number) ? number : 0;
}

function toBoolNumber(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1' ? 1 : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = toNumber(value);
  return Number.isFinite(number) ? number : null;
}

function toNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
