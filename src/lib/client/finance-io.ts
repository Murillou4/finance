import type { MonthSummary } from './finance-data';

export interface OFXTransaction {
  date: string;
  rawDate: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  memo: string;
  fitId: string;
}

export function exportMonthCSV(summary: MonthSummary): string {
  const rows: string[][] = [];
  rows.push(['Tipo', 'Pago', 'Nome', 'Categoria', 'Data', 'Valor', 'Forma de pagamento']);

  for (const expense of summary.fixed) {
    rows.push([
      'Fixo',
      expense.paid ? 'Sim' : 'Não',
      expense.name,
      expense.category_name ?? '',
      '',
      formatNumber(expense.value),
      expense.payment_type === 'credito' ? 'Crédito' : 'Débito'
    ]);
  }

  for (const expense of summary.monthly) {
    rows.push([
      'Mensal',
      expense.paid ? 'Sim' : 'Não',
      expense.name,
      expense.category_name ?? '',
      expense.date ?? '',
      formatNumber(expense.value),
      'Débito'
    ]);
  }

  for (const expense of summary.creditCard) {
    rows.push([
      'Cartão',
      expense.paid ? 'Sim' : 'Não',
      `${expense.name} (${expense.current_installment}/${expense.total_installments})`,
      expense.category_name ?? '',
      expense.date ?? '',
      formatNumber(expense.value),
      'Crédito'
    ]);
  }

  for (const income of summary.income) {
    rows.push(['Receita', 'Sim', income.name, '', '', formatNumber(income.value), '']);
  }

  for (const investment of summary.investments) {
    rows.push([
      'Investimento',
      'Sim',
      investment.name,
      '',
      '',
      formatNumber(investment.value),
      ''
    ]);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
}

function escapeCsvCell(value: string) {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(value: number) {
  return value.toFixed(2).replace('.', ',');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseOFX(content: string): OFXTransaction[] {
  const txBlocks = content.match(/<STMTTRN[\s\S]*?<\/STMTTRN>/gi);
  if (!txBlocks) return [];

  const transactions: OFXTransaction[] = [];
  for (const block of txBlocks) {
    const dateRaw = pickTag(block, 'DTPOSTED');
    const amountRaw = pickTag(block, 'TRNAMT');
    const trnType = pickTag(block, 'TRNTYPE') || (parseFloat(amountRaw) >= 0 ? 'CREDIT' : 'DEBIT');
    const memo = pickTag(block, 'MEMO') || pickTag(block, 'NAME') || '';
    const fitId = pickTag(block, 'FITID') || '';
    const amount = parseFloat(amountRaw.replace(',', '.'));

    if (!dateRaw || !Number.isFinite(amount)) continue;

    transactions.push({
      rawDate: dateRaw,
      date: formatOfxDate(dateRaw),
      amount,
      type: trnType.toUpperCase().includes('CREDIT') || amount > 0 ? 'CREDIT' : 'DEBIT',
      memo: memo.trim(),
      fitId
    });
  }
  return transactions;
}

function pickTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : '';
}

function formatOfxDate(raw: string) {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}`;
}
