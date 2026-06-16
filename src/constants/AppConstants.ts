// AppConstants.ts — mirrors environment.ts from cat2020-cms-frontend

// Available Environments:
// export const API_BASE_URL = 'http://localhost:5000/api';       // Local Dev
export const API_BASE_URL = 'https://testcms.cat2020.lk/api';     // Staging / Test
// export const API_BASE_URL = 'https://cms.cat2020.lk/api';         // Production

export const AppConstants = {
  // CAT2020 App Header — required by backend middleware on all /api/* calls
  APP_HEADER_KEY: 'x-cat2020-app',
  APP_HEADER_VALUE: 'web',

  // Session / storage keys
  TOKEN_KEY: 'token',
  TOKEN_EXP_KEY: 'token_exp',
  USERDATA_KEY: 'ecitizen_userdata',

  // App info
  APP_VERSION: 'v1.0.0',
};

// API endpoint paths (mirrors auth-http.service.ts)
export const AuthEndpoints = {
  LOGIN: '/auth/login/newlogin_v2',
  ME: '/auth/login/me',
  FORGOT_PASSWORD: '/auth/forgot-password',
};

// API endpoint paths for CMS Dashboard (mirrors cms-complaint-api.service.ts)
export const DashboardEndpoints = {
  SUMMARY: '/cms/dashboard',
  ALL_COMPLAINTS: '/cms/complaints', // ?pageNumber=1&pageSize=10
  ASSIGNED_COMPLAINTS: '/cms/complaints/assigned-to-me', // ?pageNumber=1&pageSize=10
};
