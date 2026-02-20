/**
 * Admin API
 */

import { apiClient } from './client';

export const adminApi = {
  // ML Training
  async getMLStatus(): Promise<any> {
    return apiClient.get('/ml/status');
  },

  async trainML(): Promise<any> {
    return apiClient.post('/ml/train');
  },

  async scoreAll(limit: number): Promise<any> {
    return apiClient.post(`/ml/score-all?limit=${limit}`);
  },

  // Settings/Configuration
  async saveMapboxToken(token: string): Promise<any> {
    return apiClient.post('/settings/mapbox', { token });
  },

  async saveMapboxUnlimited(token: string): Promise<any> {
    return apiClient.post('/settings/mapbox-unlimited', { token });
  },

  async saveWigleToken(token: string): Promise<any> {
    return apiClient.post('/settings/wigle', { token });
  },

  async saveGoogleMapsKey(key: string): Promise<any> {
    return apiClient.post('/settings/google-maps', { key });
  },

  async saveAwsCredentials(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<any> {
    return apiClient.post('/settings/aws', { accessKeyId, secretAccessKey, region });
  },

  async saveOpenCageKey(key: string): Promise<any> {
    return apiClient.post('/settings/opencage', { key });
  },

  async saveLocationIQKey(key: string): Promise<any> {
    return apiClient.post('/settings/locationiq', { key });
  },

  async saveSmartyKey(authId: string, authToken: string): Promise<any> {
    return apiClient.post('/settings/smarty', { authId, authToken });
  },

  async saveHomeLocation(latitude: number, longitude: number, radius: number): Promise<any> {
    return apiClient.post('/admin/home-location', { latitude, longitude, radius });
  },

  async getMapboxToken(): Promise<any> {
    return apiClient.get('/settings/mapbox');
  },

  async getMapboxUnlimited(): Promise<any> {
    return apiClient.get('/settings/mapbox-unlimited');
  },

  async getGoogleMapsKey(): Promise<any> {
    return apiClient.get('/settings/google-maps');
  },

  async getWigleToken(): Promise<any> {
    return apiClient.get('/settings/wigle');
  },

  async getAwsCredentials(): Promise<any> {
    return apiClient.get('/settings/aws');
  },

  async getOpenCageKey(): Promise<any> {
    return apiClient.get('/settings/opencage');
  },

  async getLocationIQKey(): Promise<any> {
    return apiClient.get('/settings/locationiq');
  },

  async getSmartyKey(): Promise<any> {
    return apiClient.get('/settings/smarty');
  },

  // Data Import — FormData: raw fetch (apiClient forces application/json header)
  async importSQLite(formData: FormData): Promise<any> {
    const response = await fetch('/api/admin/import-sqlite', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    return response.json();
  },

  // PgAdmin
  async getPgAdminStatus(): Promise<any> {
    return apiClient.get('/admin/pgadmin/status');
  },

  async startPgAdmin(): Promise<any> {
    return apiClient.post('/admin/pgadmin/start');
  },

  async stopPgAdmin(): Promise<any> {
    return apiClient.post('/admin/pgadmin/stop');
  },

  // Backups
  async createBackup(uploadToS3: boolean = false): Promise<any> {
    return apiClient.post('/admin/backup', { uploadToS3 });
  },

  async listS3Backups(): Promise<any> {
    return apiClient.get('/admin/backup/s3');
  },

  // Blob download — raw fetch (apiClient always calls .json())
  async downloadS3Backup(key: string): Promise<Blob> {
    const res = await fetch(`/api/admin/backup/s3/${encodeURIComponent(key)}`, {
      credentials: 'include',
    });
    return res.blob();
  },

  async deleteS3Backup(key: string): Promise<any> {
    return apiClient.delete(`/admin/backup/s3/${encodeURIComponent(key)}`);
  },

  // Geocoding Cache
  async getGeocodingStats(precision: string): Promise<any> {
    return apiClient.get(`/admin/geocoding/stats?precision=${precision}`);
  },

  async runGeocoding(precision: string, limit: number): Promise<any> {
    return apiClient.post('/admin/geocoding/run', { precision, limit });
  },

  // AWS
  async getAwsOverview(): Promise<any> {
    return apiClient.get('/admin/aws/overview');
  },

  async controlAwsInstance(instanceId: string, action: 'start' | 'stop'): Promise<any> {
    return apiClient.post(`/admin/aws/instances/${instanceId}/${action}`);
  },

  // Network Notes
  async addNetworkNote(
    bssid: string,
    content: string,
    noteType: string,
    userId: string
  ): Promise<any> {
    return apiClient.post('/admin/network-notes/add', {
      bssid,
      content,
      note_type: noteType,
      user_id: userId,
    });
  },

  // Media upload — FormData: raw fetch (apiClient forces application/json header)
  async addNetworkNoteMedia(noteId: number, formData: FormData): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${noteId}/media`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    return response.json();
  },

  async getNetworkNotes(bssid: string): Promise<any> {
    return apiClient.get(`/admin/network-notes/${encodeURIComponent(bssid)}`);
  },

  async deleteNetworkNote(noteId: number): Promise<any> {
    return apiClient.delete(`/admin/network-notes/${noteId}`);
  },

  // API Testing — raw fetch: hits /health (not /api) and arbitrary URLs
  async testHealth(): Promise<any> {
    const res = await fetch('/health', { credentials: 'include' });
    return res.json();
  },

  async testEndpoint(url: string, options: RequestInit): Promise<any> {
    const res = await fetch(url, { ...options, credentials: 'include' });
    return res.json();
  },
};
