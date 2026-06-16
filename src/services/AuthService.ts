// AuthService.ts — mirrors auth.service.ts + auth-http.service.ts from cat2020-cms-frontend
import { ApiService } from './ApiService';
import { SessionStorage } from '../storage/SessionStorage';
import { AuthEndpoints } from '../constants/AppConstants';

export interface UserModel {
  id: number | string;
  username: string;
  email: string;
  fullName?: string;
  roles?: string[];
  [key: string]: any;
}

export interface LoginResponse {
  token: string;
  expiration: string;
}

export const AuthService = {
  /**
   * Login — mirrors AuthHTTPService.login() + AuthService.login()
   * POST /auth/login/newlogin_v2
   */
  async login(username: string, password: string): Promise<{ user: UserModel; token: string }> {
    const response = await ApiService.post<LoginResponse>(AuthEndpoints.LOGIN, {
      username,
      password,
    });

    const { token, expiration } = response.data;

    // Persist token — mirrors setAuthToSessionStorage()
    await SessionStorage.setToken(token);
    if (expiration) {
      await SessionStorage.setTokenExpiry(new Date(expiration).toISOString());
    }

    // Fetch user profile — mirrors getUserByToken()
    const user = await AuthService.getMe(token);
    await SessionStorage.setUserData(user);

    return { user, token };
  },

  /**
   * Get current user from token — mirrors getUserByToken()
   * GET /auth/login/me
   */
  async getMe(token?: string): Promise<UserModel> {
    const headers: Record<string, string> = {};
    const storedToken = token ?? (await SessionStorage.getToken());
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    const response = await ApiService.get<UserModel>(AuthEndpoints.ME);
    return response.data;
  },

  /**
   * Logout — mirrors AuthService.logout()
   */
  async logout(): Promise<void> {
    await SessionStorage.clearAll();
  },

  /**
   * Forgot password — mirrors AuthHTTPService.forgotPassword()
   * POST /auth/forgot-password
   */
  async forgotPassword(email: string): Promise<boolean> {
    const response = await ApiService.post<boolean>('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Check if user is logged in (has a valid token)
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await SessionStorage.getToken();
    return !!token;
  },
};
