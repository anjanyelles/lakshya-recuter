import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient } from './apiClient.js';

const AuthContext = createContext(null);

function storageForRemember(remember) {
  return remember ? localStorage : sessionStorage;
}

function getStoredToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);

  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  const api = useMemo(
    () =>
      createApiClient({
        getAccessToken,
        onUnauthorized: async () => {
          return refresh();
        }
      }),
    [getAccessToken]
  );

  const clearTimers = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    inactivityTimer.current = null;
    warningTimer.current = null;
  };

  const scheduleInactivity = useCallback(() => {
    clearTimers();
    const warnMs = 28 * 60 * 1000;
    const logoutMs = 30 * 60 * 1000;

    warningTimer.current = setTimeout(() => {
      // eslint-disable-next-line no-alert
      alert('You will be logged out in 2 minutes due to inactivity.');
    }, warnMs);

    inactivityTimer.current = setTimeout(() => {
      logout();
    }, logoutMs);
  }, []);

  useEffect(() => {
    const handler = () => scheduleInactivity();
    window.addEventListener('mousemove', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    scheduleInactivity();
    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
      clearTimers();
    };
  }, [scheduleInactivity]);

  const saveToken = (token, remember) => {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    const store = storageForRemember(remember);
    store.setItem('accessToken', token);
    setAccessToken(token);
  };

  const clearToken = () => {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    setAccessToken(null);
  };

  const loadMe = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data.user);
    } catch {
      // ignore
    }
  }, [api, accessToken]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login({ email, password, rememberMe, captchaToken }) {
    setLoading(true);
    setError(null);
    setCaptchaRequired(false);
    try {
      const res = await api.post('/api/auth/login', { email, password, rememberMe, captchaToken });
      saveToken(res.data.token, rememberMe);
      setUser(res.data.user);
      return true;
    } catch (e) {
      const message = e?.response?.data?.message || e.message;
      setError(message);
      if (e?.response?.data?.captchaRequired) {
        setCaptchaRequired(true);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    clearTimers();
    try {
      if (accessToken) {
        await api.post('/api/auth/logout');
      }
    } catch {
      // ignore
    } finally {
      clearToken();
      setUser(null);
    }
  }

  async function refresh() {
    try {
      const res = await api.post('/api/auth/refresh');
      if (res?.data?.token) {
        saveToken(res.data.token, true);
        await loadMe();
        return true;
      }
    } catch {
      await logout();
    }
    return false;
  }

  async function forgotPassword({ email }) {
    await api.post('/api/auth/forgot-password', { email });
  }

  async function resetPassword({ token, newPassword }) {
    await api.post('/api/auth/reset-password', { token, newPassword });
  }

  async function changePassword({ currentPassword, newPassword }) {
    await api.post('/api/auth/change-password', { currentPassword, newPassword });
  }

  const value = {
    user,
    loading,
    error,
    captchaRequired,
    login,
    logout,
    forgotPassword,
    resetPassword,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
