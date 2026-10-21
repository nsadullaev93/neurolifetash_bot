'use strict';

// Чистая логика "попадает ли дата в одну из пауз специалиста" — вынесена
// отдельно от forecast.service.js, чтобы покрыть тестом без БД (аналогично
// parseStrictDateOnly в validation.js).
function isPausedOn(dateOnlyValue, pauses) {
  const t = new Date(dateOnlyValue).getTime();
  return pauses.some((p) => {
    const from = new Date(p.fromDate).getTime();
    const to = p.toDate ? new Date(p.toDate).getTime() : Infinity;
    return t >= from && t <= to;
  });
}

// Дата раньше Trainer.startDate (специалист ещё не начал работать —
// например, замена с середины месяца). Без startDate — работает всегда.
function isBeforeStart(dateOnlyValue, trainer) {
  if (!trainer || !trainer.startDate) return false;
  return new Date(dateOnlyValue).getTime() < new Date(trainer.startDate).getTime();
}

module.exports = { isPausedOn, isBeforeStart };
