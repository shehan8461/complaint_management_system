// ApiService.ts — Generic HTTP client mirroring Angular's ApiService
// Automatically injects: Bearer token + x-cat2020-app: mobile header

import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL, AppConstants } from '../constants/AppConstants';
import { SessionStorage } from '../storage/SessionStorage';

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    [AppConstants.APP_HEADER_KEY]: AppConstants.APP_HEADER_VALUE,
  },
});

// Request interceptor — mirrors JwtInterceptor from the web app
axiosInstance.interceptors.request.use(
  async config => {
    const token = await SessionStorage.getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Inject tenant headers (mirrors JwtInterceptor)
    const u: any = await SessionStorage.getUserData();
    if (u) {
      try {
        const sabhaId = u?.sabhaId ?? u?.sabhaID ?? u?.SabhaID;
        const officeId = u?.officeId ?? u?.officeID ?? u?.OfficeID;
        const orgTypeId = u?.orgTypeId;
        const companyId = u?.orgId;

        if (sabhaId) config.headers['x-sabha-id'] = sabhaId.toString();
        if (officeId) config.headers['x-office-id'] = officeId.toString();
        if (orgTypeId) config.headers['x-org-type-id'] = orgTypeId.toString();
        if (companyId) config.headers['x-company-id'] = companyId.toString();
      } catch (e) {
        // Ignore parse error
      }
    }

    config.headers[AppConstants.APP_HEADER_KEY] = AppConstants.APP_HEADER_VALUE;
    return config;
  },
  error => Promise.reject(error),
);

// Response interceptor — global error handling (mirrors http-error.interceptor)
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (__DEV__) {
      console.error('[ApiService] Error:', error?.response?.status, error?.message);
    }
    return Promise.reject(error);
  },
);

export const ApiService = {
  get<T>(path: string, params?: Record<string, any>) {
    return axiosInstance.get<T>(path, { params });
  },
  post<T>(path: string, body: any, config?: any) {
    return axiosInstance.post<T>(path, body, config);
  },
  put<T>(path: string, body: any, config?: any) {
    return axiosInstance.put<T>(path, body, config);
  },
  delete<T>(path: string) {
    return axiosInstance.delete<T>(path);
  },
};
