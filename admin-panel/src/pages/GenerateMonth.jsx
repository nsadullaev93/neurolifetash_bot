import { useState } from 'react';
import { api } from '../api/client';
import { RU_MONTHS_NOM } from '../utils/format';

const now = new Date();

export default function GenerateMonth() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [forecast, setForecast] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function preview() {
    setError('');
    setResult(null);
    try {
      setForecast(await api.getForecast(year, month));
    } catch (err) {
      setError(err.message);
    }
  }

  async function generate() {
    setLoading(true);
    setError('');
    try {
      setResult(await api.generateMonth(year, month));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Генерация месяца</h1></div>
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
          <button className="btn btn-secondary" onClick={preview}>Предпросмотр по графику</button>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Генерация…' : 'Сгенерировать занятия из шаблона'}
          </button>
        </div>

        {forecast && (
          <table className="data-table">
            <thead><tr><th>Специалист</th><th>Занятий по графику</th></tr></thead>
            <tbody>
              {forecast.breakdown.map((b) => (
                <tr key={b.trainerId}><td>{b.trainerName}</td><td>{b.plan}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {result && (
          <div className="success-box" style={{ marginTop: 14 }}>
            Создано новых занятий: {result.created}. Уже существовало: {result.skipped}.
          </div>
        )}
      </div>
    </div>
  );
}
