import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { WEEKDAY_NAMES } from '../utils/format';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [trainerId, setTrainerId] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('16:40');

  const [applyDate, setApplyDate] = useState(todayIso());
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [slotsList, trainersList] = await Promise.all([api.getSlots(), api.getTrainers()]);
      setSlots(slotsList);
      setTrainers(trainersList);
      if (!trainerId && trainersList.length) setTrainerId(String(trainersList[0].id));
    } catch (err) {
      setError(err.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createSlot({ trainerId: Number(trainerId), weekday: Number(weekday), startTime, endTime });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(slot) {
    try {
      await api.updateSlot(slot.id, { isActive: !slot.isActive });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить слот расписания?')) return;
    try {
      await api.deleteSlot(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyFromDate() {
    if (!confirm(`Пересоздать все ещё не отмеченные занятия с ${applyDate} до конца месяца по текущему шаблону? Уже отмеченные занятия не изменятся.`)) return;
    setApplying(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.applyScheduleFromDate(applyDate);
      setSuccess(`Готово: удалено ${result.deletedCount}, создано заново ${result.created} занятий.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Шаблон расписания</h1></div>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="panel">
        <h2>Применить изменения с даты</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
          После изменения слотов выше — пересоздаёт будущие ещё не отмеченные занятия по новому шаблону.
          Уже отмеченные занятия никогда не трогает.
        </p>
        <div className="form-row">
          <div className="field">
            <label>Дата</label>
            <input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={applyFromDate} disabled={applying}>
            {applying ? 'Применяем…' : 'Применить с даты…'}
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Добавить слот</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Специалист</label>
              <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>День недели</label>
              <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAYS.map((w) => <option key={w} value={w}>{WEEKDAY_NAMES[w]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Начало</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="field">
              <label>Конец</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Специалист</th><th>День</th><th>Время</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id}>
                <td>{s.trainer.name}</td>
                <td>{WEEKDAY_NAMES[s.weekday]}</td>
                <td>{s.startTime}–{s.endTime}</td>
                <td><span className={`badge ${s.isActive ? 'green' : 'gray'}`}>{s.isActive ? 'Активен' : 'Отключён'}</span></td>
                <td className="actions-cell">
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(s)}>
                    {s.isActive ? 'Отключить' : 'Включить'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
