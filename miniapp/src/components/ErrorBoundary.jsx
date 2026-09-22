import { Component } from 'react';

// Верхнеуровневый ErrorBoundary (аудит надёжности, фаза 8) — без него любая
// ошибка рендера в ЛЮБОМ из экранов (сейчас их 8: 5 вкладок + 3 под-вкладки
// «Отчёта») гасила всё приложение белым экраном без единого слова, что
// случилось и что делать. Ловит только ошибки рендера/жизненного цикла
// React — сетевые ошибки (Failed to fetch) экраны уже показывают сами.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Необработанная ошибка рендера:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="screen" style={{ paddingTop: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Что-то пошло не так</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Экран не смог открыться. Попробуйте обновить приложение.
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
