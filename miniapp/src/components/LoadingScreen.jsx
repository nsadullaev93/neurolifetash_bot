import CatIcon from './CatIcon';

// Экран ожидания (первая загрузка вкладки, Suspense fallback для
// ленивых экранов) — иконка + вращающийся индикатор вместо голого текста
// «Загрузка…», по просьбе пользователя (пример — сплэш другого бота с
// картинкой и кругом загрузки). Иконка — свой оригинальный рисунок кота
// (не персонаж мультфильма), см. CatIcon.jsx.
export default function LoadingScreen() {
  return (
    <div className="center-loading">
      <CatIcon />
      <span className="spinner" />
    </div>
  );
}
