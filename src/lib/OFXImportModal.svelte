<script lang="ts">
  import Modal from "$lib/Modal.svelte";
  import { FinanceDataStore, type Category } from "$lib/client/finance-data";
  import { parseOFX, type OFXTransaction } from "$lib/client/finance-io";

  interface Props {
    open: boolean;
    onClose: () => void;
    finance: FinanceDataStore | null;
    month: number;
    year: number;
    categories: Category[];
    onDone: (count: number) => void;
  }

  let { open, onClose, finance, month, year, categories, onDone }: Props = $props();

  type Row = {
    transaction: OFXTransaction;
    selected: boolean;
    categoryId: number | null;
    name: string;
  };

  let rows = $state<Row[]>([]);
  let error = $state("");
  let importing = $state(false);

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  async function handleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !finance) return;

    error = "";
    try {
      const text = await file.text();
      const transactions = parseOFX(text);
      if (transactions.length === 0) {
        error = "Nenhuma transação encontrada no arquivo OFX.";
        rows = [];
        return;
      }
      const debits = transactions.filter((t) => t.type === "DEBIT" || t.amount < 0);
      rows = debits.map((tx) => {
        const detected = finance!.applyAutoCategory(tx.memo);
        return {
          transaction: tx,
          selected: true,
          categoryId: detected,
          name: cleanName(tx.memo),
        };
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Erro ao ler arquivo OFX.";
      rows = [];
    }
  }

  function cleanName(memo: string) {
    return memo.replace(/\s+/g, " ").trim();
  }

  function toggleAll(value: boolean) {
    rows = rows.map((row) => ({ ...row, selected: value }));
  }

  async function importSelected() {
    if (!finance) return;
    importing = true;
    try {
      const monthRecord = finance.getOrCreateMonth(month, year);
      let imported = 0;
      for (const row of rows) {
        if (!row.selected) continue;
        const value = Math.abs(row.transaction.amount);
        finance.addMonthlyExpense(monthRecord.id, {
          name: row.name || row.transaction.memo,
          paid: 1,
          date: row.transaction.date,
          category_id: row.categoryId,
          value,
          payment_code: null,
          payment_code_type: null,
        });
        imported++;
      }
      onDone(imported);
      rows = [];
      onClose();
    } finally {
      importing = false;
    }
  }

  let selectedCount = $derived(rows.filter((r) => r.selected).length);
  let selectedTotal = $derived(
    rows.filter((r) => r.selected).reduce((sum, r) => sum + Math.abs(r.transaction.amount), 0),
  );
</script>

<Modal {open} {onClose} title="Importar OFX" size="lg">
  <div class="modal-body ofx-body">
    <div class="form-help">
      Importe extratos no formato OFX (Open Financial Exchange) — gerados por
      bancos brasileiros. Apenas débitos serão sugeridos como gastos mensais.
    </div>

    <input
      type="file"
      accept=".ofx,application/x-ofx,text/xml,text/plain"
      class="input"
      onchange={handleFile}
    />

    {#if error}
      <div class="banner banner-error">{error}</div>
    {/if}

    {#if rows.length > 0}
      <div class="bulk">
        <div>
          {selectedCount} de {rows.length} transações selecionadas
          ({fmt(selectedTotal)})
        </div>
        <div class="bulk-actions">
          <button class="btn btn-sm" onclick={() => toggleAll(true)}>Marcar todas</button>
          <button class="btn btn-sm" onclick={() => toggleAll(false)}>Desmarcar</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="ofx-table">
          <thead>
            <tr>
              <th></th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th class="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, i}
              <tr class:selected={row.selected}>
                <td>
                  <input type="checkbox" bind:checked={row.selected} />
                </td>
                <td class="mono">{row.transaction.date}</td>
                <td>
                  <input
                    class="input row-input"
                    bind:value={row.name}
                  />
                </td>
                <td>
                  <select
                    class="select row-input"
                    bind:value={row.categoryId}
                  >
                    <option value={null}>—</option>
                    {#each categories as cat}
                      <option value={cat.id}>{cat.name}</option>
                    {/each}
                  </select>
                </td>
                <td class="mono num">{fmt(Math.abs(row.transaction.amount))}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  <div class="modal-footer">
    <button class="btn" onclick={onClose}>Cancelar</button>
    <button
      class="btn btn-primary"
      disabled={selectedCount === 0 || importing}
      onclick={importSelected}
    >
      {importing ? "Importando..." : `Importar ${selectedCount}`}
    </button>
  </div>
</Modal>

<style>
  .ofx-body {
    gap: 14px;
  }
  .bulk {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.84rem;
    color: var(--text-secondary);
  }
  .bulk-actions {
    display: flex;
    gap: 6px;
  }
  .table-wrap {
    max-height: 340px;
    overflow-y: auto;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
  }
  .ofx-table {
    width: 100%;
    font-size: 0.85rem;
  }
  .ofx-table th {
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
  }
  .row-input {
    width: 100%;
    padding: 5px 8px;
    font-size: 0.82rem;
    border-radius: 4px;
  }
  .selected td {
    background: var(--primary-light);
  }
  .num {
    text-align: right;
  }
  .mono { font-variant-numeric: tabular-nums; }
  .banner {
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    font-size: 0.85rem;
  }
  .banner-error {
    background: var(--danger-light);
    color: var(--danger-text);
    border: 1px solid rgba(239, 68, 68, 0.22);
  }
</style>
