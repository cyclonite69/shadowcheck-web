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
    return response.json();
  },

  async ignoreNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/ignore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  async tagNetworkAsThreat(bssid: string, confidence: number = 1.0): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/threat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidence }),
    });
    return response.json();
  },

  async deleteNetworkTag(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async investigateNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  async suspectNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/suspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  async falsePositiveNetwork(bssid: string): Promise<any> {
    const response = await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/false-positive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
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
