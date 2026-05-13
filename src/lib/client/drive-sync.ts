const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'finance-backup.json';

export interface DriveSyncStatus {
  connected: boolean;
  userEmail?: string;
  lastSync?: Date;
  isSyncing: boolean;
  error?: string;
}

export type SyncEvent =
  | { type: 'sync_start' }
  | { type: 'sync_success'; lastSync: Date }
  | { type: 'sync_error'; error: string }
  | { type: 'drive_data_loaded' }
  | { type: 'connected'; userEmail?: string }
  | { type: 'disconnected' };

class DriveSyncService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private syncStatus: DriveSyncStatus = { connected: false, isSyncing: false };
  private statusListeners = new Set<(status: DriveSyncStatus) => void>();
  private onSyncEvent?: (event: SyncEvent) => void;
  public onConnect?: () => Promise<void>;
  private debounceTimer: any = null;
  private firstSyncDone = false;
  private silentRefreshPending = false;
  private syncInProgress = false;
  private pendingUpload: any = null;

  getStatus() {
    return this.syncStatus;
  }

  isConfigured() {
    return !!CLIENT_ID;
  }

  setListener(cb: (status: DriveSyncStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.syncStatus);
    return () => this.statusListeners.delete(cb);
  }

  setSyncEventListener(cb: (event: SyncEvent) => void) {
    this.onSyncEvent = cb;
  }

  private emitEvent(event: SyncEvent) {
    this.onSyncEvent?.(event);
  }

  async init() {
    if (!CLIENT_ID) {
      console.warn('[DriveSync] VITE_GOOGLE_CLIENT_ID não configurado. Sincronização com Drive desabilitada.');
      this.updateStatus({ connected: false, error: 'Google Drive nao configurado.' });
      return;
    }

    return new Promise<void>((resolve) => {
      const checkScripts = () => {
        if (typeof google !== 'undefined' && typeof gapi !== 'undefined') {
          this.initializeGsi();
          this.initializeGapi(resolve);
        } else {
          setTimeout(checkScripts, 100);
        }
      };
      checkScripts();
    });
  }

  private initializeGsi() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response: any) => {
        if (response.error !== undefined) {
          console.error('[DriveSync] Erro no callback do token:', response.error);
          // Se o silent refresh falhou (login_required), o usuário não está mais conectado
          if (this.silentRefreshPending) {
            this.silentRefreshPending = false;
            console.log('[DriveSync] Silent refresh falhou — usuário precisa reconectar manualmente.');
            this._clearConnection();
          } else {
            this.updateStatus({ connected: false, error: 'Erro ao obter permissao do Google.' });
          }
          return;
        }

        if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPES)) {
          alert('Você precisa conceder permissão ao Google Drive para o backup funcionar. Por favor, conecte novamente e marque a caixa de permissão.');
          this._clearConnection();
          return;
        }

        const wasSilentRefresh = this.silentRefreshPending;
        this.silentRefreshPending = false;

        // Salvar token em memória com tempo de expiração (tokens duram 1h = 3600s)
        this.accessToken = response.access_token;
        this.tokenExpiresAt = Date.now() + (response.expires_in ?? 3600) * 1000 - 60_000; // 1min de margem

        if (!wasSilentRefresh) {
          // Conexão nova (com popup): carregar dados do Drive.
          this.updateStatus({ connected: true, error: undefined });
          this.emitEvent({ type: 'connected' });
          await this.onConnect?.();
        } else {
          // Silent refresh bem-sucedido — continuar operação pendente
          console.log('[DriveSync] Silent refresh concluído com sucesso.');
          this.updateStatus({ connected: true, error: undefined });
          if (this.pendingUpload !== null) {
            const data = this.pendingUpload;
            this.pendingUpload = null;
            await this._doUpload(data);
          }
        }
      },
    });
  }

  private initializeGapi(resolve: () => void) {
    gapi.load('client', async () => {
      try {
        await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        console.log('[DriveSync] GAPI Drive client carregado.');
      } catch (e) {
        console.error('[DriveSync] Erro ao carregar GAPI Drive', e);
      }

      resolve();
    });
  }

  private _doSilentRefresh() {
    if (!this.tokenClient) return;
    this.silentRefreshPending = true;
    // prompt: '' = sem popup se já autorizado; '' em vez de 'none' é mais compatível
    this.tokenClient.requestAccessToken({ prompt: '' });
  }

  async connect() {
    console.log('[DriveSync] Iniciando conexão com popup...');
    if (!CLIENT_ID) {
      this.updateStatus({ connected: false, error: 'Google Drive nao configurado.' });
      return;
    }
    if (!this.tokenClient) await this.init();
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  }

  disconnect() {
    console.log('[DriveSync] Desconectando...');
    if (this.accessToken) {
      try {
        google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (e) {
        console.error('[DriveSync] Erro ao revogar token', e);
      }
    }
    this._clearConnection();
    this.emitEvent({ type: 'disconnected' });
  }

  private _clearConnection() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.firstSyncDone = false;
    this.updateStatus({ connected: false, userEmail: undefined, error: undefined });
  }

  private updateStatus(patch: Partial<DriveSyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...patch };
    for (const listener of this.statusListeners) {
      listener(this.syncStatus);
    }
  }

  /** Verifica se o token atual ainda é válido */
  private isTokenValid(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  }

  /**
   * Garante um token válido. Se expirado, faz silent refresh e retorna false
   * (o caller deve aguardar o callback do tokenClient que reiniciará a operação).
   */
  private async ensureValidToken(): Promise<boolean> {
    if (this.isTokenValid()) return true;

    if (!this.accessToken) {
      console.log('[DriveSync] Sem token de conexão. Abortando.');
      return false;
    }

    console.log('[DriveSync] Token expirado ou ausente. Iniciando silent refresh...');
    this._doSilentRefresh();
    return false; // operação será retomada no callback
  }

  /** Upload com debounce. Para o primeiro sync, é imediato. */
  async uploadBackup(data: any) {
    if (!this.syncStatus.connected) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const delay = this.firstSyncDone ? 2000 : 0;
    this.debounceTimer = setTimeout(() => this._doUpload(data), delay);
  }

  /** Força upload imediato (sem debounce) — para uso após conectar/reconciliar */
  async uploadBackupNow(data: any) {
    if (!this.syncStatus.connected) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this._doUpload(data);
  }

  private async _doUpload(data: any) {
    if (this.syncInProgress) {
      // Guardar para após a sync atual terminar
      this.pendingUpload = data;
      return;
    }

    const hasToken = await this.ensureValidToken();
    if (!hasToken) {
      // Salvar para após o silent refresh completar
      this.pendingUpload = data;
      return;
    }

    this.syncInProgress = true;
    this.updateStatus({ isSyncing: true, error: undefined });
    this.emitEvent({ type: 'sync_start' });
    console.log('[DriveSync] Iniciando upload do backup...');

    try {
      const fileId = await this.findBackupFile();
      const content = JSON.stringify(data);

      if (fileId) {
        await this._patchFile(fileId, content);
      } else {
        await this._createFile(content);
      }

      const now = new Date();
      this.firstSyncDone = true;
      this.updateStatus({ lastSync: now, error: undefined });
      this.emitEvent({ type: 'sync_success', lastSync: now });
      console.log('[DriveSync] Upload concluído com sucesso!');
    } catch (e: any) {
      const isUnauth = e?.status === 401 || e?.message?.includes('401');
      if (isUnauth) {
        console.warn('[DriveSync] 401 no upload. Tentando silent refresh...');
        this.accessToken = null;
        this.pendingUpload = data;
        this._doSilentRefresh();
      } else {
        const errMsg = e instanceof Error ? e.message : 'Falha ao sincronizar com o Drive.';
        console.error('[DriveSync] Falha no upload:', e);
        this.updateStatus({ error: errMsg });
        this.emitEvent({ type: 'sync_error', error: errMsg });
      }
    } finally {
      this.syncInProgress = false;
      this.updateStatus({ isSyncing: false });

      // Se havia um upload pendente que chegou durante esta sync, processá-lo
      if (this.pendingUpload !== null && !this.silentRefreshPending) {
        const next = this.pendingUpload;
        this.pendingUpload = null;
        // Pequeno delay para não criar loop infinito
        setTimeout(() => this._doUpload(next), 500);
      }
    }
  }

  private async _patchFile(fileId: string, content: string) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );
    if (!res.ok) {
      const err: any = new Error(`Erro PATCH: ${res.status}`);
      err.status = res.status;
      throw err;
    }
  }

  private async _createFile(content: string) {
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      close_delim;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );
    if (!res.ok) {
      const err: any = new Error(`Erro POST: ${res.status}`);
      err.status = res.status;
      throw err;
    }
  }

  async downloadBackup(): Promise<any | null> {
    console.log('[DriveSync] Solicitando download do backup...');

    const hasToken = await this.ensureValidToken();
    if (!hasToken) {
      console.log('[DriveSync] Download cancelado: token inválido ou refresh iniciado.');
      throw new Error('Conexao com Google Drive expirada. Conecte novamente.');
    }

    try {
      const fileId = await this.findBackupFile();
      if (!fileId) {
        console.log('[DriveSync] Nenhum arquivo de backup encontrado no Drive.');
        return null;
      }

      console.log('[DriveSync] Baixando arquivo:', fileId);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[DriveSync] 401 no download. Token expirado.');
          this.accessToken = null;
          this._doSilentRefresh();
        }
        const err: any = new Error(`Erro ao baixar backup do Drive: ${response.status}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      console.log('[DriveSync] Backup baixado com sucesso. exportedAt:', data.meta?.exportedAt);
      return data;
    } catch (e) {
      console.error('[DriveSync] Falha no download:', e);
      throw e instanceof Error ? e : new Error('Falha ao baixar backup do Drive.');
    }
  }

  private async findBackupFile(): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name,modifiedTime)`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) {
        const err: any = new Error(`Erro ao buscar backup no Drive: ${response.status}`);
        err.status = response.status;
        if (response.status === 401) {
          this.accessToken = null;
        }
        throw err;
      }

      const data = await response.json();
      const id = data.files && data.files.length > 0 ? data.files[0].id : null;
      console.log('[DriveSync] Busca de arquivo concluída. ID encontrado:', id);
      return id;
    } catch (e) {
      console.error('[DriveSync] Erro ao buscar arquivo:', e);
      throw e instanceof Error ? e : new Error('Falha ao buscar backup no Drive.');
    }
  }

  /** Retorna true se o usuário tinha conexão salva (mesmo que o token ainda não foi refreshado) */
  wasConnected(): boolean {
    return this.syncStatus.connected;
  }

  /** Deleta o arquivo de backup do Drive (para forçar re-upload limpo) */
  async deleteBackupFile(): Promise<boolean> {
    const hasToken = await this.ensureValidToken();
    if (!hasToken) return false;
    try {
      const fileId = await this.findBackupFile();
      if (!fileId) return true; // já não existe
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      if (res.ok || res.status === 204) {
        console.log('[DriveSync] Arquivo de backup deletado do Drive.');
        return true;
      }
      console.error('[DriveSync] Falha ao deletar arquivo:', res.status);
      return false;
    } catch (e) {
      console.error('[DriveSync] Erro ao deletar arquivo:', e);
      return false;
    }
  }

  /** Força upload imediato dos dados da sessão, deletando o arquivo antigo antes */
  async resetAndUpload(data: any): Promise<void> {
    this.updateStatus({ isSyncing: true, error: undefined });
    this.emitEvent({ type: 'sync_start' });
    try {
      await this.deleteBackupFile();
      await this._createFile(JSON.stringify(data));
      const now = new Date();
      this.firstSyncDone = true;
      this.updateStatus({ lastSync: now, error: undefined });
      this.emitEvent({ type: 'sync_success', lastSync: now });
      console.log('[DriveSync] Reset e upload concluídos com sucesso!');
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Erro no reset do Drive.';
      this.updateStatus({ error: msg });
      this.emitEvent({ type: 'sync_error', error: msg });
    } finally {
      this.updateStatus({ isSyncing: false });
    }
  }
}

export const driveSync = new DriveSyncService();

declare global {
  const google: any;
  const gapi: any;
}
