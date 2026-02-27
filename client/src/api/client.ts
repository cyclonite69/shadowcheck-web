/**
 * Base API client with centralized fetch wrapper
 */

const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, signal, ...fetchOptions } = options;

    let url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url = `${url}?${searchParams}`;
    }

    // Create abort controller with 120s timeout (double the backend timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    // Use provided signal or our timeout signal
    const finalSignal = signal || controller.signal;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: finalSignal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const message =
          (data && (data.error || data.message)) ||
          text ||
          `Request failed: ${response.status} ${response.statusText}`;
        const error = new Error(message) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return (data ?? (text as any)) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(BASE_URL);
