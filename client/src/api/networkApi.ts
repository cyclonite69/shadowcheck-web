/**
 * Network API
 */

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

export const networkApi = {
  async getNetworkTags(bssid: string): Promise<NetworkTag> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to fetch tags: ${response.status}`);
    }
    return response.json();
  },

  async ignoreNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/ignore`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to ignore network: ${response.status}`);
    }
    return response.json();
  },

  async tagNetworkAsThreat(
    bssid: string,
    threatTag: string,
    confidence: number = 1.0
  ): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/threat`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threat_tag: threatTag,
        threat_confidence: confidence,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to tag network: ${response.status}`);
    }
    return response.json();
  },

  async deleteNetworkTag(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to delete tags: ${response.status}`);
    }
    return response.json();
  },

  async investigateNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/investigate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to set investigate tag: ${response.status}`);
    }
    return response.json();
  },

  async suspectNetwork(bssid: string): Promise<any> {
    return this.tagNetworkAsThreat(bssid, 'SUSPECT', 0.7);
  },

  async falsePositiveNetwork(bssid: string): Promise<any> {
    return this.tagNetworkAsThreat(bssid, 'FALSE_POSITIVE', 1.0);
  },

  async getWigleObservationsBatch(bssids: string[]): Promise<any> {
    const response = await fetch('/api/networks/wigle-observations/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bssids }),
    });
    return response.json();
  },

  async addNetworkNote(data: AddNoteRequest): Promise<AddNoteResponse> {
    const response = await fetch('/api/admin/network-notes/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create note');
    return response.json();
  },

  async addNoteMedia(noteId: number, formData: FormData): Promise<any> {
    const response = await fetch(`/api/admin/network-notes/${noteId}/media`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload media');
    return response.json();
  },

  async getNetworkObservations(bssid: string): Promise<any> {
    const response = await fetch(`/api/networks/observations/${encodeURIComponent(bssid)}`);
    return response.json();
  },
};
