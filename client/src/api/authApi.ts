/**
 * Authentication API
 */
import { apiClient } from './client';

interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUserResponse {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

export interface LoginResponse {
  user: AuthUserResponse;
  forcePasswordChange?: boolean;
  authenticated?: boolean;
}

interface ChangePasswordRequest {
  username: string;
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResponse {
  ok: boolean;
  message: string;
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  },

  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    return apiClient.post<ChangePasswordResponse>('/auth/change-password', data);
  },

  async getMe(): Promise<LoginResponse> {
    return apiClient.get<LoginResponse>('/auth/me');
  },
};
