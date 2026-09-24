// Оригинальная простая иконка кота-маскота для экрана ожидания — не
// копирует ничей персонаж, просто дружелюбная плоская мордочка.
export default function CatIcon({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10 L24 26 L10 26 Z" fill="#F4A259" stroke="#C97A3D" strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 10 L54 26 L40 26 Z" fill="#F4A259" stroke="#C97A3D" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="34" r="22" fill="#F7B571" stroke="#C97A3D" strokeWidth="2" />
      <circle cx="23" cy="31" r="5.5" fill="#fff" stroke="#C97A3D" strokeWidth="1.5" />
      <circle cx="41" cy="31" r="5.5" fill="#fff" stroke="#C97A3D" strokeWidth="1.5" />
      <circle cx="24" cy="32" r="2.2" fill="#3A2A1A" />
      <circle cx="40" cy="32" r="2.2" fill="#3A2A1A" />
      <ellipse cx="32" cy="40" rx="2.6" ry="2" fill="#3A2A1A" />
      <path d="M32 42 Q32 46 28 47 M32 42 Q32 46 36 47" stroke="#3A2A1A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M9 34 L18 33 M9 40 L18 37" stroke="#C97A3D" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M55 34 L46 33 M55 40 L46 37" stroke="#C97A3D" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
