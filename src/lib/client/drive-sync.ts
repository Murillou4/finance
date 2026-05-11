const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'finance-backup.json';

export interface DriveSyncStatus {
  connected: boolean;
  userEmail?: string;
  lastSync?: Date;
  isSyncing: boolean;
}

class DriveSyncService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private syncStatus: DriveSyncStatus = { connected: false, isSyncing: false };
  private onStatusChange?: (status: DriveSyncStatus) => void;
  public onConnect?: () => void;
  private debounceTimer: any = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem('finance:drive_token');
      if (this.accessToken) {
        this.syncStatus.connected = true;
      }
    }
  }

  getStatus() {
    return this.syncStatus;
  }

  setListener(cb: (status: DriveSyncStatus) => void) {
    this.onStatusChange = cb;
    cb(this.syncStatus);
  }

  async init() {
    if (!CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID não configurado. Sincronização com Drive desabilitada.');
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
      callback: (response: any) => {
        if (response.error !== undefined) {
          throw response;
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPES)) {
          alert('Você precisa conceder permissão ao Google Drive para o backup funcionar. Por favor, conecte novamente e marque a caixa de permissão.');
          this.disconnect();
          return;
        }
        this.accessToken = response.access_token;
        localStorage.setItem('finance:drive_token', this.accessToken!);
        this.updateStatus({ connected: true });
        this.onConnect?.();
      },
    });
  }

  private initializeGapi(resolve: () => void) {
    gapi.load('client', async () => {
      try {
        // Não usamos mais gapi.client.init para autenticação
        // Apenas carregamos a descoberta da API do Drive
        await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        console.log('[DriveSync] GAPI Drive client carregado.');
      } catch (e) {
        console.error('[DriveSync] Erro ao carregar GAPI Drive', e);
      }
      resolve();
    });
  }

  async connect() {
    console.log('[DriveSync] Iniciando conexão...');
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
    this.accessToken = null;
    localStorage.removeItem('finance:drive_token');
    this.updateStatus({ connected: false, userEmail: undefined });
  }

  private updateStatus(patch: Partial<DriveSyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...patch };
    console.log('[DriveSync] Status atualizado:', this.syncStatus);
    this.onStatusChange?.(this.syncStatus);
  }

  async uploadBackup(data: any) {
    if (!this.accessToken || !this.syncStatus.connected) {
      console.log('[DriveSync] Upload cancelado: não conectado ou sem token');
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    
    this.debounceTimer = setTimeout(async () => {
      console.log('[DriveSync] Iniciando upload do backup...');
      this.updateStatus({ isSyncing: true });
      try {
        const fileId = await this.findBackupFile();
        const content = JSON.stringify(data);
        
        if (fileId) {
          console.log('[DriveSync] Atualizando arquivo existente:', fileId);
          const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: content,
          });
          if (!res.ok) throw new Error(`Erro PATCH: ${res.status}`);
        } else {
          console.log('[DriveSync] Criando novo arquivo no Drive...');
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

          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          });
          if (!res.ok) throw new Error(`Erro POST: ${res.status}`);
        }
        console.log('[DriveSync] Upload concluído com sucesso!');
        this.updateStatus({ lastSync: new Date() });
      } catch (e) {
        console.error('[DriveSync] Falha no upload', e);
        if (e instanceof Response && e.status === 401) {
          this.disconnect();
        }
      } finally {
        this.updateStatus({ isSyncing: false });
      }
    }, 3000);
  }

  async downloadBackup() {
    console.log('[DriveSync] Solicitando download do backup...');
    if (!this.accessToken || !this.syncStatus.connected) {
      console.log('[DriveSync] Download cancelado: não conectado');
      return null;
    }
    try {
      const fileId = await this.findBackupFile();
      if (!fileId) {
        console.log('[DriveSync] Nenhum arquivo de backup encontrado no Drive.');
        return null;
      }

      console.log('[DriveSync] Baixando arquivo:', fileId);
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      
      if (!response.ok) throw response;
      const data = await response.json();
      console.log('[DriveSync] Backup baixado com sucesso. Metadados:', data.meta);
      return data;
    } catch (e) {
      console.error('[DriveSync] Falha no download', e);
      return null;
    }
  }

  private async findBackupFile(): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      const data = await response.json();
      const id = data.files && data.files.length > 0 ? data.files[0].id : null;
      console.log('[DriveSync] Busca de arquivo concluída. ID encontrado:', id);
      return id;
    } catch (e) {
      console.error('[DriveSync] Erro ao buscar arquivo', e);
      return null;
    }
  }
}

export const driveSync = new DriveSyncService();

declare global {
  const google: any;
  const gapi: any;
}
