<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "$lib/Chart.svelte";
  import Modal from "$lib/Modal.svelte";
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

  const MONTHS_SHORT = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];

  const initialDate = new Date();

  let finance: FinanceDataStore | null = null;
  let data = $state<MonthSummary>(
    createEmptyMonthSummary(
      initialDate.getMonth() + 1,
      initialDate.getFullYear(),
    ),
  );
  let prev = $state<MonthSummary>(
    createEmptyMonthSummary(
      initialDate.getMonth() + 1,
      initialDate.getFullYear(),
    ),
  );
  let form = $state<Record<string, string>>({});

  let theme = $state<"light" | "dark">("light");
  let activeTab = $state<"fixed" | "monthly" | "credit">("fixed");
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

  type SortField = "name" | "value" | "date" | "installments";
  type SortDir = "asc" | "desc";
  let sortFixed = $state<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" });
  let sortMonthly = $state<{ field: SortField; dir: SortDir }>({ field: "date", dir: "asc" });
  let sortCredit = $state<{ field: SortField; dir: SortDir }>({ field: "date", dir: "asc" });

  let draggingExpense = $state<any>(null);
  let draggingSource = $state<string>("");
  let moveForm = $state<HTMLFormElement | null>(null);
  let hasVisibleData = $derived(
    data.totalExpenses > 0 ||
      data.totalIncome > 0 ||
      data.totalInvestments > 0 ||
      data.byCategory.some((category) => category.expected > 0),
  );

  let deltaExpenses = $derived(computeDelta(data.totalExpenses, prev.totalExpenses));
  let deltaIncome = $derived(computeDelta(data.totalIncome, prev.totalIncome));
  let deltaBalance = $derived(computeDelta(data.balance, prev.balance));
  let deltaInvestments = $derived(computeDelta(data.totalInvestments, prev.totalInvestments));
  let prevLabel = $derived(MONTHS_SHORT[((data.month - 2 + 12) % 12)]);

  let sortedFixed = $derived(sortRows(data.fixed, sortFixed));
  let sortedMonthly = $derived(sortRows(data.monthly, sortMonthly));
  let sortedCredit = $derived(sortRows(data.creditCard, sortCredit));

  onMount(() => {
    finance = new FinanceDataStore();

    const stored = localStorage.getItem("finance:theme");
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
    applyTheme(theme);

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

  function applyTheme(value: "light" | "dark") {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", value);
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("finance:theme", theme);
    }
  }

  function goToToday() {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    if (m === data.month && y === data.year) return;
    setUrlMonthYear(m, y);
    refreshData(m, y);
  }

  function computeDelta(current: number, previous: number) {
    const diff = current - previous;
    if (previous === 0 && current === 0) return { diff: 0, pct: 0, has: false };
    if (previous === 0) return { diff, pct: 100, has: true };
    return { diff, pct: (diff / Math.abs(previous)) * 100, has: true };
  }

  function toggleSort(
    sortRef: { field: SortField; dir: SortDir },
    field: SortField,
  ): { field: SortField; dir: SortDir } {
    if (sortRef.field === field) {
      return { field, dir: sortRef.dir === "asc" ? "desc" : "asc" };
    }
    return { field, dir: "asc" };
  }

  function parseDateForSort(raw: string | null | undefined): number {
    if (!raw) return Number.MAX_SAFE_INTEGER;
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    return month * 100 + day;
  }

  function sortRows<T extends { name?: string; value?: number; date?: string; total_installments?: number }>(
    rows: T[],
    sort: { field: SortField; dir: SortDir },
  ): T[] {
    const out = [...rows];
    const dirMul = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let cmp = 0;
      if (sort.field === "name") {
        cmp = (a.name || "").localeCompare(b.name || "", "pt-BR");
      } else if (sort.field === "value") {
        cmp = (a.value || 0) - (b.value || 0);
      } else if (sort.field === "date") {
        cmp = parseDateForSort(a.date) - parseDateForSort(b.date);
      } else if (sort.field === "installments") {
        cmp = (a.total_installments || 0) - (b.total_installments || 0);
      }
      return cmp * dirMul;
    });
    return out;
  }

  function getPreviousMonthOf(month: number, year: number) {
    if (month === 1) return { month: 12, year: year - 1 };
    return { month: month - 1, year };
  }

  function createCopyFixedForm() {
    const previous = getPreviousMonthOf(data.month, data.year);

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
    const store = getFinance();
    data = store.getMonthSummary(month, year);
    const previous = getPreviousMonthOf(month, year);
    prev = store.getMonthSummary(previous.month, previous.year);
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
      <button
        class="header-icon-btn"
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        aria-label="Alternar tema"
        onclick={toggleTheme}
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>
      <button class="header-action" onclick={() => (showImport = true)}
        >Importar Dados</button
      >
      <button class="header-action" onclick={() => (showBackup = true)}
        >Backup</button
      >
      <div class="month-selector">
        <button class="btn-nav" onclick={() => navigateMonth(-1)} aria-label="Mês anterior">&larr;</button>
        <span class="month-label">{MONTHS[data.month - 1]} {data.year}</span>
        <button class="btn-nav" onclick={() => navigateMonth(1)} aria-label="Próximo mês">&rarr;</button>
        <button class="btn-today" onclick={goToToday} title="Voltar para o mês atual">Hoje</button>
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
    <div class="stat-card stat-card-hero" style="--accent: {data.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
      <div class="stat-card-head">
        <span class="stat-icon" aria-hidden="true">{data.balance >= 0 ? "▲" : "▼"}</span>
        <span class="stat-label">Saldo do mês</span>
      </div>
      <span
        class="stat-value stat-value-hero"
        class:positive={data.balance >= 0}
        class:negative={data.balance < 0}
      >
        {fmt(data.balance)}
      </span>
      {#if deltaBalance.has}
        <span
          class="stat-delta"
          class:delta-up={deltaBalance.diff > 0}
          class:delta-down={deltaBalance.diff < 0}
        >
          {deltaBalance.diff >= 0 ? "↑" : "↓"} {Math.abs(deltaBalance.pct).toFixed(0)}% vs {prevLabel}
        </span>
      {/if}
    </div>

    <div class="stat-card" style="--accent: var(--success)">
      <div class="stat-card-head">
        <span class="stat-icon" aria-hidden="true">+</span>
        <span class="stat-label">Entradas</span>
      </div>
      <span class="stat-value positive">{fmt(data.totalIncome)}</span>
      {#if deltaIncome.has}
        <span
          class="stat-delta"
          class:delta-up={deltaIncome.diff > 0}
          class:delta-down={deltaIncome.diff < 0}
        >
          {deltaIncome.diff >= 0 ? "↑" : "↓"} {Math.abs(deltaIncome.pct).toFixed(0)}% vs {prevLabel}
        </span>
      {/if}
    </div>

    <div class="stat-card" style="--accent: var(--danger)">
      <div class="stat-card-head">
        <span class="stat-icon" aria-hidden="true">−</span>
        <span class="stat-label">Total de Gastos</span>
      </div>
      <span class="stat-value negative">{fmt(data.totalExpenses)}</span>
      {#if deltaExpenses.has}
        <span
          class="stat-delta"
          class:delta-up={deltaExpenses.diff < 0}
          class:delta-down={deltaExpenses.diff > 0}
        >
          {deltaExpenses.diff >= 0 ? "↑" : "↓"} {Math.abs(deltaExpenses.pct).toFixed(0)}% vs {prevLabel}
        </span>
      {/if}
    </div>

    <div class="stat-card" style="--accent: var(--info)">
      <div class="stat-card-head">
        <span class="stat-icon" aria-hidden="true">◇</span>
        <span class="stat-label">Investimentos</span>
      </div>
      <span class="stat-value" style="color: var(--info)">{fmt(data.totalInvestments)}</span>
      {#if deltaInvestments.has}
        <span
          class="stat-delta"
          class:delta-up={deltaInvestments.diff > 0}
          class:delta-down={deltaInvestments.diff < 0}
        >
          {deltaInvestments.diff >= 0 ? "↑" : "↓"} {Math.abs(deltaInvestments.pct).toFixed(0)}% vs {prevLabel}
        </span>
      {/if}
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- LEFT COLUMN -->
    <div class="col">
      <!-- Tabbed expense card: Fixos / Mensais / Crédito -->
      <div class="card expenses-card">
        <div class="tab-bar" role="tablist">
          <button
            class="tab-btn"
            class:active={activeTab === "fixed"}
            role="tab"
            aria-selected={activeTab === "fixed"}
            onclick={() => (activeTab = "fixed")}
          >
            <span class="tab-label">Fixos</span>
            <span class="tab-total">{fmt(data.totalFixed)}</span>
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "monthly"}
            role="tab"
            aria-selected={activeTab === "monthly"}
            onclick={() => (activeTab = "monthly")}
          >
            <span class="tab-label">Mensais</span>
            <span class="tab-total">{fmt(data.totalMonthly)}</span>
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "credit"}
            role="tab"
            aria-selected={activeTab === "credit"}
            onclick={() => (activeTab = "credit")}
          >
            <span class="tab-label">Cartão</span>
            <span class="tab-total">{fmt(data.totalCreditCard)}</span>
          </button>
          <div class="tab-actions">
            {#if activeTab === "fixed"}
              <button class="btn btn-sm" onclick={openCopyFixed}>Copiar</button>
              <button
                class="btn btn-sm btn-primary"
                onclick={() => (showAddFixed = true)}>+ Adicionar</button
              >
            {:else if activeTab === "monthly"}
              <button
                class="btn btn-sm btn-primary"
                onclick={() => (showAddMonthly = true)}>+ Adicionar</button
              >
            {:else}
              <button
                class="btn btn-sm btn-primary"
                onclick={() => openAddCreditCard()}>+ Adicionar</button
              >
            {/if}
          </div>
        </div>

      {#if activeTab === "fixed"}
      <div
        class="tab-pane"
        role="region"
        aria-label="Despesas Fixas"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "fixed")}
        class:drag-over-target={draggingSource && draggingSource !== "fixed"}
      >
        <div class="card-body">
          {#if sortedFixed.length === 0}
            <div class="empty-state">
              <p>Nenhuma despesa fixa neste mês.</p>
              <button class="btn btn-sm" onclick={openCopyFixed}>Copiar de outro mês</button>
            </div>
          {:else}
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th class="sortable" class:sort-active={sortFixed.field === "name"} onclick={() => (sortFixed = toggleSort(sortFixed, "name"))}>
                  Nome<span class="sort-arrow">{sortFixed.field === "name" ? (sortFixed.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th class="sortable" class:sort-active={sortFixed.field === "value"} onclick={() => (sortFixed = toggleSort(sortFixed, "value"))}>
                  Valor<span class="sort-arrow">{sortFixed.field === "value" ? (sortFixed.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each sortedFixed as expense}
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
          {/if}
        </div>
      </div>
      {/if}

      {#if activeTab === "monthly"}
      <div
        class="tab-pane"
        role="region"
        aria-label="Despesas Mensais"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "monthly")}
        class:drag-over-target={draggingSource && draggingSource !== "monthly"}
      >
        <div class="card-body">
          {#if sortedMonthly.length === 0}
            <div class="empty-state">
              <p>Nenhum gasto registrado neste mês.</p>
              <button class="btn btn-sm btn-primary" onclick={() => (showAddMonthly = true)}>+ Adicionar primeiro gasto</button>
            </div>
          {:else}
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th class="sortable" class:sort-active={sortMonthly.field === "name"} onclick={() => (sortMonthly = toggleSort(sortMonthly, "name"))}>
                  Nome<span class="sort-arrow">{sortMonthly.field === "name" ? (sortMonthly.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th class="sortable" class:sort-active={sortMonthly.field === "date"} onclick={() => (sortMonthly = toggleSort(sortMonthly, "date"))}>
                  Data<span class="sort-arrow">{sortMonthly.field === "date" ? (sortMonthly.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Categoria</th>
                <th class="sortable" class:sort-active={sortMonthly.field === "value"} onclick={() => (sortMonthly = toggleSort(sortMonthly, "value"))}>
                  Valor<span class="sort-arrow">{sortMonthly.field === "value" ? (sortMonthly.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each sortedMonthly as expense}
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
          {/if}
        </div>
      </div>
      {/if}

      {#if activeTab === "credit"}
      <div
        class="tab-pane"
        role="region"
        aria-label="Cartão de Crédito"
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, "creditCard")}
        class:drag-over-target={draggingSource && draggingSource !== "creditCard"}
      >
        <div class="card-body">
          {#if sortedCredit.length === 0}
            <div class="empty-state">
              <p>Nenhuma compra no cartão neste mês.</p>
              <button class="btn btn-sm btn-primary" onclick={() => openAddCreditCard()}>+ Adicionar compra</button>
            </div>
          {:else}
          <table>
            <thead>
              <tr>
                <th>Pago</th>
                <th class="sortable" class:sort-active={sortCredit.field === "name"} onclick={() => (sortCredit = toggleSort(sortCredit, "name"))}>
                  Nome<span class="sort-arrow">{sortCredit.field === "name" ? (sortCredit.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th class="sortable" class:sort-active={sortCredit.field === "installments"} onclick={() => (sortCredit = toggleSort(sortCredit, "installments"))}>
                  Parcelas<span class="sort-arrow">{sortCredit.field === "installments" ? (sortCredit.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th class="sortable" class:sort-active={sortCredit.field === "date"} onclick={() => (sortCredit = toggleSort(sortCredit, "date"))}>
                  Data<span class="sort-arrow">{sortCredit.field === "date" ? (sortCredit.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Categoria</th>
                <th class="sortable" class:sort-active={sortCredit.field === "value"} onclick={() => (sortCredit = toggleSort(sortCredit, "value"))}>
                  Valor<span class="sort-arrow">{sortCredit.field === "value" ? (sortCredit.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </th>
                <th>Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each sortedCredit as expense}
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
          {/if}
        </div>
      </div>
      {/if}
      </div><!-- /.expenses-card -->
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
        <div class="card-body cat-layout">
          <!-- Chart -->
          <div class="cat-chart-wrap">
            <Chart categories={data.byCategory.filter((c) => c.spent > 0)} />
          </div>

          <div class="cat-list">
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
            <div class="cat-divider"></div>
            <button class="cat-toggle" onclick={() => (showAllCategories = !showAllCategories)}>
              {showAllCategories ? 'Ocultar' : 'Mostrar'} categorias sem gastos ({data.byCategory.filter(c => c.spent === 0 && c.expected === 0).length})
            </button>

            {#if showAllCategories}
              <div class="cat-grid cat-grid-empty">
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
          </div><!-- /.cat-list -->
        </div>
      </div>
    </div>
  </div>
</main>

<!-- ADD FIXED MODAL -->
<Modal open={showAddFixed} title="Nova Despesa Fixa" onClose={() => (showAddFixed = false)}>
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
</Modal>

<!-- BACKUP MODAL -->
<Modal open={showBackup} title="Backup Completo" onClose={() => (showBackup = false)}>
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
</Modal>

<!-- COPY FIXED MODAL -->
<Modal open={showCopyFixed} title="Copiar Fixos" onClose={() => (showCopyFixed = false)}>
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
</Modal>

<!-- ADD MONTHLY MODAL -->
<Modal open={showAddMonthly} title="Novo Gasto do Mês" onClose={() => (showAddMonthly = false)}>
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
</Modal>

<!-- ADD CREDIT CARD MODAL -->
<Modal open={showAddCreditCard} title="Nova Despesa Cartão de Crédito" onClose={() => (showAddCreditCard = false)}>
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
</Modal>

<!-- ADD INCOME MODAL -->
<Modal open={showAddIncome} title="Nova Entrada" onClose={() => (showAddIncome = false)}>
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
</Modal>

<!-- ADD INVESTMENT MODAL -->
<Modal open={showAddInvestment} title="Novo Investimento" onClose={() => (showAddInvestment = false)}>
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
</Modal>

<!-- EDIT PAYMENT CODE MODAL -->
<Modal open={editPayment !== null} title="Adicionar Código de Pagamento" onClose={() => (editPayment = null)}>
  {#if editPayment}
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
  {/if}
</Modal>

<!-- EDIT FIXED MODAL -->
<Modal open={editFixed !== null} title="Editar Despesa Fixa" onClose={() => (editFixed = null)}>
  {#if editFixed}
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
  {/if}
</Modal>

<!-- EDIT MONTHLY MODAL -->
<Modal open={editMonthly !== null} title="Editar Gasto Mensal" onClose={() => (editMonthly = null)}>
  {#if editMonthly}
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
  {/if}
</Modal>

<!-- EDIT CREDIT CARD MODAL -->
<Modal open={editCreditCard !== null} title="Editar Gasto no Cartão" onClose={() => (editCreditCard = null)}>
  {#if editCreditCard}
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
  {/if}
</Modal>

<!-- EDIT INCOME MODAL -->
<Modal open={editIncome !== null} title="Editar Entrada" onClose={() => (editIncome = null)}>
  {#if editIncome}
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
  {/if}
</Modal>

<!-- EDIT INVESTMENT MODAL -->
<Modal open={editInvestment !== null} title="Editar Investimento" onClose={() => (editInvestment = null)}>
  {#if editInvestment}
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
  {/if}
</Modal>

<!-- IMPORT MODAL -->
<Modal open={showImport} title="Importar Dados" onClose={() => (showImport = false)}>
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
</Modal>

<style>
  /* ── Header ── */
  .header {
    background: var(--header-bg);
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
    color: var(--header-text);
    letter-spacing: -0.03em;
  }
  .month-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--header-control-border);
    background: var(--header-control-bg);
    color: var(--header-text);
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition);
  }
  .header-icon-btn:hover {
    background: var(--header-control-hover);
    transform: translateY(-1px);
  }
  .header-action {
    padding: 7px 16px;
    border: 1px solid var(--header-control-border);
    border-radius: var(--radius-sm);
    background: var(--header-control-bg);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--header-text-muted);
    cursor: pointer;
    transition: all var(--transition);
    font-family: inherit;
  }
  .header-action:hover {
    background: var(--header-control-hover);
    color: var(--header-text);
    transform: translateY(-1px);
  }
  .month-selector {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--header-control-bg);
    border: 1px solid var(--header-control-border);
    border-radius: 12px;
    padding: 3px;
  }
  .btn-nav {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.55);
    font-weight: 500;
    transition: all var(--transition);
  }
  .btn-nav:hover {
    background: var(--header-control-hover);
    color: var(--header-text);
  }
  .btn-today {
    height: 28px;
    padding: 0 12px;
    margin-left: 4px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: var(--radius-xs);
    transition: all var(--transition);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .btn-today:hover {
    background: var(--header-control-hover);
    color: var(--header-text);
  }
  .month-label {
    font-weight: 600;
    font-size: 0.92rem;
    min-width: 140px;
    text-align: center;
    padding: 0 8px;
    color: var(--header-text);
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
    color: var(--success-text);
    border-color: rgba(16, 185, 129, 0.22);
  }
  .banner-inline {
    margin-bottom: 14px;
  }
  .banner-error {
    background: var(--danger-light);
    color: var(--danger-text);
    border-color: rgba(239, 68, 68, 0.22);
  }
  .banner-info {
    background: var(--info-banner-bg);
    color: var(--info-text);
    border-color: rgba(99, 102, 241, 0.22);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .banner-action {
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: var(--radius-xs);
    background: var(--surface);
    color: var(--info-text);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 7px 10px;
    cursor: pointer;
  }

  /* ── Stats bar ── */
  .stats-bar {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    opacity: 0.7;
    transition: opacity var(--transition);
  }
  .stat-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  .stat-card:hover::before {
    opacity: 1;
  }
  .stat-card-hero {
    padding: 22px 26px;
    background: linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%);
  }
  .stat-card-hero::before {
    height: 4px;
  }
  .stat-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stat-icon {
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent, var(--primary));
    background: color-mix(in srgb, var(--accent, var(--primary)) 12%, transparent);
  }
  .stat-value-hero {
    font-size: 2.1rem;
    margin-top: 2px;
  }
  .stat-delta {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .stat-delta.delta-up { color: var(--success); }
  .stat-delta.delta-down { color: var(--danger); }

  /* ── Dashboard ── */
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
  .mono { font-variant-numeric: tabular-nums; }
  .form-help {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  /* ── Tabs (expense card) ── */
  .expenses-card { padding: 0; }
  .tab-bar {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--border-light);
    background: linear-gradient(to bottom, var(--surface), var(--surface-hover));
    padding: 0 16px;
    gap: 4px;
  }
  .tab-btn {
    border: none;
    background: transparent;
    padding: 14px 18px 12px;
    font-family: inherit;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all var(--transition);
  }
  .tab-btn:hover {
    color: var(--text);
    background: var(--surface-hover);
  }
  .tab-btn.active {
    color: var(--text);
    border-bottom-color: var(--primary);
    background: var(--surface);
  }
  .tab-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .tab-total {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .tab-btn.active .tab-total {
    color: var(--text-secondary);
  }
  .tab-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
  }
  .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }
  .empty-state p {
    font-size: 0.9rem;
  }

  /* ── Backup modal ── */
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
    position: relative;
  }
  .checkbox-btn::before {
    /* Larger touch target without affecting layout */
    content: '';
    position: absolute;
    inset: -10px;
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
  .draggable-row {
    cursor: grab;
  }
  .draggable-row:active {
    cursor: grabbing;
    opacity: 0.7;
  }
  .drag-over-target {
    outline: 2px dashed var(--primary);
    outline-offset: -4px;
    background-color: var(--primary-light);
    transition: all var(--transition);
  }

  /* ── Row actions ── */
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
    background: var(--pay-pending-bg);
    color: var(--pay-pending-color);
  }
  .pay-badge:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    transform: scale(1.08) translateY(-1px);
  }
  .pay-badge:active {
    transform: scale(0.98);
  }
  .pay-badge-pix {
    background: var(--pay-pix-bg);
    color: var(--pay-pix-color);
  }

  /* ── Compact list ── */
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
    position: relative;
  }
  .compact-row:last-child {
    border-bottom: none;
  }
  .compact-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--primary);
    border-radius: 0 3px 3px 0;
    opacity: 0;
    transition: opacity var(--transition);
  }
  .compact-row:hover {
    background: var(--surface-hover);
  }
  .compact-row:hover::before {
    opacity: 1;
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

  /* ── Categories ── */
  .cat-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 24px;
    padding: 20px;
    align-items: start;
  }
  .cat-chart-wrap {
    max-width: 240px;
    width: 100%;
    margin: 0;
    position: sticky;
    top: 80px;
  }
  .cat-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .cat-grid-empty {
    margin-top: 4px;
  }
  .cat-divider {
    height: 1px;
    background: var(--border-light);
    margin: 6px 0 2px;
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
    border-color: rgba(239, 68, 68, 0.18);
  }
  .cat-card-empty {
    opacity: 0.55;
  }
  .cat-card-empty:hover {
    opacity: 0.9;
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
    box-shadow: 0 0 0 2px var(--surface);
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
    width: 78px;
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
    padding: 10px;
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
  }

  /* ── Responsive ── */
  @media (max-width: 1100px) {
    .stats-bar {
      grid-template-columns: 1fr 1fr;
    }
    .stat-card-hero {
      grid-column: span 2;
    }
    .cat-layout {
      grid-template-columns: 1fr;
    }
    .cat-chart-wrap {
      max-width: 240px;
      margin: 0 auto 12px;
      position: static;
    }
  }
  @media (max-width: 900px) {
    .side-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .stats-bar {
      grid-template-columns: 1fr;
    }
    .stat-card-hero {
      grid-column: span 1;
    }
    .main {
      padding: 12px;
    }
    .backup-section {
      flex-direction: column;
    }
    .tab-bar {
      flex-wrap: wrap;
      padding: 0 8px;
    }
    .tab-actions {
      width: 100%;
      justify-content: flex-end;
      padding: 0 0 10px;
    }
    .cat-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
