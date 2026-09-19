import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatMoneySigned, balanceColor, RU_MONTHS_NOM } from '../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="empty-state">Загрузка…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Дашборд — {RU_MONTHS_NOM[data.month - 1]} {data.year}</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Занятий за месяц</div>
          <div className="value">{data.totalSessions}</div>
        </div>
        <div className="stat-card">
          <div className="label">Проведено</div>
          <div className="value green">{data.completed}</div>
        </div>
        <div className="stat-card">
          <div className="label">Пропущено</div>
          <div className="value red">{data.missed}</div>
        </div>
        <div className="stat-card">
          <div className="label">Общий баланс</div>
          <div className={`value ${balanceColor(data.totalBalance)}`}>{formatMoneySigned(data.totalBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Не отмечено занятий</div>
          <div className="value">{data.unmarkedCount}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Баланс по специалистам</h2>
        <table className="data-table">
          <thead>
            <tr><th>Специалист</th><th>Оплачено</th><th>Проведено</th><th>Баланс</th></tr>
          </thead>
          <tbody>
            {data.balances.map((r) => (
              <tr key={r.trainerId}>
                <td>{r.trainerName}</td>
                <td>{r.paid}</td>
                <td>{r.completed}</td>
                <td className={`value ${balanceColor(r.balance)}`} style={{ fontSize: 13 }}>{formatMoneySigned(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.unmarked.length > 0 && (
        <div className="panel">
          <h2>Ближайшие неотмеченные занятия</h2>
          <table className="data-table">
            <thead>
              <tr><th>Дата</th><th>Время</th><th>Специалист</th></tr>
            </thead>
            <tbody>
              {data.unmarked.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                  <td>{s.startTime}–{s.endTime}</td>
                  <td>{s.effectiveTrainer?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
