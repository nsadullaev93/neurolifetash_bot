import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, formatDateRu } from '../utils/format';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174';

export default function More({ me, onMeUpdate }) {
  const [trainers, setTrainers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [invitingLoading, setInvitingLoading] = useState(false);

  const isOwner = me?.role === 'OWNER';

  const load = useCallback(async () => {
    try {
      const [trainersList, settingsData, membersList, holidaysList] = await Promise.all([
        api.getTrainers(),
        api.getSettings(),
        api.getFamilyMembers(),
        api.getHolidays(),
      ]);
      setTrainers(trainersList);
      setSettings(settingsData);
      setMembers(membersList);
      setHolidays(holidaysList);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSetting(patch) {
    try {
      const updated = await api.updateSettings(patch);
      setSettings((s) => ({ ...s, ...updated }));
      if (patch.theme !== undefined) {
        onMeUpdate({ ...me, theme: updated.theme });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function createInvite() {
    setInvitingLoading(true);
    setError('');
    try {
      const result = await api.createInvite();
      setInviteLink(result.link);
    } catch (err) {
      setError(err.message);
    } finally {
      setInvitingLoading(false);
    }
  }

  async function toggleMoney(member) {
    try {
      const updated = await api.updateFamilyMember(member.id, { canSeeMoney: !member.canSeeMoney });
      setMembers((list) => list.map((m) => (m.id === member.id ? updated : m)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMember(member) {
    if (!confirm(`Убрать ${member.displayName} из семьи?`)) return;
    try {
      await api.removeFamilyMember(member.id);
      setMembers((list) => list.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function answerHoliday(holiday, status) {
    try {
      const updated = await api.setHolidayStatus(holiday.id, status);
      setHolidays((list) => list.map((h) => (h.id === holiday.id ? updated : h)));
    } catch (err) {
      setError(err.message);
    }
  }

  const unknownHolidays = holidays.filter((h) => h.status === 'UNKNOWN');

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

      <div className="section-title">Оформление</div>
      <div className="card">
        {settings && (
          <div className="settings-row" style={{ borderBottom: 'none' }}>
            <div>Тёмная тема</div>
            <button
              className={`switch ${settings.theme === 'dark' ? 'on' : ''}`}
              onClick={() => updateSetting({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            >
              <span className="switch-knob" />
            </button>
          </div>
        )}
      </div>

      <div className="section-title">Напоминания</div>
      <div className="card">
        {settings && (
          <>
            <div className="settings-row">
              <div>Отметить занятия за сегодня</div>
              <button className={`switch ${settings.remindersOn ? 'on' : ''}`} onClick={() => updateSetting({ remindersOn: !settings.remindersOn })}>
                <span className="switch-knob" />
              </button>
            </div>
            <div className="settings-row">
              <div>Время напоминания</div>
              <input
                type="time"
                className="form-input"
                style={{ width: 120 }}
                value={settings.reminderTime}
                onChange={(e) => updateSetting({ reminderTime: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <div>Сообщения после занятий</div>
              <button className={`switch ${settings.sessionPings ? 'on' : ''}`} onClick={() => updateSetting({ sessionPings: !settings.sessionPings })}>
                <span className="switch-knob" />
              </button>
            </div>
            {me?.canSeeMoney && (
              <div className="settings-row" style={{ borderBottom: 'none' }}>
                <div>Напоминания об оплате</div>
                <button className={`switch ${settings.paymentPings ? 'on' : ''}`} onClick={() => updateSetting({ paymentPings: !settings.paymentPings })}>
                  <span className="switch-knob" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {unknownHolidays.length > 0 && (
        <>
          <div className="section-title">Праздники — центр работает?</div>
          <div className="card">
            {unknownHolidays.map((h) => (
              <div className="settings-row" key={h.id}>
                <div>
                  <div className="balance-name">{h.title}</div>
                  <div className="balance-detail">{formatDateRu(h.date)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm-inline" onClick={() => answerHoliday(h, 'OPEN')}>Работает</button>
                  <button className="btn btn-secondary btn-sm-inline" onClick={() => answerHoliday(h, 'CLOSED')}>Закрыт</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Семья</div>
      <div className="card">
        {members.map((m) => (
          <div className="settings-row" key={m.id}>
            <div>
              <div className="balance-name">{m.displayName}{m.role === 'OWNER' && ' (владелец)'}</div>
              <div className="balance-detail">{m.canSeeMoney ? 'видит деньги' : 'не видит деньги'}</div>
            </div>
            {isOwner && m.role !== 'OWNER' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm-inline" onClick={() => toggleMoney(m)}>
                  {m.canSeeMoney ? 'Скрыть деньги' : 'Показать деньги'}
                </button>
                <button className="btn btn-danger btn-sm-inline" onClick={() => removeMember(m)}>Удалить</button>
              </div>
            )}
          </div>
        ))}

        {isOwner && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={createInvite} disabled={invitingLoading}>
              {invitingLoading ? 'Создаём ссылку…' : 'Пригласить члена семьи'}
            </button>
            {inviteLink && (
              <div className="warning-box" style={{ marginTop: 10, wordBreak: 'break-all' }}>
                Ссылка действует 24 часа, перешлите её тому, кого хотите добавить:
                <br />
                <a href={inviteLink} target="_blank" rel="noreferrer">{inviteLink}</a>
              </div>
            )}
          </div>
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
