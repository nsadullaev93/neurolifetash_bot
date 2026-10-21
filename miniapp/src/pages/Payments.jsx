import { useEffect, useState, useCallback, Fragment } from 'react';
import { api } from '../api/client';
import { formatMoney, RU_MONTHS_NOM } from '../utils/format';

// Группирует плоскую историю оплат (уже отсортированную backend'ом по
// убыванию year/month) по месяцам с итоговой суммой — плоский список было
// сложно визуально разделить на месяцы (по просьбе пользователя, 02.10.2026).
function groupHistoryByMonth(history) {
  const map = new Map();
  for (const p of history) {
    const key = `${p.year}-${p.month}`;
    if (!map.has(key)) map.set(key, { year: p.year, month: p.month, items: [], total: 0 });
    const group = map.get(key);
    group.items.push(p);
    // Зачтённый остаток прошлого месяца — не новые деньги, в итог не входит.
    if (!p.fromCarry) group.total += p.totalAmount;
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

// Подсказка к строке «из остатка»: чьи остатки и за какой месяц зачтены.
function carryTitle(p) {
  const parts = p.sources.map((s) => `${s.trainerName} ${formatMoney(s.amount)}`);
  return `из остатка за ${RU_MONTHS_NOM[p.sources[0].month - 1].toLowerCase()}: ${parts.join(' + ')}`;
}

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
  const [confirming, setConfirming] = useState(false);

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

  // Любое изменение формы прячет сводку — подтверждать нужно актуальные цифры.
  useEffect(() => {
    setConfirming(false);
  }, [trainerId, year, month, paidSessions, totalAmount, discountApplied]);

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

  // Перенос остатка прошлого месяца, зачтённый выбранному специалисту
  // (21.10.2026: за Вана форма предлагала 9 × 308 000 = 2 772 000, хотя
  // 1 244 000 уже было оплачено переносом и платить надо было 1 528 000).
  // Вычитается только из первой оплаты месяца — при повторной/редактируемой
  // перенос уже учтён.
  const statusRow = paymentStatus?.rows.find((r) => String(r.trainerId) === String(trainerId));
  const carry = !editingId && statusRow?.carryBalance ? statusRow.carryBalance : 0;

  function recomputeTotal(sessionsValue, discount) {
    const trainer = trainers.find((t) => String(t.id) === String(trainerId));
    if (trainer && sessionsValue !== '') {
      const rate = discount ? Math.round(trainer.level.rate * (1 - DISCOUNT_RATE)) : trainer.level.rate;
      setTotalAmount(String(Math.max(Number(sessionsValue) * rate - carry, 0)));
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

  // Отправка формы (кнопкой или «Готово» на клавиатуре телефона) только
  // показывает сводку — сохраняется оплата отдельной кнопкой «Подтвердить»
  // (21.10.2026: «Готово» на iPhone сохранило оплату без подтверждения).
  function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (document.activeElement) document.activeElement.blur();
    setConfirming(true);
  }

  async function confirmSave() {
    setError('');
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
      setConfirming(false);
      setSuccess('Оплата сохранена');
      await load();
    } catch (err) {
      setConfirming(false);
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
          {carry !== 0 && selectedTrainer && (
            <div className="hint-text" style={{ marginTop: 6 }}>
              🔄 Вычтен перенос с прошлого месяца: {formatMoney(carry)}
              {paidSessions !== '' && (
                <> ({paidSessions} × {formatMoney(selectedTrainer.level.rate)} − {formatMoney(carry)})</>
              )}
              . Сумму можно исправить вручную — укажите, сколько фактически заплатили.
            </div>
          )}
        </div>

        {Number(paidSessions) >= DISCOUNT_THRESHOLD && (
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
              <input type="checkbox" checked={discountApplied} onChange={(e) => toggleDiscount(e.target.checked)} />
              Скидка 10% (от {DISCOUNT_THRESHOLD} занятий)
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

        {confirming ? (
          <div className="confirm-box">
            <div className="balance-name" style={{ marginBottom: 6 }}>Проверьте оплату</div>
            <div>{selectedTrainer?.name}, {RU_MONTHS_NOM[month - 1].toLowerCase()} {year}</div>
            <div>Занятий: <b>{paidSessions}</b></div>
            <div>Сумма: <b>{formatMoney(Number(totalAmount))}</b></div>
            {carry !== 0 && <div className="balance-detail">+ перенос с прошлого месяца {formatMoney(carry)}</div>}
            {editingId && <div className="balance-detail">Заменит уже внесённую оплату за этот месяц.</div>}
            <div className="confirm-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)}>Изменить</button>
              <button className="btn btn-primary" type="button" onClick={confirmSave}>Подтвердить</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
            {editingId ? 'Обновить оплату' : 'Сохранить оплату'}
          </button>
        )}
      </form>

      <div className="section-title">История оплат</div>
      <div className="card">
        {history.length === 0 ? (
          <div className="empty-state">Оплат пока нет</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Специалист</th>
                <th>Оплачено</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {groupHistoryByMonth(history).map((group) => (
                <Fragment key={`${group.year}-${group.month}`}>
                  <tr className="history-month-row">
                    <td colSpan={3}>{RU_MONTHS_NOM[group.month - 1]} {group.year}</td>
                  </tr>
                  {group.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.trainerName}
                        {p.fromCarry && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{carryTitle(p)}</div>
                        )}
                      </td>
                      <td>{p.fromCarry ? '—' : p.paidSessions}</td>
                      <td>
                        {formatMoney(p.totalAmount)}
                        {p.fromCarry && <span> 🔄</span>}
                        {p.discountApplied && <span title="Применена скидка 10%"> 🏷️</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="history-total-row">
                    <td colSpan={2}>Итого за месяц</td>
                    <td>{formatMoney(group.total)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        {history.some((p) => p.fromCarry) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            🔄 — оплачено из остатка прошлого месяца (в «Итого» не входит)
          </div>
        )}
      </div>
    </div>
  );
}
