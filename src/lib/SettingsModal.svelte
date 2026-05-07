<script lang="ts">
  import Modal from "$lib/Modal.svelte";
  import {
    FinanceDataStore,
    type CategorizeRule,
    type Category,
    type FinanceSettings,
  } from "$lib/client/finance-data";

  interface Props {
    open: boolean;
    onClose: () => void;
    finance: FinanceDataStore | null;
    categories: Category[];
    onChange: () => void;
  }

  let { open, onClose, finance, categories, onChange }: Props = $props();

  let settings = $state<FinanceSettings | null>(null);
  let newKeyword = $state("");
  let newCategory = $state<number | null>(null);
  let permissionState = $state<NotificationPermission>("default");

  $effect(() => {
    if (open && finance) {
      settings = finance.getSettings();
      if (typeof Notification !== "undefined") {
        permissionState = Notification.permission;
      }
    }
  });

  function commitField<K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) {
    if (!finance || !settings) return;
    settings = { ...settings, [key]: value };
    finance.updateSettings({ [key]: value } as Partial<FinanceSettings>);
    onChange();
  }

  function addRule() {
    if (!finance || !newKeyword.trim() || newCategory === null) return;
    finance.addCategorizeRule(newKeyword, newCategory);
    settings = finance.getSettings();
    newKeyword = "";
    newCategory = null;
    onChange();
  }

  function removeRule(rule: CategorizeRule) {
    if (!finance) return;
    finance.removeCategorizeRule(rule.id);
    settings = finance.getSettings();
    onChange();
  }

  async function requestNotification() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    permissionState = result;
    if (result === "granted") {
      commitField("notifications_enabled", 1);
    } else {
      commitField("notifications_enabled", 0);
    }
  }

  function categoryName(id: number) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }
</script>

<Modal {open} {onClose} title="Configurações" size="lg">
  <div class="modal-body settings-body">
    {#if settings}
      <section>
        <h3>Reserva de emergência</h3>
        <p class="hint">Quantos meses de despesa a reserva ideal deve cobrir.</p>
        <div class="row">
          <input
            type="number"
            min="1"
            max="36"
            class="input num-input"
            value={settings.emergency_reserve_target_months}
            onchange={(e) =>
              commitField(
                "emergency_reserve_target_months",
                Math.max(1, Math.min(36, parseInt(e.currentTarget.value, 10) || 6)),
              )}
          />
          <span class="unit">meses</span>
        </div>
      </section>

      <section>
        <h3>Notificações de vencimento</h3>
        <p class="hint">
          Avisa via notificação do navegador quando uma despesa fixa estiver
          próxima do vencimento.
        </p>
        <div class="row">
          <label class="toggle">
            <input
              type="checkbox"
              checked={settings.notifications_enabled === 1 && permissionState === "granted"}
              disabled={permissionState === "denied"}
              onchange={(e) => {
                if (e.currentTarget.checked) {
                  if (permissionState === "granted") {
                    commitField("notifications_enabled", 1);
                  } else {
                    requestNotification();
                  }
                } else {
                  commitField("notifications_enabled", 0);
                }
              }}
            />
            <span>
              {permissionState === "denied"
                ? "Permissão negada — habilite nas configurações do navegador"
                : permissionState === "granted"
                  ? "Notificações ativas"
                  : "Habilitar notificações"}
            </span>
          </label>
        </div>
        <div class="row">
          <span class="row-label">Avisar com antecedência de</span>
          <input
            type="number"
            min="0"
            max="30"
            class="input num-input"
            value={settings.due_alert_days_ahead}
            onchange={(e) =>
              commitField(
                "due_alert_days_ahead",
                Math.max(0, Math.min(30, parseInt(e.currentTarget.value, 10) || 3)),
              )}
          />
          <span class="unit">dia(s)</span>
        </div>
      </section>

      <section>
        <h3>Auto-categorização</h3>
        <p class="hint">
          Quando uma palavra-chave aparece no nome do gasto, a categoria
          correspondente é sugerida. Útil para imports OFX e digitação rápida.
        </p>

        <div class="add-rule">
          <input
            class="input"
            placeholder="Palavra-chave (ex: ifood, uber)"
            bind:value={newKeyword}
          />
          <select class="select" bind:value={newCategory}>
            <option value={null}>Selecione</option>
            {#each categories as cat}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
          <button
            class="btn btn-primary"
            disabled={!newKeyword.trim() || newCategory === null}
            onclick={addRule}
          >
            Adicionar
          </button>
        </div>

        {#if settings.categorize_rules.length === 0}
          <div class="empty">Nenhuma regra cadastrada.</div>
        {:else}
          <div class="rules">
            {#each settings.categorize_rules as rule}
              <div class="rule">
                <span class="kw">{rule.keyword}</span>
                <span class="arrow">→</span>
                <span class="cat">{categoryName(rule.category_id)}</span>
                <button class="btn-icon btn-danger" onclick={() => removeRule(rule)}>✕</button>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>
</Modal>

<style>
  .settings-body {
    gap: 24px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  section h3 {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }
  .hint {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .row-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .num-input {
    width: 90px;
  }
  .unit {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.88rem;
    color: var(--text);
    cursor: pointer;
  }
  .add-rule {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
  }
  .empty {
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 14px;
    text-align: center;
    background: var(--surface-hover);
    border-radius: var(--radius-sm);
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rule {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    background: var(--surface-hover);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
  }
  .kw {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.84rem;
    background: var(--surface);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-light);
  }
  .arrow {
    color: var(--text-muted);
  }
  .cat {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .add-rule { grid-template-columns: 1fr; }
    .rule { grid-template-columns: 1fr auto auto; }
    .rule .arrow { display: none; }
  }
</style>
