import { useState } from 'react';
import { clearToken } from '../api/client';

const PAGES = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'sessions', label: 'Занятия' },
  { id: 'trainers', label: 'Специалисты' },
  { id: 'levels', label: 'Уровни и ставки' },
  { id: 'schedule', label: 'Шаблон расписания' },
  { id: 'payments', label: 'Оплаты' },
  { id: 'closedDays', label: 'Закрытые дни' },
  { id: 'holidays', label: 'Праздники' },
  { id: 'reports', label: 'Отчёты' },
  { id: 'generateMonth', label: 'Генерация месяца' },
  { id: 'backup', label: 'Резервная копия' },
  { id: 'auditLog', label: 'История изменений' },
];

export default function Sidebar({ active, onChange }) {
  const [dark, setDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('admin_theme', next);
    setDark(!dark);
  }

  return (
    <aside className="sidebar">
      <h1>Журнал занятий</h1>
      {PAGES.map((p) => (
        <button
          key={p.id}
          className={`sidebar-link ${active === p.id ? 'active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
      <button className="sidebar-link" onClick={toggleTheme}>
        {dark ? '☀️ Светлая тема' : '🌙 Тёмная тема'}
      </button>
      <button
        className="sidebar-link logout"
        onClick={() => {
          clearToken();
          window.location.reload();
        }}
      >
        Выйти
      </button>
    </aside>
  );
}
