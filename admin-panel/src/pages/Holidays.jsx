import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const STATUS_LABELS = {
  UNKNOWN: 'Не подтверждён',
  OPEN: 'Центр работает',
  CLOSED: 'Центр закрыт',
};

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('UNKNOWN');

  const load = useCallback(async () => {
    try {
      setHolidays(await api.getHolidays());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createHoliday({ date, title, status: status === 'UNKNOWN' ? undefined : status });
      setDate('');
      setTitle('');
      setStatus('UNKNOWN');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить праздник?')) return;
    try {
      await api.deleteHoliday(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Праздники</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h2>Добавить праздник</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: -8 }}>
          Фиксированные праздники Узбекистана уже заведены автоматически. Сюда добавляются даты с плавающим числом
          (Рамазан-хайит, Курбан-хайит) или любой другой праздник, которого нет в списке. Если статус оставить «Не
          подтверждён», бот сам спросит про этот день за 2 дня и накануне — как для остальных праздников.
        </p>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Рамазан-хайит" required />
            </div>
            <div className="field">
              <label>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="UNKNOWN">Не подтверждён (спросить позже)</option>
                <option value="OPEN">Центр работает</option>
                <option value="CLOSED">Центр закрыт</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        {holidays.length === 0 ? (
          <div className="empty-state">Праздников пока нет</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Дата</th><th>Название</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                  <td>{h.title}</td>
                  <td>{STATUS_LABELS[h.status] || h.status}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(h.id)}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
