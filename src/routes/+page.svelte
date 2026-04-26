<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "$lib/Chart.svelte";
  import {
    createEmptyMonthSummary,
    FinanceDataStore,
    type MonthSummary,
  } from "$lib/client/finance-data";

  const MONTHS = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const initialDate = new Date();

  let finance: FinanceDataStore | null = null;
  let data = $state<MonthSummary>(
    createEmptyMonthSummary(
      initialDate.getMonth() + 1,
      initialDate.getFullYear(),
    ),
  );
  let form = $state<Record<string, string>>({});

  let showAddFixed = $state(false);
  let showAddMonthly = $state(false);
  let showAddCreditCard = $state(false);
  let showAddIncome = $state(false);
  let showAddInvestment = $state(false);
  let showImport = $state(false);
  let showBackup = $state(false);
  let showCopyFixed = $state(false);
  let copyFixedSubmitting = $state(false);
  let showAllCategories = $state(false);
  let paymentModal = $state<{ code: string; type: string } | null>(null);
  let editPayment = $state<{
    id: number;
    table: string;
    code: string;
    type: string;
  } | null>(null);
  let editFixed = $state<any>(null);
  let editMonthly = $state<any>(null);
  let editCreditCard = $state<any>(null);
  let editIncome = $state<any>(null);
  let editInvestment = $state<any>(null);

  let draggingExpense = $state<any>(null);
  let draggingSource = $state<string>("");
  let moveForm = $state<HTMLFormElement | null>(null);
  let hasVisibleData = $derived(
    data.totalExpenses > 0 ||
      data.totalIncome > 0 ||
      data.totalInvestments > 0 ||
      data.byCategory.some((category) => category.expected > 0),
  );

  onMount(() => {
    finance = new FinanceDataStore();
    const current = getUrlMonthYear();
    refreshData(current.month, current.year);

    const handlePopState = () => {
      const next = getUrlMonthYear();
      refreshData(next.month, next.year);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  function getPreviousMonth(month: number, year: number) {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }

    return { month: month - 1, year };
  }

  function createCopyFixedForm() {
    const previous = getPreviousMonth(data.month, data.year);

    return {
      source_month: previous.month,
      source_year: previous.year,
    };
  }

  function createCreditCardForm() {
    return {
      name: "",
      total_installments: 1,
      date: "",
      category_id: "",
      value: "",
      payment_code: "",
      payment_code_type: "",
      paid: false,
      move_source: "",
      move_id: "",
    };
  }

  let copyFixedForm = $state(createCopyFixedForm());
  let addCreditCardForm = $state(createCreditCardForm());

  function openCopyFixed() {
    copyFixedForm = createCopyFixedForm();
    copyFixedSubmitting = false;
    showCopyFixed = true;
  }

  function enhanceCopyFixed(formElement: HTMLFormElement) {
    const handleSubmit = async (event: SubmitEvent) => {
      event.preventDefault();
      copyFixedSubmitting = true;

      const success = await submitForm(formElement);
      copyFixedSubmitting = false;

      if (success) {
        showCopyFixed = false;
        copyFixedForm = createCopyFixedForm();
      }
    };

    formElement.addEventListener("submit", handleSubmit);

    return {
      destroy() {
        formElement.removeEventListener("submit", handleSubmit);
      },
    };
  }

  function openAddCreditCard(prefill: Partial<ReturnType<typeof createCreditCardForm>> = {}) {
    addCreditCardForm = { ...createCreditCardForm(), ...prefill };
    showAddCreditCard = true;
  }

  function handleDragStart(e: DragEvent, expense: any, source: string) {
    draggingExpense = expense;
    draggingSource = source;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ id: expense.id, source }),
      );
    }
  }

  function handleDrop(e: DragEvent, target: string) {
    e.preventDefault();
    if (!draggingExpense || draggingSource === target) return;

    if (target === "creditCard") {
      openAddCreditCard({
        name: draggingExpense.name || "",
        date: draggingExpense.date || "",
        category_id: draggingExpense.category_id || "",
        value: draggingExpense.value || "",
        payment_code: draggingExpense.payment_code || "",
        payment_code_type: draggingExpense.payment_code_type || "",
        paid: Boolean(draggingExpense.paid),
        move_source: draggingSource,
        move_id: String(draggingExpense.id || ""),
      });
      draggingExpense = null;
      draggingSource = "";
      return;
    }

    if (!moveForm) return;

    const inputs = moveForm.querySelectorAll("input");
    for (const input of inputs) {
      if (input.name === "source") input.value = draggingSource;
      if (input.name === "target") input.value = target;
      if (input.name === "id") input.value = draggingExpense.id;
      if (input.name === "name") input.value = draggingExpense.name;
      if (input.name === "value") input.value = draggingExpense.value;
      if (input.name === "category_id")
        input.value = draggingExpense.category_id || "";
      if (input.name === "payment_code")
        input.value = draggingExpense.payment_code || "";
      if (input.name === "payment_code_type")
        input.value = draggingExpense.payment_code_type || "";
      if (input.name === "payment_type")
        input.value = draggingExpense.payment_type || "debito";
      if (input.name === "date") input.value = draggingExpense.date || "";
      if (input.name === "paid")
        input.value = draggingExpense.paid ? "true" : "false";
    }
    moveForm.requestSubmit();

    draggingExpense = null;
    draggingSource = "";
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function navigateMonth(delta: number) {
    let m = data.month + delta;
    let y = data.year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setUrlMonthYear(m, y);
    refreshData(m, y);
  }

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function submitEnhance(formElement: HTMLFormElement) {
    const handleSubmit = async (event: SubmitEvent) => {
      event.preventDefault();
      await submitForm(formElement);
    };

    formElement.addEventListener("submit", handleSubmit);

    return {
      destroy() {
        formElement.removeEventListener("submit", handleSubmit);
      },
    };
  }

  function quickEnhance(formElement: HTMLFormElement) {
    const handleSubmit = async (event: SubmitEvent) => {
      event.preventDefault();
      const success = await submitForm(formElement);

      if (success) {
        closeQuickForms();
      }
    };

    formElement.addEventListener("submit", handleSubmit);

    return {
      destroy() {
        formElement.removeEventListener("submit", handleSubmit);
      },
    };
  }

  async function submitForm(formElement: HTMLFormElement) {
    const action = getActionName(formElement);
    const fields = new FormData(formElement);
    const store = getFinance();

    form = {};

    try {
      if (action === "addFixed") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.addFixedExpense(monthRecord.id, {
          name: str(fields, "name"),
          paid: boolInt(fields, "paid"),
          payment_type: str(fields, "payment_type") || "debito",
          category_id: intOrNull(fields, "category_id"),
          value: num(fields, "value"),
          payment_code: str(fields, "payment_code"),
          payment_code_type: str(fields, "payment_code_type"),
        });
        refreshData(month, year);
        return true;
      }

      if (action === "copyFixedToMonth") {
        const { month, year } = getMonthYear(fields);
        const sourceMonth = int(fields, "source_month");
        const sourceYear = int(fields, "source_year");

        if (!sourceMonth || !sourceYear) {
          form = {
            copyFixedError: "Selecione um mes e ano de origem validos.",
          };
          return false;
        }

        if (sourceMonth === month && sourceYear === year) {
          form = {
            copyFixedError: "Escolha um mes diferente do atual para copiar os fixos.",
          };
          return false;
        }

        const source = store.getOrCreateMonth(sourceMonth, sourceYear);
        const target = store.getOrCreateMonth(month, year);
        const summary = store.copyFixedExpenses(source.id, target.id);

        if (summary.total === 0) {
          form = {
            copyFixedError: "O mes de origem nao tem fixos para copiar.",
          };
          refreshData(month, year);
          return false;
        }

        if (summary.copied === 0) {
          form = {
            copyFixedSuccess: "Nenhum fixo novo foi copiado porque todos ja existem neste mes.",
          };
        } else {
          form = {
            copyFixedSuccess: `${summary.copied} fixo(s) copiado(s) com sucesso. ${summary.skipped} item(ns) ja existiam e foram ignorados.`,
          };
        }

        refreshData(month, year);
        return true;
      }

      if (action === "updateFixed") {
        store.updateFixedExpense(int(fields, "id"), {
          name: str(fields, "name") || undefined,
          paid: fields.has("paid") ? boolInt(fields, "paid") : undefined,
          payment_type: str(fields, "payment_type") || undefined,
          category_id: fields.has("category_id")
            ? intOrNull(fields, "category_id")
            : undefined,
          value: fields.has("value") ? num(fields, "value") : undefined,
          payment_code: fields.has("payment_code")
            ? str(fields, "payment_code") || ""
            : undefined,
          payment_code_type: fields.has("payment_code_type")
            ? str(fields, "payment_code_type") || ""
            : undefined,
        });
        refreshData();
        return true;
      }

      if (action === "deleteFixed") {
        store.deleteFixedExpense(int(fields, "id"));
        refreshData();
        return true;
      }

      if (action === "addMonthly") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.addMonthlyExpense(monthRecord.id, {
          name: str(fields, "name"),
          date: str(fields, "date"),
          paid: boolInt(fields, "paid"),
          category_id: intOrNull(fields, "category_id"),
          value: num(fields, "value"),
          payment_code: str(fields, "payment_code"),
          payment_code_type: str(fields, "payment_code_type"),
        });
        refreshData(month, year);
        return true;
      }

      if (action === "updateMonthly") {
        store.updateMonthlyExpense(int(fields, "id"), {
          name: str(fields, "name") || undefined,
          date: str(fields, "date") || undefined,
          paid: fields.has("paid") ? boolInt(fields, "paid") : undefined,
          category_id: fields.has("category_id")
            ? intOrNull(fields, "category_id")
            : undefined,
          value: fields.has("value") ? num(fields, "value") : undefined,
          payment_code: fields.has("payment_code")
            ? str(fields, "payment_code") || ""
            : undefined,
          payment_code_type: fields.has("payment_code_type")
            ? str(fields, "payment_code_type") || ""
            : undefined,
        });
        refreshData();
        return true;
      }

      if (action === "deleteMonthly") {
        store.deleteMonthlyExpense(int(fields, "id"));
        refreshData();
        return true;
      }

      if (action === "addCreditCard") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.addCreditCardExpense(monthRecord.id, {
          name: str(fields, "name"),
          paid: boolInt(fields, "paid"),
          total_installments: int(fields, "total_installments") || 1,
          date: str(fields, "date"),
          category_id: intOrNull(fields, "category_id"),
          value: num(fields, "value"),
          payment_code: str(fields, "payment_code"),
          payment_code_type: str(fields, "payment_code_type"),
        });

        const moveSource = str(fields, "move_source");
        const moveId = int(fields, "move_id");
        if (moveSource && moveId) {
          if (moveSource === "fixed") {
            store.deleteFixedExpense(moveId);
          } else if (moveSource === "monthly") {
            store.deleteMonthlyExpense(moveId);
          }
        }

        refreshData(month, year);
        return true;
      }

      if (action === "updateCreditCard") {
        store.updateCreditCardExpense(int(fields, "id"), {
          name: str(fields, "name") || undefined,
          date: str(fields, "date") || undefined,
          paid: fields.has("paid") ? boolInt(fields, "paid") : undefined,
          category_id: fields.has("category_id")
            ? intOrNull(fields, "category_id")
            : undefined,
          value: fields.has("value") ? num(fields, "value") : undefined,
          payment_code: fields.has("payment_code")
            ? str(fields, "payment_code") || ""
            : undefined,
          payment_code_type: fields.has("payment_code_type")
            ? str(fields, "payment_code_type") || ""
            : undefined,
        });
        refreshData();
        return true;
      }

      if (action === "deleteCreditCard") {
        store.deleteCreditCardExpense(int(fields, "id"));
        refreshData();
        return true;
      }

      if (action === "addIncome") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.addIncome(monthRecord.id, str(fields, "name"), num(fields, "value"));
        refreshData(month, year);
        return true;
      }

      if (action === "updateIncome") {
        store.updateIncome(int(fields, "id"), str(fields, "name"), num(fields, "value"));
        refreshData();
        return true;
      }

      if (action === "deleteIncome") {
        store.deleteIncome(int(fields, "id"));
        refreshData();
        return true;
      }

      if (action === "addInvestment") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.addInvestment(monthRecord.id, str(fields, "name"), num(fields, "value"));
        refreshData(month, year);
        return true;
      }

      if (action === "updateInvestment") {
        store.updateInvestment(int(fields, "id"), str(fields, "name"), num(fields, "value"));
        refreshData();
        return true;
      }

      if (action === "deleteInvestment") {
        store.deleteInvestment(int(fields, "id"));
        refreshData();
        return true;
      }

      if (action === "updateBudget") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.upsertCategoryBudget(
          monthRecord.id,
          int(fields, "category_id"),
          num(fields, "expected_value"),
        );
        refreshData(month, year);
        return true;
      }

      if (action === "importData") {
        const { month, year } = getMonthYear(fields);
        store.importTabularData(month, year, str(fields, "import_text"));
        refreshData(month, year);
        return true;
      }

      if (action === "importBackup") {
        const backupFile = fields.get("backup_file");
        const confirmed = str(fields, "confirm_replace") === "true";

        if (!(backupFile instanceof File) || backupFile.size === 0) {
          form = {
            backupError: "Selecione um arquivo de backup em JSON.",
          };
          return false;
        }

        if (!confirmed) {
          form = {
            backupError: "Confirme que o backup deve substituir os dados atuais antes de importar.",
          };
          return false;
        }

        const content = await backupFile.text();
        const summary = store.importBackupData(content);
        form = {
          backupSuccess: `Backup importado com sucesso. ${summary.totalRecords} registros restaurados.`,
        };
        refreshData();
        return true;
      }

      if (action === "moveExpense") {
        const { month, year } = getMonthYear(fields);
        const monthRecord = store.getOrCreateMonth(month, year);
        store.moveExpense(monthRecord.id, {
          source: str(fields, "source"),
          target: str(fields, "target"),
          id: int(fields, "id"),
          name: str(fields, "name"),
          value: num(fields, "value"),
          paid: boolInt(fields, "paid"),
          category_id: intOrNull(fields, "category_id"),
          payment_code: str(fields, "payment_code"),
          payment_code_type: str(fields, "payment_code_type"),
          payment_type: str(fields, "payment_type") || "debito",
          date: str(fields, "date"),
        });
        refreshData(month, year);
        return true;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel concluir a acao.";
      form = { backupError: message };
      return false;
    }

    return false;
  }

  function closeQuickForms() {
    showAddFixed = false;
    showAddMonthly = false;
    showAddCreditCard = false;
    showAddIncome = false;
    showAddInvestment = false;
    showImport = false;
    showBackup = false;
    showCopyFixed = false;
    editPayment = null;
    editFixed = null;
    editMonthly = null;
    editCreditCard = null;
    editIncome = null;
    editInvestment = null;
    copyFixedForm = createCopyFixedForm();
    addCreditCardForm = createCreditCardForm();
  }

  function downloadBackup() {
    const backup = getFinance().exportBackupData();
    const date = backup.meta.exportedAt.slice(0, 10);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `finance-backup-${date}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function getFinance() {
    finance ??= new FinanceDataStore();
    return finance;
  }

  function refreshData(month = data.month, year = data.year) {
    data = getFinance().getMonthSummary(month, year);
  }

  function getUrlMonthYear() {
    const now = new Date();

    if (typeof window === "undefined") {
      return {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      };
    }

    const params = new URLSearchParams(window.location.search);
    const month = parseInt(params.get("month") || "", 10);
    const year = parseInt(params.get("year") || "", 10);

    return {
      month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
      year: Number.isFinite(year) && year > 0 ? year : now.getFullYear(),
    };
  }

  function setUrlMonthYear(month: number, year: number) {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("month", String(month));
    url.searchParams.set("year", String(year));
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function getActionName(formElement: HTMLFormElement) {
    const action = formElement.getAttribute("action") || "";
    return action.replace(/^.*\?\//, "");
  }

  function str(data: FormData, key: string): string {
    return (data.get(key) as string) || "";
  }

  function int(data: FormData, key: string): number {
    return parseInt((data.get(key) as string) || "0", 10) || 0;
  }

  function num(data: FormData, key: string): number {
    const raw = (data.get(key) as string) || "0";
    return parseFloat(raw.replace(",", ".")) || 0;
  }

  function boolInt(data: FormData, key: string): number {
    const raw = ((data.get(key) as string) || "").toLowerCase();
    return raw === "true" || raw === "1" ? 1 : 0;
  }

  function intOrNull(data: FormData, key: string): number | null {
    const val = data.get(key) as string;
    if (!val || val === "" || val === "null") return null;
    return parseInt(val, 10) || null;
  }

  function getMonthYear(fields: FormData) {
    const now = new Date();
    const month = parseInt(
      (fields.get("_month") as string) || String(data.month || now.getMonth() + 1),
      10,
    );
    const year = parseInt(
      (fields.get("_year") as string) || String(data.year || now.getFullYear()),
      10,
    );

    return { month, year };
  }

  function copyToClipboard(text: string | null | undefined) {
    if (text) navigator.clipboard.writeText(text);
  }
</script>

<form
  method="POST"
  action="?/moveExpense"
  use:submitEnhance
  bind:this={moveForm}
  style="display:none"
>
  <input type="hidden" name="source" value="" />
  <input type="hidden" name="target" value="" />
  <input type="hidden" name="id" value="" />
  <input type="hidden" name="name" value="" />
  <input type="hidden" name="value" value="" />
  <input type="hidden" name="category_id" value="" />
  <input type="hidden" name="payment_code" value="" />
  <input type="hidden" name="payment_code_type" value="" />
  <input type="hidden" name="payment_type" value="" />
  <input type="hidden" name="date" value="" />
  <input type="hidden" name="paid" value="" />
  <input type="hidden" name="_month" value={data.month} />
  <input type="hidden" name="_year" value={data.year} />
</form>

<!-- Header -->
<header class="header">
  <div class="header-inner">
    <h1 class="logo">Finance</h1>
    <div class="month-nav">
      <button class="header-action" onclick={() => (showImport = true)}
        >Importar Dados</button
      >
      <button class="header-action" onclick={() => (showBackup = true)}
        >Backup</button
      >
      <div class="month-selector">
        <button class="btn-nav" onclick={() => navigateMonth(-1)}>&larr;</button>
        <span class="month-label">{MONTHS[data.month - 1]} {data.year}</span>
        <button class="btn-nav" onclick={() => navigateMonth(1)}>&rarr;</button>
      </div>
    </div>
  </div>
</header>

<main class="main">
  {#if form?.backupSuccess}
    <div class="banner banner-success">{form.backupSuccess}</div>
  {/if}

  {#if form?.backupError}
    <div class="banner banner-error">{form.backupError}</div>
  {/if}

  {#if form?.copyFixedSuccess}
    <div class="banner banner-success">{form.copyFixedSuccess}</div>
  {/if}

  {#if !hasVisibleData}
    <div class="banner banner-info">
      <span>Este navegador ainda esta vazio. Importe o backup antigo para restaurar seus dados.</span>
      <button class="banner-action" onclick={() => (showBackup = true)}>Importar backup</button>
    </div>
  {/if}

  <!-- Top Stats -->
  <div class="stats-bar">
    <div class="stat-card" style="--accent: var(--danger)">
      <span class="stat-label">Total de Gastos</span>
      <span class="stat-value negative">{fmt(data.totalExpenses)}</span>
    </div>
    <div class="stat-card" style="--accent: var(--success)">
      <span class="stat-label">Entradas</span>
      <span class="stat-value positive">{fmt(data.totalIncome)}</span>
    </div>
    <div class="stat-card" style="--accent: {data.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
      <span class="stat-label">Saldo</span>
      <span
        class="stat-value"
        class:positive={data.balance >= 0}
        class:negative={data.balance < 0}
      >
        {fmt(data.balance)}
      </span>
    </div>
    <div class="stat-card" style="--accent: var(--info)">
      <span class="stat-label">Investimentos</span>
      <span class="stat-value" style="color: var(--info)">{fmt(data.totalInvestments)}</span>
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- LEFT COLUMN -->
    <div class="col">
      <!-- Fixed Expenses -->
      <div
        class="card"
        role="region"
        aria-label="Despesas Fixas"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "fixed")}
        class:drag-over-target={draggingSource && draggingSource !== "fixed"}
      >
        <div class="card-header">
          <span
            >Fixos <span class="header-total">{fmt(data.totalFixed)}</span
            ></span
          >
          <div class="card-actions">
            <button class="btn btn-sm" onclick={openCopyFixed}>Copiar</button>
            <button
              class="btn btn-sm btn-primary"
              onclick={() => (showAddFixed = true)}>+ Adicionar</button
            >
          </div>
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.fixed as expense}
                <tr
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, expense, "fixed")}
                  class="draggable-row"
                >
                  <td>
                    <form method="POST" action="?/updateFixed" use:submitEnhance>
                      <input type="hidden" name="id" value={expense.id} />
                      <input
                        type="hidden"
                        name="paid"
                        value={expense.paid ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        class="checkbox-btn"
                        class:checked={expense.paid}
                      >
                        {expense.paid ? "✓" : ""}
                      </button>
                    </form>
                  </td>
                  <td>{expense.name}</td>
                  <td>
                    <span
                      class="badge"
                      class:badge-debit={expense.payment_type === "debito"}
                      class:badge-credit={expense.payment_type === "credito"}
                    >
                      {expense.payment_type === "debito" ? "Débito" : "Crédito"}
                    </span>
                  </td>
                  <td>
                    {#if expense.category_name}
                      <span
                        class="badge"
                        style="background: {expense.category_color}20; color: {expense.category_color}; border: 1px solid {expense.category_color}40"
                      >
                        {expense.category_name}
                      </span>
                    {/if}
                  </td>
                  <td class="mono">{fmt(expense.value)}</td>
                  <td>
                    {#if expense.payment_code}
                      <button
                        class="pay-badge"
                        class:pay-badge-pix={expense.payment_code_type === "pix"}
                        title="Clique para copiar"
                        onclick={() => copyToClipboard(expense.payment_code)}
                      >
                        {expense.payment_code_type === "pix" ? "PIX" : "Boleto"}
                      </button>
                    {:else}
                      <button
                        class="btn-icon"
                        onclick={() =>
                          (editPayment = {
                            id: expense.id,
                            table: "Fixed",
                            code: "",
                            type: "boleto",
                          })}>+</button
                      >
                    {/if}
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="btn-icon"
                        title="Editar"
                        onclick={() => (editFixed = { ...expense })}>✎</button
                      >
                      <form
                        method="POST"
                        action="?/deleteFixed"
                        use:submitEnhance
                        style="display:inline"
                      >
                        <input type="hidden" name="id" value={expense.id} />
                        <button
                          type="submit"
                          class="btn-icon btn-danger"
                          title="Excluir">✕</button
                        >
                      </form>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div
        class="card"
        role="region"
        aria-label="Despesas Mensais"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "monthly")}
        class:drag-over-target={draggingSource && draggingSource !== "monthly"}
      >
        <div class="card-header">
          <span
            >Gastos do Mês <span class="header-total"
              >{fmt(data.totalMonthly)}</span
            ></span
          >
          <button
            class="btn btn-sm btn-primary"
            onclick={() => (showAddMonthly = true)}>+ Adicionar</button
          >
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th>Nome</th>
                <th>Data</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.monthly as expense}
                <tr
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, expense, "monthly")}
                  class="draggable-row"
                >
                  <td>
                    <form method="POST" action="?/updateMonthly" use:submitEnhance>
                      <input type="hidden" name="id" value={expense.id} />
                      <input
                        type="hidden"
                        name="paid"
                        value={expense.paid ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        class="checkbox-btn"
                        class:checked={expense.paid}
                      >
                        {expense.paid ? "✓" : ""}
                      </button>
                    </form>
                  </td>
                  <td>{expense.name}</td>
                  <td class="mono">{expense.date}</td>
                  <td>
                    {#if expense.category_name}
                      <span
                        class="badge"
                        style="background: {expense.category_color}20; color: {expense.category_color}; border: 1px solid {expense.category_color}40"
                      >
                        {expense.category_name}
                      </span>
                    {/if}
                  </td>
                  <td class="mono">{fmt(expense.value)}</td>
                  <td>
                    {#if expense.payment_code}
                      <button
                        class="pay-badge"
                        class:pay-badge-pix={expense.payment_code_type === "pix"}
                        title="Clique para copiar"
                        onclick={() => copyToClipboard(expense.payment_code)}
                      >
                        {expense.payment_code_type === "pix" ? "PIX" : "Boleto"}
                      </button>
                    {:else}
                      <button
                        class="btn-icon"
                        onclick={() =>
                          (editPayment = {
                            id: expense.id,
                            table: "Monthly",
                            code: "",
                            type: "boleto",
                          })}>+</button
                      >
                    {/if}
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="btn-icon"
                        title="Editar"
                        onclick={() => (editMonthly = { ...expense })}>✎</button
                      >
                      <form
                        method="POST"
                        action="?/deleteMonthly"
                        use:submitEnhance
                        style="display:inline"
                      >
                        <input type="hidden" name="id" value={expense.id} />
                        <button
                          type="submit"
                          class="btn-icon btn-danger"
                          title="Excluir">✕</button
                        >
                      </form>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Credit Card -->
      <div
        class="card"
        role="region"
        aria-label="Cartão de Crédito"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "creditCard")}
        class:drag-over-target={draggingSource && draggingSource !== "creditCard"}
      >
        <div class="card-header">
          <span
            >Cartão de Crédito <span class="header-total"
              >{fmt(data.totalCreditCard)}</span
            ></span
          >
          <button
            class="btn btn-sm btn-primary"
            onclick={() => openAddCreditCard()}>+ Adicionar</button
          >
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th>Nome</th>
                <th>Parcelas</th>
                <th>Data</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.creditCard as expense}
                <tr>
                  <td>
                    <form method="POST" action="?/updateCreditCard" use:submitEnhance>
                      <input type="hidden" name="id" value={expense.id} />
                      <input
                        type="hidden"
                        name="paid"
                        value={expense.paid ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        class="checkbox-btn"
                        class:checked={expense.paid}
                      >
                        {expense.paid ? "✓" : ""}
                      </button>
                    </form>
                  </td>
                  <td>{expense.name}</td>
                  <td class="mono"
                    >{expense.current_installment}/{expense.total_installments}</td
                  >
                  <td class="mono">{expense.date}</td>
                  <td>
                    {#if expense.category_name}
                      <span
                        class="badge"
                        style="background: {expense.category_color}20; color: {expense.category_color}; border: 1px solid {expense.category_color}40"
                      >
                        {expense.category_name}
                      </span>
                    {/if}
                  </td>
                  <td class="mono">{fmt(expense.value)}</td>
                  <td>
                    {#if expense.payment_code}
                      <button
                        class="pay-badge"
                        class:pay-badge-pix={expense.payment_code_type === "pix"}
                        title="Clique para copiar"
                        onclick={() => copyToClipboard(expense.payment_code)}
                      >
                        {expense.payment_code_type === "pix" ? "PIX" : "Boleto"}
                      </button>
                    {:else}
                      <button
                        class="btn-icon"
                        onclick={() =>
                          (editPayment = {
                            id: expense.id,
                            table: "CreditCard",
                            code: "",
                            type: "boleto",
                          })}>+</button
                      >
                    {/if}
                  </td>
                  <td>
                    {#if !expense.original_expense_id}
                      <div class="row-actions">
                        <button
                          class="btn-icon"
                          title="Editar"
                          onclick={() => (editCreditCard = { ...expense })}
                          >✎</button
                        >
                        <form
                          method="POST"
                          action="?/deleteCreditCard"
                          use:submitEnhance
                          style="display:inline"
                        >
                          <input type="hidden" name="id" value={expense.id} />
                          <button
                            type="submit"
                            class="btn-icon btn-danger"
                            title="Excluir">✕</button
                          >
                        </form>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div class="col">
      <!-- Income & Outflow -->
      <div class="side-grid">
        <div class="card">
          <div class="card-header">
            <span>Entradas</span>
            <button
              class="btn btn-sm btn-primary"
              onclick={() => (showAddIncome = true)}>+</button
            >
          </div>
          <div class="card-body">
            <div class="compact-list">
              {#each data.income as inc}
                <div class="compact-row">
                  <span class="compact-name">{inc.name}</span>
                  <span class="mono compact-value">{fmt(inc.value)}</span>
                  <div class="compact-actions">
                    <button
                      class="btn-icon"
                      title="Editar"
                      onclick={() => (editIncome = { ...inc })}>✎</button
                    >
                    <form
                      method="POST"
                      action="?/deleteIncome"
                      use:submitEnhance
                      style="display:contents"
                    >
                      <input type="hidden" name="id" value={inc.id} />
                      <button type="submit" class="btn-icon btn-danger">✕</button>
                    </form>
                  </div>
                </div>
              {/each}
              <div class="compact-row compact-total">
                <span class="compact-name">Total</span>
                <span class="mono positive compact-value">{fmt(data.totalIncome)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Saídas</div>
          <div class="card-body">
            <table>
              <tbody>
                <tr>
                  <td>Débito</td>
                  <td class="mono" style="text-align:right"
                    >{fmt(data.debitTotal)}</td
                  >
                </tr>
                <tr>
                  <td>Crédito</td>
                  <td class="mono" style="text-align:right"
                    >{fmt(data.creditTotal)}</td
                  >
                </tr>
                <tr>
                  <td>Investimento</td>
                  <td class="mono" style="text-align:right"
                    >{fmt(data.totalInvestments)}</td
                  >
                </tr>
                <tr class="total-row">
                  <td>Total</td>
                  <td class="mono negative" style="text-align:right"
                    >{fmt(data.totalExpenses + data.totalInvestments)}</td
                  >
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Investments -->
      <div class="card">
        <div class="card-header">
          <span>Investimentos</span>
          <button
            class="btn btn-sm btn-primary"
            onclick={() => (showAddInvestment = true)}>+</button
          >
        </div>
        <div class="card-body">
          <div class="compact-list">
            {#each data.investments as inv}
              <div class="compact-row">
                <span class="compact-name">{inv.name}</span>
                <span class="mono compact-value">{fmt(inv.value)}</span>
                <div class="compact-actions">
                  <button
                    class="btn-icon"
                    title="Editar"
                    onclick={() => (editInvestment = { ...inv })}>✎</button
                  >
                  <form
                    method="POST"
                    action="?/deleteInvestment"
                    use:submitEnhance
                    style="display:contents"
                  >
                    <input type="hidden" name="id" value={inv.id} />
                    <button type="submit" class="btn-icon btn-danger">✕</button>
                  </form>
                </div>
              </div>
            {/each}
            <div class="compact-row compact-total">
              <span class="compact-name">Total</span>
              <span class="mono compact-value">{fmt(data.totalInvestments)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Gastos por tipo de pagamento -->
      <div class="card">
        <div class="card-header">Gastos por tipo de pagamento</div>
        <div class="card-body" style="padding: 18px 20px;">
          <div class="payment-type-bars">
            <div class="pt-item">
              <div class="pt-row">
                <span class="badge badge-debit">Débito</span>
                <span class="mono">{fmt(data.debitTotal)}</span>
              </div>
              <div class="pt-bar">
                <div class="pt-bar-fill pt-bar-debit" style="width: {(data.debitTotal + data.creditTotal) > 0 ? (data.debitTotal / (data.debitTotal + data.creditTotal)) * 100 : 50}%"></div>
              </div>
            </div>
            <div class="pt-item">
              <div class="pt-row">
                <span class="badge badge-credit">Crédito</span>
                <span class="mono">{fmt(data.creditTotal)}</span>
              </div>
              <div class="pt-bar">
                <div class="pt-bar-fill pt-bar-credit" style="width: {(data.debitTotal + data.creditTotal) > 0 ? (data.creditTotal / (data.debitTotal + data.creditTotal)) * 100 : 50}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories (unified: chart + breakdown) -->
      <div class="card">
        <div class="card-header">Categorias</div>
        <div class="card-body" style="padding: 20px;">
          <!-- Chart -->
          <div class="cat-chart-wrap">
            <Chart categories={data.byCategory.filter((c) => c.spent > 0)} />
          </div>

          <!-- Active categories (with spending or budget) -->
          <div class="cat-grid">
            {#each data.byCategory.filter(c => c.spent > 0 || c.expected > 0) as cat}
              {@const hasExpected = cat.expected > 0}
              {@const ratio = hasExpected ? (cat.spent / cat.expected) * 100 : 0}
              {@const overBudget = hasExpected && cat.spent > cat.expected}
              <div class="cat-card" class:cat-card-over={overBudget}>
                <div class="cat-card-top">
                  <span class="cat-dot" style="background: {cat.color}"></span>
                  <span class="cat-name">{cat.name}</span>
                  {#if cat.percentage > 0}
                    <span class="cat-pct">{cat.percentage.toFixed(1)}%</span>
                  {/if}
                </div>
                {#if hasExpected}
                  <div class="cat-bar">
                    <div
                      class="cat-bar-fill"
                      style="width: {Math.min(ratio, 100)}%; background: {overBudget ? 'var(--danger)' : cat.color}"
                    ></div>
                  </div>
                {/if}
                <div class="cat-card-bottom">
                  <span class="mono cat-value" class:negative={overBudget}>{fmt(cat.spent)}</span>
                  <form
                    method="POST"
                    action="?/updateBudget"
                    use:submitEnhance
                    class="cat-budget-form"
                  >
                    <input type="hidden" name="category_id" value={cat.id} />
                    <input type="hidden" name="_month" value={data.month} />
                    <input type="hidden" name="_year" value={data.year} />
                    <input
                      type="number"
                      name="expected_value"
                      class="input cat-budget-input"
                      value={cat.expected || ""}
                      step="0.01"
                      placeholder="Prev."
                      onchange={(e) => e.currentTarget.form?.requestSubmit()}
                    />
                  </form>
                </div>
              </div>
            {/each}
          </div>

          <!-- Toggle for empty categories -->
          {#if data.byCategory.some(c => c.spent === 0 && c.expected === 0)}
            <button class="cat-toggle" onclick={() => (showAllCategories = !showAllCategories)}>
              {showAllCategories ? 'Ocultar' : 'Mostrar'} categorias sem gastos ({data.byCategory.filter(c => c.spent === 0 && c.expected === 0).length})
            </button>

            {#if showAllCategories}
              <div class="cat-grid" style="margin-top: 10px;">
                {#each data.byCategory.filter(c => c.spent === 0 && c.expected === 0) as cat}
                  <div class="cat-card cat-card-empty">
                    <div class="cat-card-top">
                      <span class="cat-dot" style="background: {cat.color}"></span>
                      <span class="cat-name">{cat.name}</span>
                    </div>
                    <div class="cat-card-bottom">
                      <span class="mono cat-value" style="color: var(--text-muted)">{fmt(0)}</span>
                      <form
                        method="POST"
                        action="?/updateBudget"
                        use:submitEnhance
                        class="cat-budget-form"
                      >
                        <input type="hidden" name="category_id" value={cat.id} />
                        <input type="hidden" name="_month" value={data.month} />
                        <input type="hidden" name="_year" value={data.year} />
                        <input
                          type="number"
                          name="expected_value"
                          class="input cat-budget-input"
                          value=""
                          step="0.01"
                          placeholder="Prev."
                          onchange={(e) => e.currentTarget.form?.requestSubmit()}
                        />
                      </form>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
</main>

<!-- ADD FIXED MODAL -->
{#if showAddFixed}
  <div
    class="modal-overlay"
    onclick={() => (showAddFixed = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Nova Despesa Fixa</span>
        <button class="btn-icon" onclick={() => (showAddFixed = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/addFixed" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-group">
            <label for="fixed-name">Nome</label>
            <input id="fixed-name" name="name" class="input" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="fixed-type">Tipo</label>
              <select id="fixed-type" name="payment_type" class="select">
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fixed-cat">Categoria</label>
              <select id="fixed-cat" name="category_id" class="select">
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="fixed-value">Valor (R$)</label>
            <input
              id="fixed-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="fixed-pct">Tipo pagamento</label>
              <select id="fixed-pct" name="payment_code_type" class="select">
                <option value="">Nenhum</option>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fixed-pc">Código</label>
              <input
                id="fixed-pc"
                name="payment_code"
                class="input"
                placeholder="Código do boleto ou chave PIX"
              />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (showAddFixed = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- BACKUP MODAL -->
{#if showBackup}
  <div
    class="modal-overlay"
    onclick={() => (showBackup = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Backup Completo</span>
        <button class="btn-icon" onclick={() => (showBackup = false)}>✕</button>
      </div>
      <div class="modal-body backup-stack">
        <section class="backup-section">
          <div class="backup-copy">
            <h3>Exportar tudo</h3>
            <p>Baixa um arquivo JSON com meses, categorias, entradas, gastos, cartao, investimentos e metas.</p>
          </div>
          <button type="button" class="btn btn-primary" onclick={downloadBackup}>Baixar backup</button>
        </section>

        <section class="backup-section backup-section-import">
          <div class="backup-copy">
            <h3>Importar tudo</h3>
            <p>Use o arquivo exportado pelo app para restaurar seus dados em outro navegador ou computador. Para migrar seus dados antigos, selecione data/IMPORTAR-MEUS-DADOS-ANTIGOS.json.</p>
          </div>
          <form method="POST" action="?/importBackup" enctype="multipart/form-data" use:quickEnhance>
            <div class="form-group">
              <label for="backup-file">Arquivo de backup</label>
              <input
                id="backup-file"
                name="backup_file"
                type="file"
                accept="application/json,.json"
                class="input"
                required
              />
            </div>
            <label class="checkline backup-check">
              <input type="checkbox" name="confirm_replace" value="true" />
              <span>Substituir todos os dados atuais por este backup</span>
            </label>
            <div class="modal-footer backup-footer">
              <button type="button" class="btn" onclick={() => (showBackup = false)}
                >Cancelar</button
              >
              <button type="submit" class="btn btn-primary">Importar backup</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  </div>
{/if}

<!-- COPY FIXED MODAL -->
{#if showCopyFixed}
  <div
    class="modal-overlay"
    onclick={() => (showCopyFixed = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Copiar Fixos</span>
        <button class="btn-icon" onclick={() => (showCopyFixed = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/copyFixedToMonth" use:enhanceCopyFixed>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-help">
            Copia os fixos de outro mês para {MONTHS[data.month - 1]} de {data.year}.
            Itens iguais já existentes são ignorados e todos entram como não pagos.
          </div>
          {#if form?.copyFixedError}
            <div class="banner banner-error banner-inline">{form.copyFixedError}</div>
          {/if}
          <div class="form-row">
            <div class="form-group">
              <label for="copy-fixed-month">Mês de origem</label>
              <select
                id="copy-fixed-month"
                name="source_month"
                class="select"
                bind:value={copyFixedForm.source_month}
              >
                {#each MONTHS as monthName, index}
                  <option value={index + 1}>{monthName}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="copy-fixed-year">Ano de origem</label>
              <input
                id="copy-fixed-year"
                name="source_year"
                type="number"
                class="input"
                required
                bind:value={copyFixedForm.source_year}
              />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            disabled={copyFixedSubmitting}
            onclick={() => (showCopyFixed = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary" disabled={copyFixedSubmitting}>
            {copyFixedSubmitting ? "Copiando..." : "Copiar fixos"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ADD MONTHLY MODAL -->
{#if showAddMonthly}
  <div
    class="modal-overlay"
    onclick={() => (showAddMonthly = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Novo Gasto do Mês</span>
        <button class="btn-icon" onclick={() => (showAddMonthly = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/addMonthly" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label for="monthly-name">Nome</label>
              <input id="monthly-name" name="name" class="input" required />
            </div>
            <div class="form-group">
              <label for="monthly-date">Data</label>
              <input
                id="monthly-date"
                name="date"
                class="input"
                placeholder="DD/MM"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="monthly-cat">Categoria</label>
              <select id="monthly-cat" name="category_id" class="select">
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="monthly-value">Valor (R$)</label>
              <input
                id="monthly-value"
                name="value"
                type="number"
                step="0.01"
                class="input"
                required
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="monthly-pct">Tipo pagamento</label>
              <select id="monthly-pct" name="payment_code_type" class="select">
                <option value="">Nenhum</option>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
              </select>
            </div>
            <div class="form-group">
              <label for="monthly-pc">Código</label>
              <input
                id="monthly-pc"
                name="payment_code"
                class="input"
                placeholder="Código do boleto ou chave PIX"
              />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (showAddMonthly = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ADD CREDIT CARD MODAL -->
{#if showAddCreditCard}
  <div
    class="modal-overlay"
    onclick={() => (showAddCreditCard = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Nova Despesa Cartão de Crédito</span>
        <button class="btn-icon" onclick={() => (showAddCreditCard = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/addCreditCard" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <input type="hidden" name="move_source" value={addCreditCardForm.move_source} />
        <input type="hidden" name="move_id" value={addCreditCardForm.move_id} />
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label for="cc-name">Nome</label>
              <input
                id="cc-name"
                name="name"
                class="input"
                required
                bind:value={addCreditCardForm.name}
              />
            </div>
            <div class="form-group">
              <label for="cc-installments">Parcelas</label>
              <input
                id="cc-installments"
                name="total_installments"
                type="number"
                min="1"
                class="input"
                bind:value={addCreditCardForm.total_installments}
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="cc-date">Data</label>
              <input
                id="cc-date"
                name="date"
                class="input"
                placeholder="DD/MM"
                bind:value={addCreditCardForm.date}
              />
            </div>
            <div class="form-group">
              <label for="cc-cat">Categoria</label>
              <select
                id="cc-cat"
                name="category_id"
                class="select"
                bind:value={addCreditCardForm.category_id}
              >
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="cc-value">Valor da parcela (R$)</label>
            <input
              id="cc-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={addCreditCardForm.value}
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="cc-pct">Tipo pagamento</label>
              <select
                id="cc-pct"
                name="payment_code_type"
                class="select"
                bind:value={addCreditCardForm.payment_code_type}
              >
                <option value="">Nenhum</option>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
              </select>
            </div>
            <div class="form-group">
              <label for="cc-pc">Código</label>
              <input
                id="cc-pc"
                name="payment_code"
                class="input"
                placeholder="Código do boleto ou chave PIX"
                bind:value={addCreditCardForm.payment_code}
              />
            </div>
          </div>
          <label class="checkline" for="cc-paid">
            <input
              id="cc-paid"
              name="paid"
              type="checkbox"
              value="true"
              bind:checked={addCreditCardForm.paid}
            />
            <span>Já foi pago</span>
          </label>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (showAddCreditCard = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ADD INCOME MODAL -->
{#if showAddIncome}
  <div
    class="modal-overlay"
    onclick={() => (showAddIncome = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Nova Entrada</span>
        <button class="btn-icon" onclick={() => (showAddIncome = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/addIncome" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-group">
            <label for="inc-name">Nome</label>
            <input id="inc-name" name="name" class="input" required />
          </div>
          <div class="form-group">
            <label for="inc-value">Valor (R$)</label>
            <input
              id="inc-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (showAddIncome = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ADD INVESTMENT MODAL -->
{#if showAddInvestment}
  <div
    class="modal-overlay"
    onclick={() => (showAddInvestment = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Novo Investimento</span>
        <button class="btn-icon" onclick={() => (showAddInvestment = false)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/addInvestment" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-group">
            <label for="inv-name">Nome</label>
            <input id="inv-name" name="name" class="input" required />
          </div>
          <div class="form-group">
            <label for="inv-value">Valor (R$)</label>
            <input
              id="inv-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (showAddInvestment = false)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT PAYMENT CODE MODAL -->
{#if editPayment}
  <div
    class="modal-overlay"
    onclick={() => (editPayment = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Adicionar Código de Pagamento</span>
        <button class="btn-icon" onclick={() => (editPayment = null)}>✕</button>
      </div>
      <form method="POST" action="?/update{editPayment.table}" use:quickEnhance>
        <input type="hidden" name="id" value={editPayment.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="ep-type">Tipo</label>
            <select
              id="ep-type"
              name="payment_code_type"
              class="select"
              bind:value={editPayment.type}
            >
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ep-code">Código</label>
            <textarea
              id="ep-code"
              name="payment_code"
              class="input"
              rows="3"
              placeholder="Cole o código do boleto ou chave PIX"
              bind:value={editPayment.code}
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick={() => (editPayment = null)}
            >Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT FIXED MODAL -->
{#if editFixed}
  <div
    class="modal-overlay"
    onclick={() => (editFixed = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Editar Despesa Fixa</span>
        <button class="btn-icon" onclick={() => (editFixed = null)}>✕</button>
      </div>
      <form method="POST" action="?/updateFixed" use:quickEnhance>
        <input type="hidden" name="id" value={editFixed.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="ef-name">Nome</label>
            <input
              id="ef-name"
              name="name"
              class="input"
              required
              bind:value={editFixed.name}
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="ef-type">Tipo</label>
              <select
                id="ef-type"
                name="payment_type"
                class="select"
                bind:value={editFixed.payment_type}
              >
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div class="form-group">
              <label for="ef-cat">Categoria</label>
              <select
                id="ef-cat"
                name="category_id"
                class="select"
                bind:value={editFixed.category_id}
              >
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="ef-value">Valor (R$)</label>
            <input
              id="ef-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={editFixed.value}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick={() => (editFixed = null)}
            >Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT MONTHLY MODAL -->
{#if editMonthly}
  <div
    class="modal-overlay"
    onclick={() => (editMonthly = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Editar Gasto Mensal</span>
        <button class="btn-icon" onclick={() => (editMonthly = null)}>✕</button>
      </div>
      <form method="POST" action="?/updateMonthly" use:quickEnhance>
        <input type="hidden" name="id" value={editMonthly.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="em-name">Nome</label>
            <input
              id="em-name"
              name="name"
              class="input"
              required
              bind:value={editMonthly.name}
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="em-date">Data</label>
              <input
                id="em-date"
                name="date"
                class="input"
                bind:value={editMonthly.date}
              />
            </div>
            <div class="form-group">
              <label for="em-cat">Categoria</label>
              <select
                id="em-cat"
                name="category_id"
                class="select"
                bind:value={editMonthly.category_id}
              >
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="em-value">Valor (R$)</label>
            <input
              id="em-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={editMonthly.value}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick={() => (editMonthly = null)}
            >Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT CREDIT CARD MODAL -->
{#if editCreditCard}
  <div
    class="modal-overlay"
    onclick={() => (editCreditCard = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Editar Gasto no Cartão</span>
        <button class="btn-icon" onclick={() => (editCreditCard = null)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/updateCreditCard" use:quickEnhance>
        <input type="hidden" name="id" value={editCreditCard.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="ecc-name">Nome</label>
            <input
              id="ecc-name"
              name="name"
              class="input"
              required
              bind:value={editCreditCard.name}
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="ecc-date">Data</label>
              <input
                id="ecc-date"
                name="date"
                class="input"
                bind:value={editCreditCard.date}
              />
            </div>
            <div class="form-group">
              <label for="ecc-cat">Categoria</label>
              <select
                id="ecc-cat"
                name="category_id"
                class="select"
                bind:value={editCreditCard.category_id}
              >
                <option value="">—</option>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="ecc-value">Valor parcelado (R$)</label>
            <input
              id="ecc-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={editCreditCard.value}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (editCreditCard = null)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT INCOME MODAL -->
{#if editIncome}
  <div
    class="modal-overlay"
    onclick={() => (editIncome = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Editar Entrada</span>
        <button class="btn-icon" onclick={() => (editIncome = null)}>✕</button>
      </div>
      <form method="POST" action="?/updateIncome" use:quickEnhance>
        <input type="hidden" name="id" value={editIncome.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="ei-name">Nome</label>
            <input
              id="ei-name"
              name="name"
              class="input"
              required
              bind:value={editIncome.name}
            />
          </div>
          <div class="form-group">
            <label for="ei-value">Valor (R$)</label>
            <input
              id="ei-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={editIncome.value}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick={() => (editIncome = null)}
            >Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- EDIT INVESTMENT MODAL -->
{#if editInvestment}
  <div
    class="modal-overlay"
    onclick={() => (editInvestment = null)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Editar Investimento</span>
        <button class="btn-icon" onclick={() => (editInvestment = null)}
          >✕</button
        >
      </div>
      <form method="POST" action="?/updateInvestment" use:quickEnhance>
        <input type="hidden" name="id" value={editInvestment.id} />
        <div class="modal-body">
          <div class="form-group">
            <label for="einv-name">Nome</label>
            <input
              id="einv-name"
              name="name"
              class="input"
              required
              bind:value={editInvestment.name}
            />
          </div>
          <div class="form-group">
            <label for="einv-value">Valor (R$)</label>
            <input
              id="einv-value"
              name="value"
              type="number"
              step="0.01"
              class="input"
              required
              bind:value={editInvestment.value}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            onclick={() => (editInvestment = null)}>Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- IMPORT MODAL -->
{#if showImport}
  <div
    class="modal-overlay"
    onclick={() => (showImport = false)}
    role="presentation"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <span>Importar Dados</span>
        <button class="btn-icon" onclick={() => (showImport = false)}>✕</button>
      </div>
      <form method="POST" action="?/importData" use:quickEnhance>
        <input type="hidden" name="_month" value={data.month} />
        <input type="hidden" name="_year" value={data.year} />
        <div class="modal-body">
          <div class="form-group">
            <label for="import_text"
              >Cole os dados copiados (Separados por tab ou múltiplos espaços)</label
            >
            <div
              class="form-help"
              style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;"
            >
              Formato esperado: Nome [TAB] Pago? [TAB] Tipo [TAB] Categoria
              [TAB] Valor
            </div>
            <textarea
              id="import_text"
              name="import_text"
              class="input"
              rows="8"
              required
              placeholder="Exemplo:&#10;Conta de Luz&#9;TRUE&#9;Débito&#9;Contas&#9;R$ 150,00"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick={() => (showImport = false)}
            >Cancelar</button
          >
          <button type="submit" class="btn btn-primary">Importar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* ── Header (dark, glassmorphism) ── */
  .header {
    background: linear-gradient(135deg, #0c1220 0%, #162032 50%, #1a2640 100%);
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), 0 1px 0 rgba(255, 255, 255, 0.03) inset;
  }
  .header-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
  }
  .logo {
    font-size: 1.3rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #fff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .month-nav {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .header-action {
    padding: 7px 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(8px);
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    transition: all var(--transition);
    font-family: inherit;
  }
  .header-action:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .header-action:active {
    transform: translateY(0);
  }
  .month-selector {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 3px;
    backdrop-filter: blur(8px);
  }
  .btn-nav {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    transition: all var(--transition);
  }
  .btn-nav:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    transform: scale(1.05);
  }
  .btn-nav:active {
    transform: scale(0.95);
  }
  .month-label {
    font-weight: 600;
    font-size: 0.92rem;
    min-width: 150px;
    text-align: center;
    padding: 0 8px;
    color: #fff;
    letter-spacing: 0.01em;
  }

  /* ── Layout ── */
  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 28px 24px 60px;
  }
  .banner {
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    margin-bottom: 18px;
    font-size: 0.9rem;
    border: 1px solid transparent;
  }
  .banner-success {
    background: var(--success-light);
    color: #166534;
    border-color: rgba(16, 185, 129, 0.18);
  }
  .banner-inline {
    margin-bottom: 14px;
  }
  .banner-error {
    background: var(--danger-light);
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.18);
  }
  .banner-info {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: rgba(59, 130, 246, 0.18);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .banner-action {
    border: 1px solid rgba(29, 78, 216, 0.2);
    border-radius: var(--radius-xs);
    background: #fff;
    color: #1d4ed8;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 7px 10px;
    cursor: pointer;
  }
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow);
    transition: all var(--transition-slow);
    position: relative;
    overflow: hidden;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent, var(--primary));
    border-radius: var(--radius) var(--radius) 0 0;
    opacity: 0.6;
    transition: opacity var(--transition);
  }
  .stat-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  .stat-card:hover::before {
    opacity: 1;
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 20px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .side-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .header-total {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.88rem;
    margin-left: 8px;
  }
  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .form-help {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }
  .backup-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .backup-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    padding: 16px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
  }
  .backup-section-import {
    display: block;
  }
  .backup-copy h3 {
    font-size: 0.98rem;
    margin-bottom: 4px;
    color: var(--text);
  }
  .backup-copy p {
    font-size: 0.84rem;
    color: var(--text-secondary);
    max-width: 56ch;
  }
  .backup-check {
    margin-top: 14px;
  }
  .backup-footer {
    padding: 0;
    margin-top: 18px;
  }

  /* ── Table elements ── */
  .checkbox-btn {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border);
    border-radius: 7px;
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    color: white;
    transition: all var(--transition-spring);
    cursor: pointer;
  }
  .checkbox-btn:hover {
    border-color: var(--primary);
    transform: scale(1.1);
  }
  .checkbox-btn.checked {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3);
    transform: scale(1);
  }
  .checkbox-btn.checked:hover {
    transform: scale(1.1);
  }
  .checkline {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.92rem;
  }
  .badge-debit {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .badge-credit {
    background: #fce7f3;
    color: #be185d;
  }
  .draggable-row {
    cursor: grab;
  }
  .draggable-row:active {
    cursor: grabbing;
    opacity: 0.7;
  }
  .drag-over-target {
    border: 2px dashed var(--primary);
    background-color: var(--primary-light);
    transition: all var(--transition);
  }

  /* ── Row actions (show on hover) ── */
  .row-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--transition), transform var(--transition);
    transform: translateX(4px);
  }
  :global(tr:hover) .row-actions {
    opacity: 1;
    transform: translateX(0);
  }

  /* ── Payment badges ── */
  .pay-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: 0.04em;
    border: none;
    cursor: pointer;
    transition: all var(--transition-spring);
    background: #fef3c7;
    color: #92400e;
  }
  .pay-badge:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    transform: scale(1.08) translateY(-1px);
  }
  .pay-badge:active {
    transform: scale(0.98);
  }
  .pay-badge-pix {
    background: #d1fae5;
    color: #065f46;
  }

  /* ── Compact list (Entradas, Investimentos) ── */
  .compact-list {
    display: flex;
    flex-direction: column;
  }
  .compact-row {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    gap: 8px;
    border-bottom: 1px solid var(--border-light);
    transition: all var(--transition);
  }
  .compact-row:last-child {
    border-bottom: none;
  }
  .compact-row:hover {
    background: var(--surface-hover);
    padding-left: 20px;
  }
  .compact-name {
    flex: 1;
    font-size: 0.88rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .compact-value {
    font-size: 0.88rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .compact-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--transition), transform var(--transition);
    transform: translateX(4px);
  }
  .compact-row:hover .compact-actions {
    opacity: 1;
    transform: translateX(0);
  }
  .compact-total {
    font-weight: 700;
    background: linear-gradient(to right, var(--surface-hover), var(--surface));
  }
  .compact-total:hover {
    padding-left: 16px;
  }

  /* ── Payment type bars ── */
  .payment-type-bars {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .pt-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pt-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pt-bar {
    height: 8px;
    background: var(--bg);
    border-radius: 100px;
    overflow: hidden;
  }
  .pt-bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .pt-bar-debit {
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
  }
  .pt-bar-credit {
    background: linear-gradient(90deg, #e11d48, #f472b6);
  }

  /* ── Categories (unified card) ── */
  .cat-chart-wrap {
    max-width: 260px;
    margin: 0 auto 24px;
  }
  .cat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .cat-card {
    padding: 11px 13px;
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    border: 1px solid transparent;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all var(--transition);
  }
  .cat-card:hover {
    border-color: var(--border);
    box-shadow: var(--shadow);
    transform: translateY(-1px);
  }
  .cat-card-over {
    background: var(--danger-light);
    border-color: rgba(239, 68, 68, 0.15);
  }
  .cat-card-empty {
    opacity: 0.45;
  }
  .cat-card-empty:hover {
    opacity: 0.85;
  }
  .cat-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cat-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
  }
  .cat-name {
    font-size: 0.8rem;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cat-pct {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .cat-bar {
    height: 5px;
    background: var(--border);
    border-radius: 100px;
    overflow: hidden;
  }
  .cat-bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .cat-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cat-value {
    font-size: 0.8rem;
    font-weight: 600;
  }
  .cat-budget-form {
    display: flex;
    align-items: center;
  }
  .cat-budget-input {
    width: 68px;
    text-align: right;
    padding: 3px 7px;
    font-size: 0.75rem;
    border-radius: var(--radius-xs);
    background: var(--surface);
    transition: all var(--transition);
  }
  .cat-budget-input:focus {
    box-shadow: 0 0 0 2px rgba(225, 29, 72, 0.1);
  }
  .cat-toggle {
    display: block;
    width: 100%;
    text-align: center;
    padding: 11px;
    margin-top: 14px;
    border: 1.5px dashed var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }
  .cat-toggle:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-light);
    transform: translateY(-1px);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .stats-bar {
      grid-template-columns: repeat(2, 1fr);
    }
    .side-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .stats-bar {
      grid-template-columns: 1fr;
    }
    .main {
      padding: 12px;
    }
    .backup-section {
      flex-direction: column;
    }
    .card-actions {
      width: 100%;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .cat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
