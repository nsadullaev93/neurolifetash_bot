import { useState } from 'react';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';
import Calendar from './pages/Calendar';
import Payments from './pages/Payments';
import Report from './pages/Report';
import More from './pages/More';

export default function App() {
  const [tab, setTab] = useState('today');

  return (
    <div className="app">
      {tab === 'today' && <Today goToCalendar={() => setTab('calendar')} />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'payments' && <Payments />}
      {tab === 'report' && <Report />}
      {tab === 'more' && <More />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
