import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

export default function TrainerPauses() {
  const [pauses, setPauses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');

  const [trainerId, setTrainerId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [pausesList, trainersList] = await Promise.all([api.getTrainerPauses(), api.getTrainers()]);
      setPauses(pausesList);
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
      await api.createTrainerPause({
        trainerId: Number(trainerId),
        fromDate,
        toDate: toDate || undefined,
        note: note || undefined,
      });
      setFromDate('');
      setToDate('');
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Завершить/удалить паузу оплаты?')) return;
    try {
      await api.deleteTrainerPause(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Отпуска специалистов</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h2>Поставить оплату на паузу</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: -8 }}>
          На даты паузы специалист не учитывается в калькуляторе оплаты и в напоминании об оплате 1-7 числа — семья
          не обязана платить за него в этот период, и бот не будет требовать долг. Его занятия на эти даты также
          пропадают из расписания и календаря — как будто их нет. После завершения/удаления паузы занятия текущего
          месяца возвращаются автоматически.
        </p>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Специалист</label>
              <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>С даты</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>По дату (необязательно)</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Заметка</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Отпуск" />
            </div>
            <button className="btn btn-primary" type="submit">Поставить на паузу</button>
          </div>
        </form>
      </div>

      <div className="panel">
        {pauses.length === 0 ? (
          <div className="empty-state">Пауз нет</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Специалист</th><th>С</th><th>По</th><th>Заметка</th><th></th></tr></thead>
            <tbody>
              {pauses.map((p) => (
                <tr key={p.id}>
                  <td>{p.trainer?.name}</td>
                  <td>{new Date(p.fromDate).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                  <td>{p.toDate ? new Date(p.toDate).toLocaleDateString('ru-RU', { timeZone: 'UTC' }) : 'бессрочно'}</td>
                  <td>{p.note || '—'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Завершить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
