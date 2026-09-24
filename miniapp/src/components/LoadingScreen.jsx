// Экран ожидания (первая загрузка вкладки, Suspense fallback для
// ленивых экранов) — иконка + вращающийся индикатор вместо голого текста
// «Загрузка…», по просьбе пользователя (пример — сплэш другого бота с
// картинкой и кругом загрузки).
export default function LoadingScreen() {
  return (
    <div className="center-loading">
      <span className="loading-icon">📋</span>
      <span className="spinner" />
    </div>
  );
}
