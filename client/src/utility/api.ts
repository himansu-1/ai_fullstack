// api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // change to your real backend base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

function isExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    const json = JSON.parse(atob(payloadB64));
    const exp = Number(json.exp || 0);
    const now = Math.floor(Date.now() / 1000);
    return exp !== 0 && exp <= now;
  } catch {
    return false;
  }
}

api.interceptors.request.use((config) => {
  try {
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      const token = user?.access_token || user?.token || user?.accessToken;
      if (token) {
        if (isExpired(token)) {
          localStorage.removeItem('user');
          localStorage.removeItem('stacks');
          Object.keys(localStorage).forEach((k) => { if (k.startsWith('stack:')) localStorage.removeItem(k); });
          window.location.href = '/';
          return config;
        }
        config.headers = config.headers || {};
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});

export const buildWsUrl = (sessionId: number) => {
  const userRaw = localStorage.getItem('user');
  const token = userRaw ? (JSON.parse(userRaw)?.access_token) : '';
  const base = 'ws://localhost:8000/api/ws/chat';
  const qs = new URLSearchParams({ token: token || '', session_id: String(sessionId) }).toString();
  return `${base}?${qs}`;
};

export const fetchSessions = async () => {
  const resp = await api.get('/session/list');
  return resp.data;
};

export const fetchSessionDetail = async (sessionId: number) => {
  const resp = await api.get(`/session/${sessionId}`);
  return resp.data;
};

export default api;
