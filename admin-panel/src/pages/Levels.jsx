import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney } from '../utils/format';

export default function Levels() {
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const list = await api.getLevels();
      setLevels(list);
      setDrafts(Object.fromEntries(list.map((l) => [l.id, l.rate])));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveRate(level) {
    setError('');
    setSuccess('');
    try {
      await api.updateLevel(level.id, { rate: Number(drafts[level.id]) });
      setSuccess(`Ставка «${level.name}» обновлена. Прошлые месяцы не пересчитываются.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Уровни и ставки</h1></div>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Уровень</th><th>Текущая ставка</th><th>Новая ставка</th><th></th></tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{formatMoney(l.rate)}</td>
                <td>
                  <input
                    type="number"
                    value={drafts[l.id] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [l.id]: e.target.value })}
                    style={{ width: 140, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => saveRate(l)}>Сохранить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
