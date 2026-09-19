import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();

export default function Payments() {
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [trainers, setTrainers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [showForecast, setShowForecast] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [trainerId, setTrainerId] = useState('');
  const [paidSessions, setPaidSessions] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [trainersList, paymentsList, historyList] = await Promise.all([
        api.getTrainers(),
        api.getPayments(year, month),
        api.getPaymentsHistory(),
      ]);
      setTrainers(trainersList);
      setPayments(paymentsList);
      setHistory(historyList);
      if (!trainerId && trainersList.length) setTrainerId(String(trainersList[0].id));
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function loadForecast() {
    try {
      const result = await api.getForecast(year, month);
      setForecast(result);
      setShowForecast(true);
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedTrainer = trainers.find((t) => String(t.id) === String(trainerId));
  const existingPayment = payments.find((p) => String(p.trainerId) === String(trainerId));
  const forecastRow = forecast?.breakdown.find((b) => String(b.trainerId) === String(trainerId));
  const plan = forecastRow?.plan;

  function selectTrainer(id) {
    setTrainerId(id);
    const existing = payments.find((p) => String(p.trainerId) === String(id));
    if (existing) {
      setEditingId(existing.id);
      setPaidSessions(String(existing.paidSessions));
      setTotalAmount(String(existing.totalAmount));
    } else {
      setEditingId(null);
      setPaidSessions('');
      setTotalAmount('');
    }
  }

  function onPaidSessionsChange(value) {
    setPaidSessions(value);
    const trainer = trainers.find((t) => String(t.id) === String(trainerId));
    if (trainer && value !== '') {
      setTotalAmount(String(Number(value) * trainer.level.rate));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        year,
        month,
        trainerId: Number(trainerId),
        paidSessions: Number(paidSessions),
        totalAmount: Number(totalAmount),
      };
      if (editingId) {
        await api.updatePayment(editingId, payload);
      } else {
        await api.createPayment(payload);
      }
      setSuccess('Оплата сохранена');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const overpay = plan !== undefined && Number(paidSessions) > plan && selectedTrainer
    ? {
        extra: Number(paidSessions) - plan,
        amount: (Number(paidSessions) - plan) * selectedTrainer.level.rate,
      }
    : null;

  return (
    <div className="screen">
      <div className="header"><h1>Оплаты</h1></div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-secondary" onClick={loadForecast}>Рассчитать оплату на месяц</button>

      {showForecast && forecast && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Расчёт на {RU_MONTHS_NOM[forecast.month - 1].toLowerCase()} {forecast.year}
          </div>
          {forecast.breakdown.map((b) => (
            <div className="balance-row" key={b.trainerId}>
              <div>
                <div className="balance-name">{b.trainerName}</div>
                <div className="balance-detail">{b.plan} × {formatMoney(b.rate)}</div>
              </div>
              <div className="balance-amount gray">{formatMoney(b.amount)}</div>
            </div>
          ))}
          <div className="balance-row">
            <div className="balance-name">Итого</div>
            <div className="balance-amount gray">{formatMoney(forecast.total)}</div>
          </div>
        </div>
      )}

      <div className="section-title">Внести оплату</div>
      <form className="card" onSubmit={submit}>
        {success && <div className="warning-box" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>{success}</div>}

        <div className="form-group">
          <label>Специалист</label>
          <select className="form-select" value={trainerId} onChange={(e) => selectTrainer(e.target.value)}>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.level.name})</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Количество оплаченных занятий</label>
          <input
            className="form-input"
            type="number"
            min="0"
            value={paidSessions}
            onChange={(e) => onPaidSessionsChange(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Сумма</label>
          <input
            className="form-input"
            type="number"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
        </div>

        {overpay && (
          <div className="warning-box">
            Оплачено {paidSessions}, по графику {plan}. Возможна переплата на {overpay.extra} занятий ({formatMoney(overpay.amount)}).
          </div>
        )}

        {existingPayment && (
          <div className="warning-box" style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)' }}>
            За этот месяц уже внесена оплата — сохранение обновит её.
          </div>
        )}

        <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
          {editingId ? 'Обновить оплату' : 'Сохранить оплату'}
        </button>
      </form>

      <div className="section-title">История оплат</div>
      <div className="card">
        {history.length === 0 ? (
          <div className="empty-state">Оплат пока нет</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Специалист</th>
                <th>Оплачено</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td>{RU_MONTHS_NOM[p.month - 1].slice(0, 3)} {p.year}</td>
                  <td>{p.trainerName}</td>
                  <td>{p.paidSessions}</td>
                  <td>{formatMoney(p.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
