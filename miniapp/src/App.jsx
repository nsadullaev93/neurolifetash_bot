import { useState, useEffect, useCallback } from 'react';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';
import Calendar from './pages/Calendar';
import Payments from './pages/Payments';
import Report from './pages/Report';
import More from './pages/More';
import { api } from './api/client';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.setHeaderColor(bg);
    window.Telegram.WebApp.setBackgroundColor(bg);
  }
}

export default function App() {
  const [tab, setTab] = useState('today');
  const [me, setMe] = useState(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.authTelegram();
      setMe(data);
      applyTheme(data.theme);
    } catch {
      /* показывается уже в самих экранах при их собственных запросах */
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Видеть оплаты/баланс/отчёты может владелец и участники, которым
  // открыты деньги (ТЗ v2, §2.14) — до первой загрузки /auth/telegram
  // считаем, что нет, чтобы не мигать разделом, который сейчас же скроется.
  const canSeeMoney = !!me?.canSeeMoney;

  return (
    <div className="app">
      {tab === 'today' && <Today goToCalendar={() => setTab('calendar')} />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'payments' && canSeeMoney && <Payments />}
      {tab === 'report' && <Report canSeeMoney={canSeeMoney} />}
      {tab === 'more' && <More me={me} onMeUpdate={(updated) => { setMe(updated); applyTheme(updated.theme); }} />}

      <BottomNav active={tab} onChange={setTab} canSeeMoney={canSeeMoney} />
    </div>
  );
}
