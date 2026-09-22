const { dateOnly } = require('./date');

// Формы бэкапа, которые backup.service.js#restoreBackup умеет
// восстанавливать — проверяется ДО открытия транзакции (аудит надёжности,
// фаза 5): без этого явно битый файл всё равно занимал слот в небольшом
// пуле соединений Prisma на время transaction-таймаута (до 60 секунд),
// прежде чем упасть на первой же строке. Вынесено из adminController.js
// в отдельный модуль, чтобы покрыть тестами без поднятия Express (фаза 9).
const BACKUP_ARRAY_FIELDS = [
  'children',
  'users',
  'familyMembers',
  'levels',
  'trainers',
  'scheduleSlots',
  'sessions',
  'holidays',
  'closedDays',
  'monthlyPayments',
  'settlements',
  'sessionNotes',
];

function validateBackupShape(backup) {
  if (!backup || typeof backup !== 'object') return 'Файл не похож на бэкап (не JSON-объект)';
  if (backup.version !== 1) return 'Неизвестная версия формата бэкапа';
  if (!backup.family || typeof backup.family !== 'object') return 'В файле нет данных family';
  for (const field of BACKUP_ARRAY_FIELDS) {
    if (!Array.isArray(backup[field])) return `Поле "${field}" отсутствует или не является списком`;
  }
  return null;
}

// Парсит и проверяет строку YYYY-MM-DD, возвращая Date (dateOnly) или null.
// JS Date не бросает исключение на dateOnly(2026, 13, 40) — молча
// "перекатывает" месяц/день дальше, поэтому сверяем результат обратно со
// строкой, чтобы явно отклонить такой ввод (аудит надёжности, фаза 5).
function parseStrictDateOnly(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = dateOnly(y, m, d);
  if (parsed.toISOString().slice(0, 10) !== date) return null;
  return parsed;
}

module.exports = { BACKUP_ARRAY_FIELDS, validateBackupShape, parseStrictDateOnly };
