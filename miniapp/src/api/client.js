const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getInitData() {
  return window.Telegram?.WebApp?.initData || '';
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
      ...(options.headers || {}),
    },
  });

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

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.blob();
}

export const api = {
  authTelegram: () => request('/auth/telegram', { method: 'POST' }),
  getDashboard: () => request('/dashboard'),
  getToday: () => request('/sessions/today'),
  getUnmarked: () => request('/sessions/unmarked'),
  getMonthSessions: (year, month) => request(`/sessions?year=${year}&month=${month}`),
  updateSession: (id, data) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createMakeup: (id, data) => request(`/sessions/${id}/makeup`, { method: 'POST', body: JSON.stringify(data) }),
  getTrainers: () => request('/trainers'),
  getPayments: (year, month) => request(`/payments?year=${year}&month=${month}`),
  getPaymentsHistory: () => request('/payments/history'),
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => request(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getMonthlyReport: (year, month) => request(`/reports/monthly?year=${year}&month=${month}`),
  getForecast: (year, month) => request(`/reports/forecast?year=${year}&month=${month}`),
  exportMonthlyBlob: (year, month) => request(`/reports/monthly/export?year=${year}&month=${month}`),
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

export { API_URL, getInitData };
