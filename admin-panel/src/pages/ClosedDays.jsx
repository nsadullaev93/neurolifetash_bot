import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

export default function ClosedDays() {
  const [days, setDays] = useState([]);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('Праздник');

  const load = useCallback(async () => {
    try {
      setDays(await api.getClosedDays());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createClosedDay({ date, title });
      setDate('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить закрытый день?')) return;
    try {
      await api.deleteClosedDay(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Закрытые дни</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h2>Добавить закрытый день</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        {days.length === 0 ? (
          <div className="empty-state">Закрытых дней пока нет</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Дата</th><th>Название</th><th></th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                  <td>{d.title}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
