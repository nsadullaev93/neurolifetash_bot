import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, formatMoneySigned, balanceColor, RU_MONTHS_NOM } from '../utils/format';

const now = new Date();

export default function Reports() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setReport(await api.getMonthlyReport(year, month));
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

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
    <div>
      <div className="page-header"><h1>Отчёты</h1></div>
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
          <button className="btn btn-primary" onClick={exportReport} disabled={exporting}>
            {exporting ? 'Экспорт…' : 'Экспортировать в Excel'}
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="panel">
            <table className="data-table">
              <thead>
                <tr><th>Специалист</th><th>Ставка</th><th>План</th><th>Оплачено</th><th>Проведено</th><th>Баланс</th></tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.trainerId}>
                    <td>{r.trainerName}</td>
                    <td>{formatMoney(r.rate)}</td>
                    <td>{r.plan}</td>
                    <td>{r.paid}</td>
                    <td>{r.completed}</td>
                    <td className={`value ${balanceColor(r.balance)}`} style={{ fontSize: 13 }}>{formatMoneySigned(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}><strong>Итого</strong></td>
                  <td className={`value ${balanceColor(report.total)}`} style={{ fontSize: 13 }}>
                    <strong>{formatMoneySigned(report.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
            {report.rows.some((r) => r.overpayWarning) && (
              <div className="error-box" style={{ marginTop: 14 }}>
                {report.rows.filter((r) => r.overpayWarning).map((r) => (
                  <div key={r.trainerId}>
                    {r.trainerName}: оплачено {r.paid}, по графику {r.plan}. Возможна переплата на {r.overpayWarning.extraSessions} занятий ({formatMoney(r.overpayWarning.extraAmount)}).
                  </div>
                ))}
              </div>
            )}
          </div>

          {report.missedBreakdown.length > 0 && (
            <div className="panel">
              <h2>Пропуски по причинам</h2>
              <table className="data-table">
                <thead><tr><th>Причина</th><th>Количество</th></tr></thead>
                <tbody>
                  {report.missedBreakdown.map((m) => (
                    <tr key={m.status}><td>{m.label}</td><td>{m.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
