// SessionStorage.ts — AsyncStorage wrapper replacing web sessionStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConstants } from '../constants/AppConstants';

export const SessionStorage = {
  /** Save JWT token */
  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(AppConstants.TOKEN_KEY, token);
  },

  /** Retrieve JWT token */
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(AppConstants.TOKEN_KEY);
  },

  /** Remove JWT token (logout) */
  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(AppConstants.TOKEN_KEY);
  },

  /** Save token expiry */
  async setTokenExpiry(expiry: string): Promise<void> {
    await AsyncStorage.setItem(AppConstants.TOKEN_EXP_KEY, expiry);
  },

  /** Retrieve token expiry */
  async getTokenExpiry(): Promise<string | null> {
    return AsyncStorage.getItem(AppConstants.TOKEN_EXP_KEY);
  },

  /** Save user data object */
  async setUserData(user: object): Promise<void> {
    await AsyncStorage.setItem(AppConstants.USERDATA_KEY, JSON.stringify(user));
  },

  /** Retrieve user data object */
  async getUserData<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(AppConstants.USERDATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  },

  /** Clear all auth data (full logout) */
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      AppConstants.TOKEN_KEY,
      AppConstants.TOKEN_EXP_KEY,
      AppConstants.USERDATA_KEY,
    ]);
  },
};
