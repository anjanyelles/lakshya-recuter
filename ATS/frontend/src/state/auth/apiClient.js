import axios from 'axios';

export function createApiClient({ getAccessToken, onUnauthorized }) {
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
    withCredentials: true
  });

  api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error?.config;

      if (!original) throw error;
      if (original.url?.includes('/api/auth/refresh')) throw error;

      if (error?.response?.status === 401 && !original._retry) {
        original._retry = true;
        const refreshed = await onUnauthorized();
        if (refreshed) {
          const token = getAccessToken();
          if (token) original.headers.Authorization = `Bearer ${token}`;
          return api.request(original);
        }
      }

      throw error;
    }
  );

  return api;
}
