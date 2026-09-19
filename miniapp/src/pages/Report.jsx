import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, formatMoneySigned, balanceColor, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();

export default function Report() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await api.getMonthlyReport(year, month);
      setReport(result);
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function exportReport() {
    setExporting(true);
    try {
      const blob = await api.exportMonthlyBlob(year, month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${year}-${String(month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="screen">
      <div className="header"><h1>Отчёт</h1></div>

      {error && <div className="error-box">{error}</div>}

      <div className="calendar-header">
        <button className="icon-btn" onClick={prevMonth}>‹</button>
        <h2>{RU_MONTHS_NOM[month - 1]} {year}</h2>
        <button className="icon-btn" onClick={nextMonth}>›</button>
      </div>

      {report && (
        <>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Специалист</th>
                  <th>Ставка</th>
                  <th>Опл.</th>
                  <th>Пров.</th>
                  <th>Баланс</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.trainerId}>
                    <td>{r.trainerName}</td>
                    <td>{formatMoney(r.rate)}</td>
                    <td>{r.paid}</td>
                    <td>{r.completed}</td>
                    <td className={`balance-amount ${balanceColor(r.balance)}`}>{formatMoneySigned(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.some((r) => r.overpayWarning) && (
              <div className="warning-box">
                {report.rows.filter((r) => r.overpayWarning).map((r) => (
                  <div key={r.trainerId}>
                    {r.trainerName}: оплачено {r.paid}, по графику {r.plan}. Переплата на {r.overpayWarning.extraSessions} занятий ({formatMoney(r.overpayWarning.extraAmount)}).
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`card total-balance-card`}>
            <div className="label">Общий баланс за месяц</div>
            <div className="amount" style={{ color: `var(--${balanceColor(report.total)})` }}>
              {formatMoneySigned(report.total)}
            </div>
          </div>

          {report.missedBreakdown.length > 0 && (
            <>
              <div className="section-title">Пропуски по причинам</div>
              <div className="card">
                {report.missedBreakdown.map((m) => (
                  <div className="balance-row" key={m.status}>
                    <div className="balance-name">{m.label}</div>
                    <div>{m.count}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={exportReport} disabled={exporting} style={{ marginTop: 8 }}>
            {exporting ? 'Экспорт…' : 'Экспорт отчёта (Excel)'}
          </button>
        </>
      )}
    </div>
  );
}
