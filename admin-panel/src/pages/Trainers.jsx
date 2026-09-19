import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney } from '../utils/format';

export default function Trainers() {
  const [trainers, setTrainers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [trainersList, levelsList] = await Promise.all([api.getTrainers(), api.getLevels()]);
      setTrainers(trainersList);
      setLevels(levelsList);
      if (!levelId && levelsList.length) setLevelId(String(levelsList[0].id));
    } catch (err) {
      setError(err.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createTrainer({ name, levelId: Number(levelId), note });
      setName('');
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(t) {
    try {
      await api.updateTrainer(t.id, { isActive: !t.isActive });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeLevel(t, newLevelId) {
    try {
      await api.updateTrainer(t.id, { levelId: Number(newLevelId) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить специалиста? Связанные занятия и оплаты также будут затронуты.')) return;
    try {
      await api.deleteTrainer(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Специалисты</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h2>Добавить специалиста</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Имя</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Уровень</label>
              <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.name} ({formatMoney(l.rate)})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Заметка</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Имя</th><th>Уровень</th><th>Ставка</th><th>Статус</th><th>Заметка</th><th></th></tr>
          </thead>
          <tbody>
            {trainers.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <select value={t.levelId} onChange={(e) => changeLevel(t, e.target.value)}>
                    {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </td>
                <td>{formatMoney(t.level.rate)}</td>
                <td>
                  <span className={`badge ${t.isActive ? 'green' : 'gray'}`}>{t.isActive ? 'Активен' : 'Отключён'}</span>
                </td>
                <td>{t.note || '—'}</td>
                <td className="actions-cell">
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(t)}>
                    {t.isActive ? 'Отключить' : 'Включить'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
