/**
 * Admin API
 */

import { apiClient } from './client';
import type { AdminUser } from '../components/admin/types/admin.types';

export const adminApi = {
  // User management
  async listUsers(): Promise<{ success: boolean; users: AdminUser[] }> {
    return apiClient.get('/admin/users');
  },

  async createUser(input: {
    username: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    forcePasswordChange?: boolean;
  }): Promise<{ success: boolean; user: AdminUser }> {
    return apiClient.post('/admin/users', input);
  },

  async setUserActive(
    id: number,
    isActive: boolean
  ): Promise<{ success: boolean; user: AdminUser }> {
    return apiClient.put(`/admin/users/${id}/active`, { isActive });
  },

  async resetUserPassword(
    id: number,
    password: string,
    forcePasswordChange = true
  ): Promise<{ success: boolean; user: AdminUser }> {
    return apiClient.put(`/admin/users/${id}/password`, { password, forcePasswordChange });
  },

  // Geocoding job request payload
  async runGeocoding(options: {
    provider: 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'locationiq';
    mode: 'address-only' | 'poi-only' | 'both';
    limit: number;
    precision: number;
    perMinute: number;
    permanent?: boolean;
  }): Promise<any> {
    return apiClient.post('/admin/geocoding/run', options);
  },

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
    return apiClient.post('/settings/mapbox-unlimited', { apiKey: token });
  },

  async saveWigleToken(token: string): Promise<any> {
    return apiClient.post('/settings/wigle', { token });
  },

  async saveGoogleMapsKey(key: string): Promise<any> {
    return apiClient.post('/settings/google-maps', { apiKey: key });
  },

  async saveAwsRegion(region: string): Promise<any> {
    return apiClient.post('/settings/aws', { region });
  },

  async saveOpenCageKey(key: string): Promise<any> {
    return apiClient.post('/settings/opencage', { apiKey: key });
  },

  async saveLocationIQKey(key: string): Promise<any> {
    return apiClient.post('/settings/locationiq', { apiKey: key });
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

  async getAwsSettings(): Promise<any> {
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

  async getImportHistory(limit = 20): Promise<any> {
    return apiClient.get(`/admin/import-history?limit=${limit}`);
  },

  async getDeviceSources(): Promise<any> {
    return apiClient.get('/admin/device-sources');
  },

  // Data Import — FormData: raw fetch (apiClient forces application/json header)
  async importSQLite(formData: FormData): Promise<{
    ok: boolean;
    imported?: number;
    failed?: number;
    message?: string;
    error?: string;
  }> {
    const response = await fetch('/api/admin/import-sqlite', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : data.error?.message || 'Import failed',
      };
    }
    return data;
  },

  async importSQL(formData: FormData): Promise<{
    ok: boolean;
    message?: string;
    backupTaken?: boolean;
    durationSec?: string;
    error?: string;
    output?: string;
    errorOutput?: string;
  }> {
    const response = await fetch('/api/admin/import-sql', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof data.error === 'string' ? data.error : data.error?.message || 'SQL import failed',
        output: data.output,
        errorOutput: data.errorOutput,
      };
    }
    return data;
  },

  // PgAdmin
  async getPgAdminStatus(): Promise<any> {
    return apiClient.get('/admin/pgadmin/status');
  },

  async startPgAdmin(reset: boolean = false): Promise<any> {
    return apiClient.post('/admin/pgadmin/start', { reset });
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
