import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { STATUS_LABELS, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();
const STATUS_OPTIONS = Object.entries(STATUS_LABELS);

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [trainerId, setTrainerId] = useState('');
  const [status, setStatus] = useState('');
  const [bulkStatus, setBulkStatus] = useState('COMPLETED');

  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('16:00');
  const [newEnd, setNewEnd] = useState('16:40');
  const [newTrainerId, setNewTrainerId] = useState('');

  const load = useCallback(async () => {
    try {
      const params = { year, month };
      if (trainerId) params.trainerId = trainerId;
      if (status) params.status = status;
      const [sessionsList, trainersList] = await Promise.all([api.getSessions(params), api.getTrainers()]);
      setSessions(sessionsList);
      setTrainers(trainersList);
      if (!newTrainerId && trainersList.length) setNewTrainerId(String(trainersList[0].id));
      setSelected([]);
    } catch (err) {
      setError(err.message);
    }
  }, [year, month, trainerId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function applyBulk() {
    if (selected.length === 0) return;
    try {
      await api.bulkUpdateSessions(selected, bulkStatus);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(id, newStatus) {
    try {
      await api.updateSession(id, { status: newStatus });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addSession(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createSession({
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        plannedTrainerId: Number(newTrainerId),
      });
      setNewDate('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить занятие?')) return;
    try {
      await api.deleteSession(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Занятия</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <div className="form-row">
          <div className="field">
            <label>Год</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 90 }} />
          </div>
          <div className="field">
            <label>Месяц</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {RU_MONTHS_NOM.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Специалист</label>
            <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
              <option value="">Все</option>
              {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              {STATUS_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="form-row">
            <div className="field">
              <label>Массово изменить статус ({selected.length})</label>
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                {STATUS_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={applyBulk}>Применить</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Добавить занятие вручную</h2>
        <form onSubmit={addSession}>
          <div className="form-row">
            <div className="field">
              <label>Дата</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Начало</label>
              <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="field">
              <label>Конец</label>
              <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div className="field">
              <label>Специалист</label>
              <select value={newTrainerId} onChange={(e) => setNewTrainerId(e.target.value)}>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th></th><th>Дата</th><th>Время</th><th>Специалист (план)</th><th>Факт. специалист</th><th>Статус</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                <td>{new Date(s.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                <td>{s.startTime}–{s.endTime}</td>
                <td>{s.plannedTrainer?.name}</td>
                <td>{s.actualTrainer ? s.actualTrainer.name : '—'}</td>
                <td>
                  <select value={s.status} onChange={(e) => changeStatus(s.id, e.target.value)}>
                    {STATUS_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <div className="empty-state">Занятий не найдено</div>}
      </div>
    </div>
  );
}
