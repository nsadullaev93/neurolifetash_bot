import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoneySigned, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();

// Остатки прошлого месяца, зачитываемые в выбранный месяц, с выбором
// специалиста, которому их зачесть (по умолчанию — тому же, у кого
// образовался остаток).
export default function CarryOverPanel({ trainers }) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [carries, setCarries] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setCarries(await api.getCarryOvers(year, month));
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  async function changeTarget(carry, targetTrainerId) {
    setError('');
    setSuccess('');
    try {
      const updated = await api.updateCarryTarget(carry.id, Number(targetTrainerId));
      setSuccess(`Остаток ${carry.trainerName} теперь зачитывается: ${updated.targetTrainerName}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  // В списке — активные специалисты плюс исходный (даже если он сейчас
  // отключён), чтобы можно было вернуть остаток обратно ему.
  function optionsFor(carry) {
    const list = trainers.filter((t) => t.isActive);
    if (!list.some((t) => t.id === carry.trainerId)) {
      list.push({ id: carry.trainerId, name: `${carry.trainerName} (отключён)` });
    }
    return list;
  }

  return (
    <div className="panel">
      <h2>Перенос остатка с прошлого месяца</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: -8 }}>
        Остаток по сверке прошлого месяца автоматически зачитывается в этот месяц. Можно выбрать, к оплате какого
        специалиста его прибавить/вычесть — например, если у специалиста, у которого образовался остаток, сейчас
        отпуск. «+» — переплата (к оплате станет меньше), «−» — доплата.
      </p>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="form-row" style={{ alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => shiftMonth(-1)}>‹</button>
        <strong>Зачитывается в: {RU_MONTHS_NOM[month - 1]} {year}</strong>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => shiftMonth(1)}>›</button>
      </div>

      {carries.length === 0 ? (
        <div className="empty-state">Переносов в этот месяц нет</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Остаток специалиста</th><th>За месяц</th><th>Сумма</th><th>Зачесть специалисту</th></tr>
          </thead>
          <tbody>
            {carries.map((c) => (
              <tr key={c.id}>
                <td>{c.trainerName}</td>
                <td>{RU_MONTHS_NOM[c.fromMonth - 1]} {c.fromYear}</td>
                <td>{formatMoneySigned(c.balance)}</td>
                <td>
                  <select value={c.targetTrainerId} onChange={(e) => changeTarget(c, e.target.value)}>
                    {optionsFor(c).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
