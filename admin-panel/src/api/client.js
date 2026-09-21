const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';
const TOKEN_KEY = 'admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Требуется вход');
  }

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (password) => request('/login', { method: 'POST', body: JSON.stringify({ password }) }),

  getDashboard: () => request('/dashboard'),

  getLevels: () => request('/levels'),
  createLevel: (data) => request('/levels', { method: 'POST', body: JSON.stringify(data) }),
  updateLevel: (id, data) => request(`/levels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLevel: (id) => request(`/levels/${id}`, { method: 'DELETE' }),

  getTrainers: () => request('/trainers'),
  createTrainer: (data) => request('/trainers', { method: 'POST', body: JSON.stringify(data) }),
  updateTrainer: (id, data) => request(`/trainers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTrainer: (id) => request(`/trainers/${id}`, { method: 'DELETE' }),

  getSlots: () => request('/schedule-slots'),
  createSlot: (data) => request('/schedule-slots', { method: 'POST', body: JSON.stringify(data) }),
  updateSlot: (id, data) => request(`/schedule-slots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSlot: (id) => request(`/schedule-slots/${id}`, { method: 'DELETE' }),
  applyScheduleFromDate: (date) => request('/schedule-slots/apply-from-date', { method: 'POST', body: JSON.stringify({ date }) }),

  getSessions: (params) => request(`/sessions?${new URLSearchParams(params).toString()}`),
  createSession: (data) => request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  bulkUpdateSessions: (ids, status) => request('/sessions/bulk', { method: 'PATCH', body: JSON.stringify({ ids, status }) }),

  getPayments: () => request('/payments'),
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => request(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),

  getClosedDays: () => request('/closed-days'),
  createClosedDay: (data) => request('/closed-days', { method: 'POST', body: JSON.stringify(data) }),
  deleteClosedDay: (id) => request(`/closed-days/${id}`, { method: 'DELETE' }),

  getUsers: () => request('/users'),

  generateMonth: (year, month) => request('/generate-month', { method: 'POST', body: JSON.stringify({ year, month }) }),

  getMonthlyReport: (year, month) => request(`/reports/monthly?year=${year}&month=${month}`),
  getForecast: (year, month) => request(`/reports/forecast?year=${year}&month=${month}`),
  exportMonthlyBlob: async (year, month) => {
    const res = await fetch(`${API_URL}/reports/monthly/export?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Не удалось экспортировать отчёт');
    return res.blob();
  },

  downloadBackup: async () => {
    const res = await fetch(`${API_URL}/backup`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('Не удалось скачать бэкап');
    return res.blob();
  },
  restoreBackup: (backupJson) => request('/backup/restore', { method: 'POST', body: JSON.stringify(backupJson) }),
};
