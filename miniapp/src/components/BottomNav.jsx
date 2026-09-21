const TABS = [
  { id: 'today', label: 'Сегодня', icon: '📋' },
  { id: 'calendar', label: 'Календарь', icon: '📅' },
  { id: 'payments', label: 'Оплаты', icon: '💳', moneyOnly: true },
  { id: 'report', label: 'Отчёт', icon: '📊' },
  { id: 'more', label: 'Ещё', icon: '⚙️' },
];

export default function BottomNav({ active, onChange, canSeeMoney }) {
  const tabs = TABS.filter((t) => !t.moneyOnly || canSeeMoney);
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
