import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();
// Скидка по усмотрению администрации центра — доступна только когда за
// месяц оплачено больше DISCOUNT_THRESHOLD занятий, но не применяется
// автоматически (backend/src/config/default.js: те же значения).
const DISCOUNT_THRESHOLD = 20;
const DISCOUNT_RATE = 0.1;

export default function Payments() {
  // Год/месяц оплаты — выбираются в разделе «Внести оплату» (можно внести
  // оплату заранее на будущий месяц или задним числом за прошлый); от них
  // же зависит «Статус оплаты за месяц» ниже, так что переключение месяца
  // обновляет обе секции разом.
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [trainers, setTrainers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [showForecast, setShowForecast] = useState(false);
  // Калькулятор — отдельный месяц/год от остальной страницы (оплаты/статус
  // всегда про текущий месяц, а посчитать заранее хочется и на будущие).
  const [forecastYear, setForecastYear] = useState(year);
  const [forecastMonth, setForecastMonth] = useState(month);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [trainerId, setTrainerId] = useState('');
  const [paidSessions, setPaidSessions] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [trainersList, paymentsList, historyList, statusResult] = await Promise.all([
        api.getTrainers(),
        api.getPayments(year, month),
        api.getPaymentsHistory(),
        api.getPaymentStatus(year, month),
      ]);
      setTrainers(trainersList);
      setPayments(paymentsList);
      setHistory(historyList);
      setPaymentStatus(statusResult);
      if (!trainerId && trainersList.length) setTrainerId(String(trainersList[0].id));
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function loadForecast(y = forecastYear, m = forecastMonth) {
    try {
      const result = await api.getForecast(y, m);
      setForecast(result);
      setShowForecast(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function shiftForecastMonth(delta) {
    let m = forecastMonth + delta;
    let y = forecastYear;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setForecastMonth(m);
    setForecastYear(y);
    if (showForecast) loadForecast(y, m);
  }

  const selectedTrainer = trainers.find((t) => String(t.id) === String(trainerId));
  const existingPayment = payments.find((p) => String(p.trainerId) === String(trainerId));
  const forecastRow = forecast?.breakdown.find((b) => String(b.trainerId) === String(trainerId));
  const plan = forecastRow?.plan;

  // Синхронизирует форму (кол-во/сумма/скидка) с уже внесённой оплатой
  // выбранного специалиста за выбранный год/месяц — срабатывает и при
  // смене специалиста, и при смене месяца (после того как payments
  // перезагрузятся под новый месяц).
  useEffect(() => {
    if (!trainerId) return;
    const existing = payments.find((p) => String(p.trainerId) === String(trainerId));
    if (existing) {
      setEditingId(existing.id);
      setPaidSessions(String(existing.paidSessions));
      setTotalAmount(String(existing.totalAmount));
      setDiscountApplied(!!existing.discountApplied);
    } else {
      setEditingId(null);
      setPaidSessions('');
      setTotalAmount('');
      setDiscountApplied(false);
    }
  }, [payments, trainerId]);

  function selectTrainer(id) {
    setTrainerId(id);
  }

  function shiftPaymentMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  function recomputeTotal(sessionsValue, discount) {
    const trainer = trainers.find((t) => String(t.id) === String(trainerId));
    if (trainer && sessionsValue !== '') {
      const rate = discount ? Math.round(trainer.level.rate * (1 - DISCOUNT_RATE)) : trainer.level.rate;
      setTotalAmount(String(Number(sessionsValue) * rate));
    }
  }

  function onPaidSessionsChange(value) {
    setPaidSessions(value);
    const eligible = Number(value) > DISCOUNT_THRESHOLD;
    const nextDiscount = eligible && discountApplied;
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
    setSuccess('');
    try {
      const payload = {
        year,
        month,
        trainerId: Number(trainerId),
        paidSessions: Number(paidSessions),
        totalAmount: Number(totalAmount),
        discountApplied,
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

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button className="icon-btn" onClick={() => shiftForecastMonth(-1)} aria-label="Предыдущий месяц">‹</button>
          <div style={{ fontWeight: 700 }}>{RU_MONTHS_NOM[forecastMonth - 1]} {forecastYear}</div>
          <button className="icon-btn" onClick={() => shiftForecastMonth(1)} aria-label="Следующий месяц">›</button>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => loadForecast()}>
          Рассчитать оплату на месяц
        </button>
      </div>

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

      {paymentStatus && (
        <>
          <div className="section-title">Статус оплаты за месяц</div>
          <div className="hint-text">
            Сколько уже оплачено по сравнению с планом на весь месяц по графику — не с фактически проведёнными
            занятиями (это показывает «Баланс» на вкладке «Отчёт»), поэтому цифры отличаются.
          </div>
          <div className="card">
            {paymentStatus.rows.map((r) => (
              <div className="balance-row" key={r.trainerId}>
                <div>
                  <div className="balance-name">{r.trainerName}</div>
                  {r.status !== 'PAID' && (
                    <div className="balance-detail">Осталось {formatMoney(r.remaining)}</div>
                  )}
                </div>
                <span className={`badge ${r.status === 'PAID' ? 'green' : r.status === 'PARTIAL' ? 'yellow' : 'red'}`}>
                  {r.status === 'PAID' ? 'Оплачено' : r.status === 'PARTIAL' ? 'Частично' : 'Не оплачено'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Внести оплату</div>
      <div className="calendar-header" style={{ marginBottom: 10 }}>
        <button type="button" className="icon-btn" onClick={() => shiftPaymentMonth(-1)} aria-label="Предыдущий месяц">‹</button>
        <h2>{RU_MONTHS_NOM[month - 1]} {year}</h2>
        <button type="button" className="icon-btn" onClick={() => shiftPaymentMonth(1)} aria-label="Следующий месяц">›</button>
      </div>
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

        {Number(paidSessions) > DISCOUNT_THRESHOLD && (
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
              <input type="checkbox" checked={discountApplied} onChange={(e) => toggleDiscount(e.target.checked)} />
              Скидка 10% (более {DISCOUNT_THRESHOLD} занятий — по усмотрению центра)
            </label>
          </div>
        )}

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
                  <td>
                    {formatMoney(p.totalAmount)}
                    {p.discountApplied && <span title="Применена скидка 10%"> 🏷️</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
