import { useState } from 'react';
import { getToken } from './api/client';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Trainers from './pages/Trainers';
import Levels from './pages/Levels';
import Schedule from './pages/Schedule';
import Payments from './pages/Payments';
import ClosedDays from './pages/ClosedDays';
import Reports from './pages/Reports';
import GenerateMonth from './pages/GenerateMonth';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [page, setPage] = useState('dashboard');

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="layout">
      <Sidebar active={page} onChange={setPage} />
      <main className="content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'sessions' && <Sessions />}
        {page === 'trainers' && <Trainers />}
        {page === 'levels' && <Levels />}
        {page === 'schedule' && <Schedule />}
        {page === 'payments' && <Payments />}
        {page === 'closedDays' && <ClosedDays />}
        {page === 'reports' && <Reports />}
        {page === 'generateMonth' && <GenerateMonth />}
      </main>
    </div>
  );
}
