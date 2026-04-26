import { describe, expect, it } from 'vitest';
import { FinanceDataStore, STORAGE_KEY, type StorageLike } from './finance-data';

function createStore() {
  return new FinanceDataStore({ storage: null });
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

describe('FinanceDataStore', () => {
  it('calculates a month summary from income, expenses and investments', () => {
    const store = createStore();
    const month = store.getOrCreateMonth(3, 2026);
    const mercado = store.getCategories().find((category) => category.name === 'Mercado')!;

    store.addIncome(month.id, 'Salario', 5000);
    store.addFixedExpense(month.id, {
      name: 'Aluguel',
      paid: 1,
      payment_type: 'debito',
      category_id: mercado.id,
      value: 1500
    });
    store.addFixedExpense(month.id, {
      name: 'Streaming',
      payment_type: 'credito',
      category_id: null,
      value: 50
    });
    store.addMonthlyExpense(month.id, {
      name: 'Farmacia',
      date: '10/03',
      category_id: null,
      value: 100
    });
    store.addInvestment(month.id, 'Tesouro', 500);

    const summary = store.getMonthSummary(3, 2026);

    expect(summary.totalIncome).toBe(5000);
    expect(summary.totalExpenses).toBe(1650);
    expect(summary.debitTotal).toBe(1600);
    expect(summary.creditTotal).toBe(50);
    expect(summary.totalInvestments).toBe(500);
    expect(summary.balance).toBe(3350);
    expect(summary.byCategory.find((category) => category.id === mercado.id)?.spent).toBe(1500);
  });

  it('creates future credit card installments', () => {
    const store = createStore();
    const january = store.getOrCreateMonth(1, 2026);

    store.addCreditCardExpense(january.id, {
      name: 'Notebook',
      total_installments: 3,
      date: '05/01',
      category_id: null,
      value: 400
    });

    expect(store.getMonthSummary(1, 2026).creditCard[0]).toMatchObject({
      current_installment: 1,
      total_installments: 3,
      value: 400
    });
    expect(store.getMonthSummary(2, 2026).creditCard[0]).toMatchObject({
      current_installment: 2,
      total_installments: 3,
      value: 400
    });
    expect(store.getMonthSummary(3, 2026).creditCard[0]).toMatchObject({
      current_installment: 3,
      total_installments: 3,
      value: 400
    });
  });

  it('copies fixed expenses and skips duplicates', () => {
    const store = createStore();
    const source = store.getOrCreateMonth(1, 2026);
    const target = store.getOrCreateMonth(2, 2026);

    store.addFixedExpense(source.id, {
      name: 'Internet',
      paid: 1,
      payment_type: 'debito',
      category_id: null,
      value: 120,
      payment_code: '123',
      payment_code_type: 'boleto'
    });

    expect(store.copyFixedExpenses(source.id, target.id)).toEqual({
      total: 1,
      copied: 1,
      skipped: 0
    });
    expect(store.copyFixedExpenses(source.id, target.id)).toEqual({
      total: 1,
      copied: 0,
      skipped: 1
    });

    const copied = store.getMonthSummary(2, 2026).fixed[0];
    expect(copied).toMatchObject({
      name: 'Internet',
      paid: 0,
      payment_code: '123',
      payment_code_type: 'boleto'
    });
  });

  it('moves an expense from fixed to monthly', () => {
    const store = createStore();
    const month = store.getOrCreateMonth(4, 2026);
    const fixed = store.addFixedExpense(month.id, {
      name: 'Conta de agua',
      paid: 1,
      payment_type: 'debito',
      category_id: null,
      value: 90
    });

    store.moveExpense(month.id, {
      source: 'fixed',
      target: 'monthly',
      id: fixed.id,
      name: fixed.name,
      value: fixed.value,
      paid: fixed.paid,
      category_id: fixed.category_id,
      payment_code: fixed.payment_code || '',
      payment_code_type: fixed.payment_code_type || '',
      payment_type: fixed.payment_type,
      date: '12/04'
    });

    const summary = store.getMonthSummary(4, 2026);
    expect(summary.fixed).toHaveLength(0);
    expect(summary.monthly).toHaveLength(1);
    expect(summary.monthly[0]).toMatchObject({
      name: 'Conta de agua',
      paid: 1,
      date: '12/04',
      value: 90
    });
  });

  it('imports tabular fixed expenses', () => {
    const store = createStore();

    store.importTabularData(
      5,
      2026,
      'Conta de Luz\tTRUE\tDebito\tContas\tR$ 150,00\nNotebook  FALSE  Credito  Eletronicos  1.200,50'
    );

    const summary = store.getMonthSummary(5, 2026);
    expect(summary.fixed).toHaveLength(2);
    expect(summary.fixed[0]).toMatchObject({
      name: 'Conta de Luz',
      paid: 1,
      payment_type: 'debito',
      value: 150,
      category_name: 'Contas'
    });
    expect(summary.fixed[1]).toMatchObject({
      name: 'Notebook',
      paid: 0,
      payment_type: 'credito',
      value: 1200.5,
      category_name: 'Eletrônicos'
    });
  });

  it('exports and imports the existing backup format', () => {
    const store = createStore();
    const month = store.getOrCreateMonth(6, 2026);
    store.addIncome(month.id, 'Freela', 800);
    store.addMonthlyExpense(month.id, {
      name: 'Mercado',
      date: '01/06',
      category_id: null,
      value: 250
    });

    const backup = store.exportBackupData();
    const restored = createStore();
    const result = restored.importBackupData(JSON.stringify(backup));

    expect(result.totalRecords).toBeGreaterThan(0);
    expect(restored.getMonthSummary(6, 2026)).toMatchObject({
      totalIncome: 800,
      totalMonthly: 250,
      balance: 550
    });
  });

  it('persists state to browser-style storage', () => {
    const storage = createMemoryStorage();
    const first = new FinanceDataStore({ storage });
    const month = first.getOrCreateMonth(7, 2026);
    first.addIncome(month.id, 'Salario', 3000);

    const second = new FinanceDataStore({ storage });

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(second.getMonthSummary(7, 2026).totalIncome).toBe(3000);
  });
});
