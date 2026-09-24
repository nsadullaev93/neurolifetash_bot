import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';
import LoadingScreen from './components/LoadingScreen';
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

// Баннер офлайна (аудит надёжности, фаза 8) — отдельно от точечных
// «Failed to fetch» на каждом экране: явно называет причину (нет
// соединения), а не выглядит как поломка приложения, и сам убирается,
// когда сеть возвращается — без перезагрузки.
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

// Telegram WebView (особенно iOS) иногда продолжает показывать старый
// JS-бандл даже после нового деплоя и полного перезапуска мини-аппа —
// открывается через постоянную Menu Button с одним и тем же URL без
// параметров, поэтому обычные HTTP-заголовки кэша (Cache-Control:
// must-revalidate уже стоит на index.html) WebView иногда игнорирует.
// Сверяем при каждом запуске, какой бандл сейчас реально отдаёт сервер
// (запрос с cache: 'no-store', в обход любого локального кэша), и если он
// отличается от уже загруженного — жёстко перезагружаем страницу с новым
// query-параметром, чтобы гарантированно получить свежую копию.
function useVersionCheck() {
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(window.location.pathname, { cache: 'no-store' });
        const html = await res.text();
        const match = html.match(/assets\/index-[\w-]+\.js/);
        const currentScript = document.querySelector('script[src*="/assets/index-"]');
        const currentSrc = currentScript?.getAttribute('src') || '';
        if (match && currentScript && !currentSrc.includes(match[0].split('/').pop())) {
          const url = new URL(window.location.href);
          url.searchParams.set('_r', Date.now().toString());
          window.location.replace(url.toString());
        }
      } catch {
        /* нет сети — не мешаем работе, проверим при следующем запуске */
      }
    })();
  }, []);
}

export default function App() {
  const [tab, setTab] = useState('today');
  const [me, setMe] = useState(null);
  const online = useOnlineStatus();
  useVersionCheck();

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
      {!online && <div className="offline-banner">Нет соединения — данные могут быть неактуальны</div>}
      <Suspense fallback={<div className="screen"><LoadingScreen /></div>}>
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
