import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
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
          `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
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
