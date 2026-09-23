import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();
// Те же значения, что в backend/src/config/default.js — скидка доступна,
// только если оплачено больше DISCOUNT_THRESHOLD занятий за месяц, но не
// применяется автоматически (решает администрация центра).
const DISCOUNT_THRESHOLD = 20;
const DISCOUNT_RATE = 0.1;

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [trainerId, setTrainerId] = useState('');
  const [paidSessions, setPaidSessions] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [paymentsList, trainersList] = await Promise.all([api.getPayments(), api.getTrainers()]);
      setPayments(paymentsList);
      setTrainers(trainersList);
      if (!trainerId && trainersList.length) setTrainerId(String(trainersList[0].id));
    } catch (err) {
      setError(err.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function recomputeTotal(sessionsValue, discount) {
    const trainer = trainers.find((t) => String(t.id) === String(trainerId));
    if (trainer && sessionsValue !== '') {
      const rate = discount ? Math.round(trainer.level.rate * (1 - DISCOUNT_RATE)) : trainer.level.rate;
      setTotalAmount(String(Number(sessionsValue) * rate));
    }
  }

  function onPaidSessionsChange(value) {
    setPaidSessions(value);
    const eligible = Number(value) >= DISCOUNT_THRESHOLD;
    const nextDiscount = eligible ? discountApplied : false;
    if (nextDiscount !== discountApplied) setDiscountApplied(nextDiscount);
    recomputeTotal(value, nextDiscount);
  }

  function toggleDiscount(checked) {
    setDiscountApplied(checked);
    recomputeTotal(paidSessions, checked);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createPayment({
        year: Number(year),
        month: Number(month),
        trainerId: Number(trainerId),
        paidSessions: Number(paidSessions),
        totalAmount: Number(totalAmount),
        discountApplied,
        note,
      });
      setPaidSessions('');
      setTotalAmount('');
      setDiscountApplied(false);
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить запись об оплате?')) return;
    try {
      await api.deletePayment(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Оплаты</h1></div>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h2>Внести оплату</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Год</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 90 }} />
            </div>
            <div className="field">
              <label>Месяц</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {RU_MONTHS_NOM.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Специалист</label>
              <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Оплачено занятий</label>
              <input type="number" value={paidSessions} onChange={(e) => onPaidSessionsChange(e.target.value)} required />
            </div>
            <div className="field">
              <label>Сумма</label>
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>Заметка</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {Number(paidSessions) >= DISCOUNT_THRESHOLD && (
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={discountApplied} onChange={(e) => toggleDiscount(e.target.checked)} />
                  Скидка 10% (от {DISCOUNT_THRESHOLD} занятий)
                </label>
              </div>
            )}
            <button className="btn btn-primary" type="submit">Сохранить</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Месяц</th><th>Специалист</th><th>Оплачено</th><th>Ставка</th><th>Скидка</th><th>Сумма</th><th></th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{RU_MONTHS_NOM[p.month - 1]} {p.year}</td>
                <td>{p.trainerName}</td>
                <td>{p.paidSessions}</td>
                <td>{formatMoney(p.rateSnapshot)}</td>
                <td>{p.discountApplied ? '−10%' : '—'}</td>
                <td>{formatMoney(p.totalAmount)}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
