import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const API_BASE_URL = rawBaseUrl.endsWith('/api/v1')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/$/, '')}/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const { accessToken, activeContext } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (activeContext?.compId) {
    config.headers['x-comp-id'] = String(activeContext.compId);
  }
  if (activeContext?.branchId) {
    config.headers['x-branch-id'] = String(activeContext.branchId);
  }
  if (activeContext?.fyearId) {
    config.headers['x-fyear-id'] = String(activeContext.fyearId);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/login') &&
      !originalRequest?.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newAccessToken = res.data?.data?.accessToken;
        if (newAccessToken) {
          const state = useAuthStore.getState();
          state.updateContext(state.activeContext, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(error);
  },
);
