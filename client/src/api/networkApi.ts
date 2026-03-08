/**
 * Network API
 */

import { apiClient } from './client';
import { NetworkTag } from '../types/network';

interface AddNoteRequest {
  bssid: string;
  content: string;
  note_type: string;
  user_id: string;
}

interface AddNoteResponse {
  note_id: number;
}

export interface NetworkNote {
  id: number;
  content: string;
  note_type: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const networkApi = {
  async getNetworkTags(bssid: string): Promise<NetworkTag> {
    return apiClient.get<NetworkTag>(`/network-tags/${encodeURIComponent(bssid)}`);
  },

  async ignoreNetwork(bssid: string): Promise<any> {
    return apiClient.patch(`/network-tags/${encodeURIComponent(bssid)}/ignore`);
  },

  async tagNetworkAsThreat(
    bssid: string,
    threatTag: string,
    confidence: number = 1.0
  ): Promise<any> {
    return apiClient.patch(`/network-tags/${encodeURIComponent(bssid)}/threat`, {
      threat_tag: threatTag,
      threat_confidence: confidence,
    });
  },

  async deleteNetworkTag(bssid: string): Promise<any> {
    return apiClient.delete(`/network-tags/${encodeURIComponent(bssid)}`);
  },

  async investigateNetwork(bssid: string): Promise<any> {
    return apiClient.patch(`/network-tags/${encodeURIComponent(bssid)}/investigate`);
  },

  async suspectNetwork(bssid: string): Promise<any> {
    return this.tagNetworkAsThreat(bssid, 'SUSPECT', 0.7);
  },

  async falsePositiveNetwork(bssid: string): Promise<any> {
    return this.tagNetworkAsThreat(bssid, 'FALSE_POSITIVE', 1.0);
  },

  async getWigleObservationsBatch(bssids: string[]): Promise<any> {
    return apiClient.post('/networks/wigle-observations/batch', { bssids });
  },

  async addNetworkNote(data: AddNoteRequest): Promise<AddNoteResponse> {
    return apiClient.post<AddNoteResponse>('/admin/network-notes/add', data);
  },

  async getNetworkNotes(bssid: string): Promise<NetworkNote[]> {
    const normalizedBssid = String(bssid || '')
      .trim()
      .toUpperCase();
    const encodedBssid = encodeURIComponent(normalizedBssid);

    const parseNotes = (response: any): NetworkNote[] => {
      if (Array.isArray(response)) return response as NetworkNote[];
      if (Array.isArray(response?.notes)) return response.notes as NetworkNote[];
      return [];
    };

    try {
      const response = await apiClient.get<any>(`/networks/${encodedBssid}/notes`);
      return parseNotes(response);
    } catch {
      // Fallback for environments where /networks/:bssid/notes is not reachable.
      const fallback = await apiClient.get<any>(`/admin/network-notes/${encodedBssid}`);
      return parseNotes(fallback);
    }
  },

  async updateNetworkNote(bssid: string, noteId: number, content: string): Promise<any> {
    const encodedBssid = encodeURIComponent(bssid);
    return apiClient.patch(`/networks/${encodedBssid}/notes/${noteId}`, { content });
  },

  // FormData — raw fetch (apiClient forces application/json header)
  async addNoteMedia(noteId: number, formData: FormData): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${noteId}/media`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to upload media');
    return response.json();
  },

  async getNetworkObservations(bssid: string): Promise<any> {
    return apiClient.get(`/networks/observations/${encodeURIComponent(bssid)}`);
  },

  async downloadThreatReportPdf(bssid: string): Promise<void> {
    const encoded = encodeURIComponent(bssid);
    const response = await fetch(`/api/reports/threat/${encoded}?format=pdf`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate threat report PDF';
      try {
        const text = await response.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        const apiError = data?.error;
        if (typeof apiError === 'string' && apiError.trim().length > 0) {
          errorMessage = apiError;
        } else if (
          apiError &&
          typeof apiError === 'object' &&
          typeof apiError.message === 'string'
        ) {
          errorMessage = apiError.message;
        } else if (typeof data?.message === 'string' && data.message.trim().length > 0) {
          errorMessage = data.message;
        } else if (typeof text === 'string' && text.trim().length > 0) {
          errorMessage = text.trim();
        } else if (apiError && typeof apiError === 'object') {
          errorMessage = JSON.stringify(apiError);
        }
      } catch {
        // Ignore JSON parse errors and use fallback message.
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat_report_${bssid.replace(/:/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
