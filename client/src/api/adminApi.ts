/**
 * Admin API
 */

export const adminApi = {
  // ML Training
  async getMLStatus(): Promise<any> {
    const res = await fetch('/api/ml/status');
    return res.json();
  },

  async trainML(): Promise<any> {
    const res = await fetch('/api/ml/train', { method: 'POST' });
    return res.json();
  },

  async scoreAll(limit: number): Promise<any> {
    const res = await fetch(`/api/ml/score-all?limit=${limit}`, { method: 'POST' });
    return res.json();
  },

  // Settings/Configuration
  async saveMapboxToken(token: string): Promise<any> {
    const response = await fetch('/api/settings/mapbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  async saveMapboxUnlimited(token: string): Promise<any> {
    const response = await fetch('/api/settings/mapbox-unlimited', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  async saveWigleToken(token: string): Promise<any> {
    const response = await fetch('/api/settings/wigle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  async saveGoogleMapsKey(key: string): Promise<any> {
    const response = await fetch('/api/settings/google-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return response.json();
  },

  async saveAwsCredentials(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<any> {
    const response = await fetch('/api/settings/aws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
    });
    return response.json();
  },

  async saveOpenCageKey(key: string): Promise<any> {
    const response = await fetch('/api/settings/opencage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return response.json();
  },

  async saveLocationIQKey(key: string): Promise<any> {
    const response = await fetch('/api/settings/locationiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return response.json();
  },

  async saveSmartyKey(authId: string, authToken: string): Promise<any> {
    const response = await fetch('/api/settings/smarty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authId, authToken }),
    });
    return response.json();
  },

  async saveHomeLocation(latitude: number, longitude: number, radius: number): Promise<any> {
    const response = await fetch('/api/admin/home-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, radius }),
    });
    return response.json();
  },

  async getMapboxToken(): Promise<any> {
    const response = await fetch('/api/settings/mapbox', { credentials: 'same-origin' });
    return response.json();
  },

  async getMapboxUnlimited(): Promise<any> {
    const response = await fetch('/api/settings/mapbox-unlimited', { credentials: 'same-origin' });
    return response.json();
  },

  async getGoogleMapsKey(): Promise<any> {
    const response = await fetch('/api/settings/google-maps', { credentials: 'same-origin' });
    return response.json();
  },

  async getWigleToken(): Promise<any> {
    const response = await fetch('/api/settings/wigle', { credentials: 'same-origin' });
    return response.json();
  },

  async getAwsCredentials(): Promise<any> {
    const response = await fetch('/api/settings/aws', { credentials: 'same-origin' });
    return response.json();
  },

  async getOpenCageKey(): Promise<any> {
    const response = await fetch('/api/settings/opencage', { credentials: 'same-origin' });
    return response.json();
  },

  async getLocationIQKey(): Promise<any> {
    const response = await fetch('/api/settings/locationiq', { credentials: 'same-origin' });
    return response.json();
  },

  async getSmartyKey(): Promise<any> {
    const response = await fetch('/api/settings/smarty', { credentials: 'same-origin' });
    return response.json();
  },

  // Data Import
  async importSQLite(formData: FormData): Promise<any> {
    const response = await fetch('/api/admin/import-sqlite', { method: 'POST', body: formData });
    return response.json();
  },

  // PgAdmin
  async getPgAdminStatus(): Promise<any> {
    const response = await fetch('/api/admin/pgadmin/status');
    return response.json();
  },

  async startPgAdmin(): Promise<any> {
    const response = await fetch('/api/admin/pgadmin/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  async stopPgAdmin(): Promise<any> {
    const response = await fetch('/api/admin/pgadmin/stop', { method: 'POST' });
    return response.json();
  },

  // Backups
  async createBackup(uploadToS3: boolean = false): Promise<any> {
    const res = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadToS3 }),
    });
    return res.json();
  },

  async listS3Backups(): Promise<any> {
    const res = await fetch('/api/admin/backup/s3');
    return res.json();
  },

  async downloadS3Backup(key: string): Promise<Blob> {
    const res = await fetch(`/api/admin/backup/s3/${encodeURIComponent(key)}`, {
      method: 'GET',
    });
    return res.blob();
  },

  async deleteS3Backup(key: string): Promise<any> {
    const res = await fetch(`/api/admin/backup/s3/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Geocoding Cache
  async getGeocodingStats(precision: string): Promise<any> {
    const response = await fetch(`/api/admin/geocoding/stats?precision=${precision}`);
    return response.json();
  },

  async runGeocoding(precision: string, limit: number): Promise<any> {
    const response = await fetch('/api/admin/geocoding/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precision, limit }),
    });
    return response.json();
  },

  // AWS
  async getAwsOverview(): Promise<any> {
    const response = await fetch('/api/admin/aws/overview', { credentials: 'same-origin' });
    return response.json();
  },

  async controlAwsInstance(instanceId: string, action: 'start' | 'stop'): Promise<any> {
    const response = await fetch(`/api/admin/aws/instances/${instanceId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  // Network Notes
  async addNetworkNote(
    bssid: string,
    content: string,
    noteType: string,
    userId: string
  ): Promise<any> {
    const response = await fetch('/api/admin/network-notes/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bssid, content, note_type: noteType, user_id: userId }),
    });
    return response.json();
  },

  async addNetworkNoteMedia(noteId: number, formData: FormData): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${noteId}/media`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async getNetworkNotes(bssid: string): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${encodeURIComponent(bssid)}`);
    return response.json();
  },

  async deleteNetworkNote(noteId: number): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${noteId}`, { method: 'DELETE' });
    return response.json();
  },

  // API Testing
  async testHealth(): Promise<any> {
    const res = await fetch('/health');
    return res.json();
  },

  async testEndpoint(url: string, options: RequestInit): Promise<any> {
    const res = await fetch(url, options);
    return res.json();
  },
};
