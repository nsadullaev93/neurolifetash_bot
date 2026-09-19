export default function Banner({ count, onClick }) {
  if (!count) return null;
  const word = count === 1 ? 'занятие не отмечено' : count < 5 ? 'занятия не отмечены' : 'занятий не отмечено';
  return (
    <button className="banner" onClick={onClick}>
      ⚠️ {count} {word} за прошлые дни
    </button>
  );
}
