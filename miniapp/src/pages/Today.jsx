import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import SessionCard from '../components/SessionCard';
import Banner from '../components/Banner';
import BalanceRow from '../components/BalanceRow';
import LoadingScreen from '../components/LoadingScreen';

export default function Today({ goToCalendar }) {
  const [data, setData] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [dashboard, trainersList] = await Promise.all([api.getDashboard(), api.getTrainers()]);
      setData(dashboard);
      setTrainers(trainersList);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(id, patch) {
    setBusyId(id);
    try {
      await api.updateSession(id, patch);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <div className="screen"><div className="error-box">{error}</div></div>;
  }

  if (!data) {
    return <div className="screen"><LoadingScreen /></div>;
  }

  return (
    <div className="screen">
      <div className="header">
        <h1>{data.user.firstName}, здравствуйте</h1>
        <div className="subtitle">{data.dateLabel}</div>
      </div>

      <Banner count={data.unmarkedCount} onClick={goToCalendar} />

      {data.todaySessions.length === 0 ? (
        <div className="empty-state">На сегодня занятий не запланировано</div>
      ) : (
        data.todaySessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            trainers={trainers}
            onUpdate={handleUpdate}
            busy={busyId === s.id}
          />
        ))
      )}

      {data.canSeeMoney && (
        <>
          <div className="section-title">Баланс за месяц</div>
          <div className="card">
            {data.balances.map((row) => (
              <BalanceRow key={row.trainerId} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
