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

module.exports = { isPausedOn };
