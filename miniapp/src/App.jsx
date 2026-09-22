import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';
import { api } from './api/client';

const Calendar = lazy(() => import('./pages/Calendar'));
const Payments = lazy(() => import('./pages/Payments'));
const Report = lazy(() => import('./pages/Report'));
const More = lazy(() => import('./pages/More'));

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
      <Suspense fallback={<div className="screen"><div className="center-loading">Загрузка…</div></div>}>
        {tab === 'today' && <Today goToCalendar={() => setTab('calendar')} />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'payments' && canSeeMoney && <Payments />}
        {tab === 'report' && <Report canSeeMoney={canSeeMoney} />}
        {tab === 'more' && <More me={me} onMeUpdate={(updated) => { setMe(updated); applyTheme(updated.theme); }} />}
      </Suspense>

      <BottomNav active={tab} onChange={setTab} canSeeMoney={canSeeMoney} />
    </div>
  );
}
