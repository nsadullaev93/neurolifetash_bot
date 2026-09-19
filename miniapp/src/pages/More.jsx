import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney } from '../utils/format';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174';

export default function More() {
  const [trainers, setTrainers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [trainersList, settingsData] = await Promise.all([api.getTrainers(), api.getSettings()]);
      setTrainers(trainersList);
      setSettings(settingsData);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleReminders() {
    const updated = await api.updateSettings({ remindersOn: !settings.remindersOn });
    setSettings(updated);
  }

  async function changeTime(e) {
    const updated = await api.updateSettings({ reminderTime: e.target.value });
    setSettings(updated);
  }

  return (
    <div className="screen">
      <div className="header"><h1>Ещё</h1></div>

      {error && <div className="error-box">{error}</div>}

      <div className="section-title">Специалисты</div>
      <div className="card">
        {trainers.map((t) => (
          <div className="trainer-list-item" key={t.id}>
            <div>
              <div className="name">{t.name}</div>
              <div className="level">{t.level.name}</div>
            </div>
            <div className="rate">{formatMoney(t.level.rate)}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Напоминания</div>
      <div className="card">
        {settings && (
          <>
            <div className="settings-row">
              <div>Присылать напоминания</div>
              <button className={`switch ${settings.remindersOn ? 'on' : ''}`} onClick={toggleReminders}>
                <span className="switch-knob" />
              </button>
            </div>
            <div className="settings-row" style={{ borderBottom: 'none' }}>
              <div>Время напоминания</div>
              <input
                type="time"
                className="form-input"
                style={{ width: 120 }}
                value={settings.reminderTime}
                onChange={changeTime}
              />
            </div>
          </>
        )}
      </div>

      <div className="section-title">Администрирование</div>
      <div className="card">
        <a className="btn btn-outline" href={ADMIN_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          Открыть Admin Panel
        </a>
      </div>
    </div>
  );
}
