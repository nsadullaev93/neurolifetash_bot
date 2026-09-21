import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { formatMoney, RU_MONTHS_NOM } from '../utils/format';

const PERIODS = [
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: '6 месяцев' },
  { id: '1y', label: 'Год' },
  { id: 'all', label: 'Всё время' },
];

function pct(v) {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

// Проценты посещаемости видят все члены семьи, денежные показатели —
// только у кого открыты деньги (ТЗ v2, §2.16) — сервер их и не пришлёт,
// если canSeeMoney=false, но график/карточку всё равно прячем явно.
export default function ReportStats({ canSeeMoney }) {
  const [period, setPeriod] = useState('3m');
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, t] = await Promise.all([api.getStats({ period }), api.getStatsTrend({ period })]);
      setStats(s);
      setTrend(t.map((m) => ({ ...m, label: RU_MONTHS_NOM[m.month - 1].slice(0, 3) })));
    } catch (err) {
      setError(err.message);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      {error && <div className="error-box">{error}</div>}

      <div className="subtabs">
        {PERIODS.map((p) => (
          <button key={p.id} className={`subtab ${period === p.id ? 'active' : ''}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {stats && (
        <>
          <div className="card" style={{ display: 'flex', gap: 16, justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Состоялось занятий</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{pct(stats.total.attendanceRate)}</div>
            </div>
            {canSeeMoney && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Проведено на сумму</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(stats.total.valueConducted)}</div>
              </div>
            )}
          </div>

          <div className="section-title">Занятия по месяцам</div>
          <div className="card" style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" />
                <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }} />
                <Bar dataKey="held" fill="var(--blue)" radius={[4, 4, 0, 0]} name="Проведено" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {canSeeMoney && (
            <>
              <div className="section-title">Сумма по месяцам</div>
              <div className="card" style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" />
                    <YAxis fontSize={11} stroke="var(--text-muted)" width={36} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }} />
                    <Line type="monotone" dataKey="valueConducted" stroke="var(--green)" strokeWidth={2} name="Сумма" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="section-title">По специалистам</div>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Специалист</th>
                  <th>Посещаемость</th>
                  <th>Надёжность</th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.map((r) => (
                  <tr key={r.trainerId}>
                    <td>{r.name}</td>
                    <td>{pct(r.attendanceRate)}</td>
                    <td>{pct(r.reliability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
