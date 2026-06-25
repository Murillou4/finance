<script lang="ts">
  import Modal from "$lib/Modal.svelte";
  import {
    FinanceDataStore,
    type CategorizeRule,
    type Category,
    type FinanceSettings,
  } from "$lib/client/finance-data";
  import { driveSync, type DriveSyncStatus } from "$lib/client/drive-sync";

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
  let driveStatus = $state<DriveSyncStatus>({ connected: false, isSyncing: false });

  $effect(() => {
    if (!open || !finance) return;

    settings = finance.getSettings();
    if (typeof Notification !== "undefined") {
      permissionState = Notification.permission;
    }
    const unsubscribe = driveSync.setListener((status) => {
      driveStatus = status;
    });

    return () => unsubscribe();
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
        <h3>Sincronização com Google Drive</h3>
        <p class="hint">
          Seus dados ficam no Google Drive e sao sincronizados automaticamente.
        </p>
        {#if driveStatus.connected}
          <div class="drive-status-block">
            <div class="drive-status-row">
              <span class="status-dot"></span>
              <span class="status-text">Conectado ao Google Drive</span>
              {#if driveStatus.isSyncing}
                <span class="sync-pill syncing">Sincronizando...</span>
              {:else if driveStatus.error}
                <span class="sync-pill error">Erro</span>
              {:else if driveStatus.lastSync}
                <span class="sync-pill ok">✓ Sincronizado</span>
              {/if}
            </div>

            {#if driveStatus.lastSync && !driveStatus.isSyncing}
              <p class="last-sync">
                Última sincronização: {driveStatus.lastSync.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            {/if}

            {#if driveStatus.error}
              <p class="sync-error">&#x274c; {driveStatus.error}</p>
            {/if}

            <div class="drive-actions">
              <button
                class="btn btn-secondary btn-sm"
                disabled={driveStatus.isSyncing}
                onclick={async () => {
                  if (finance) {
                    await driveSync.uploadBackupNow(finance.exportBackupData());
                  }
                }}
              >
                {driveStatus.isSyncing ? 'Sincronizando...' : '↻ Sincronizar agora'}
              </button>
              <button
                class="btn btn-warning btn-sm"
                disabled={driveStatus.isSyncing}
                title="Apaga o arquivo no Drive e envia os dados desta sessao do zero. Use se os dados nao estao sincronizando."
                onclick={async () => {
                  if (!finance) return;
                  if (confirm('Isso vai substituir TODOS os dados no Google Drive pelos dados desta sessao. Continuar?')) {
                    await driveSync.resetAndUpload(finance.exportBackupData());
                  }
                }}
              >
                Forcar envio sessao -> Drive
              </button>
              <button class="btn btn-danger btn-sm" onclick={() => driveSync.disconnect()}>
                Desconectar
              </button>
            </div>
          </div>
        {:else}
          <button class="btn btn-primary" onclick={() => driveSync.connect()}>
            Conectar com Google Drive
          </button>
          <p class="hint" style="margin-top: 6px;">
            A conexao com Drive e obrigatoria para carregar o app.
          </p>
        {/if}
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
  .drive-status-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--surface-hover);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
  }
  .drive-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
    flex-shrink: 0;
  }
  .status-text {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text);
    flex: 1;
  }
  .sync-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
  }
  .sync-pill.ok {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }
  .sync-pill.syncing {
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
  }
  .sync-pill.error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .last-sync {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
  }
  .sync-error {
    font-size: 0.78rem;
    color: #f87171;
    margin: 0;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.08);
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  .drive-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
  }
  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  .btn-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
  }
  .btn-warning:hover {
    background: rgba(245, 158, 11, 0.2);
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

  @media (max-width: 760px) {
    .settings-body {
      gap: 18px;
    }
    section {
      gap: 9px;
    }
    .row {
      align-items: stretch;
      flex-direction: column;
      gap: 8px;
    }
    .num-input {
      width: 100%;
    }
    .toggle {
      align-items: flex-start;
      line-height: 1.35;
    }
    .drive-status-block {
      padding: 12px;
      border-radius: 12px;
    }
    .drive-status-row {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .status-text {
      min-width: 0;
      line-height: 1.3;
    }
    .sync-pill {
      width: fit-content;
    }
    .drive-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .drive-actions .btn {
      width: 100%;
      white-space: normal;
    }
    .add-rule {
      grid-template-columns: 1fr;
    }
    .rule {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      padding: 10px;
    }
    .rule .arrow {
      display: none;
    }
    .kw,
    .cat {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cat {
      grid-column: 1 / -1;
    }
    .rule .btn-icon {
      grid-column: 2;
      grid-row: 1;
    }
  }
</style>
