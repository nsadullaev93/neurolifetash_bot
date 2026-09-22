import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ACTION_LABELS = {
  update: 'изменено',
  create: 'создано',
  delete: 'удалено',
  'restore-backup': 'восстановлено из бэкапа',
  'apply-from-date': 'применён шаблон расписания',
};

const ENTITY_LABELS = {
  Session: 'Занятие',
  MonthlyPayment: 'Оплата',
  Family: 'Семья',
  ScheduleSlot: 'Расписание',
};

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

// Компактная разница между старым и новым значением — показывает только
// изменившиеся поля, а не весь объект целиком (записи Session/Payment
// довольно объёмные, полный JSON было бы неудобно читать).
function diffSummary(oldValue, newValue) {
  if (!oldValue || !newValue) return null;
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  const changed = [];
  for (const key of keys) {
    if (['updatedAt', 'markedAt', 'createdAt'].includes(key)) continue;
    const before = oldValue[key];
    const after = newValue[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push(`${key}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }
  return changed.length ? changed.join(', ') : null;
}

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuditLog()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>История изменений</h1></div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -12, marginBottom: 20 }}>
        Последние 100 изменений занятий, оплат и других данных семьи — кто и что поменял.
      </p>
      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="empty-state">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">Изменений пока нет</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Кто</th>
                <th>Что</th>
                <th>Действие</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td>{r.userName || <span className="badge gray">система</span>}</td>
                  <td>{ENTITY_LABELS[r.entity] || r.entity} #{r.entityId}</td>
                  <td>{ACTION_LABELS[r.action] || r.action}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {diffSummary(r.oldValue, r.newValue) || '—'}
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
