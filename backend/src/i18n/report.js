'use strict';

// Тексты PDF-отчёта на русском и узбекском (латиница) — ТЗ v2, §2.11.
// Термины из глоссария ТЗ используются дословно; остальные подписи
// (структура отчёта, не заданная явно в ТЗ) — по тому же принципу.
const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

function monthNameFor(lang, month) {
  return (lang === 'uz' ? MONTHS_UZ : MONTHS_RU)[month - 1];
}

// Дата в родительном падеже для "Дата формирования: 21 сентября 2026" —
// узбекский не склоняется, поэтому используем тот же список месяцев.
function formatDateFor(lang, d) {
  const day = d.getUTCDate ? d.getUTCDate() : d.getDate();
  const month = (d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1;
  const year = d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear();
  const monthLabel = lang === 'uz' ? MONTHS_UZ[month - 1] : MONTHS_RU_GEN[month - 1];
  return `${day} ${monthLabel} ${year}`;
}

const dict = {
  ru: {
    reportTitle: 'Акт сверки занятий',
    diaryTitle: 'Дневник занятий',
    generatedAt: 'Дата формирования',
    child: 'Ребёнок',
    trainer: 'Специалист',
    level: 'Уровень',
    rate: 'Ставка за занятие',
    plan: 'План',
    paid: 'Оплачено',
    conducted: 'Проведено',
    centerConducted: 'По данным центра',
    notConducted: 'Не проведено',
    balance: 'Баланс',
    overpayment: 'Переплата',
    surcharge: 'Доплата',
    status: 'Статус',
    missedByReasonTitle: 'Разбивка непроведённых занятий по причинам',
    dailyDetailTitle: 'Занятия по дням',
    date: 'Дата',
    time: 'Время',
    note: 'Примечание',
    total: 'Итого',
    parent: 'Родитель',
    centerAdmin: 'Администратор центра',
    signature: 'Подпись',
    sum: 'сум',
    reasons: {
      TRAINER_ABSENT: 'Специалист отсутствовал',
      CHILD_SICK_CERT: 'Болезнь ребёнка (справка есть)',
      CHILD_SICK_NO_CERT: 'Болезнь ребёнка (справки нет)',
      CHILD_ABSENT: 'Ребёнок отсутствовал',
      CLOSED_DAY: 'Праздник / центр закрыт',
      RESCHEDULED: 'Перенесено',
    },
    statusLabels: {
      PLANNED: 'Запланировано',
      COMPLETED: 'Проведено',
      MAKEUP: 'Отработка',
      TRAINER_ABSENT: 'Специалист отсутствовал',
      CHILD_SICK_CERT: 'Болезнь ребёнка (справка есть)',
      CHILD_SICK_NO_CERT: 'Болезнь ребёнка (справки нет)',
      CHILD_ABSENT: 'Ребёнок отсутствовал',
      CLOSED_DAY: 'Праздник / центр закрыт',
      RESCHEDULED: 'Перенесено',
    },
  },
  uz: {
    reportTitle: "Mashg'ulotlar bo'yicha solishtirma dalolatnoma",
    diaryTitle: "Mashg'ulotlar kundaligi",
    generatedAt: 'Tuzilgan sana',
    child: 'Bola',
    trainer: 'Mutaxassis',
    level: 'Daraja',
    rate: "Bir mashg'ulot narxi",
    plan: 'Reja',
    paid: "To'langan",
    conducted: "O'tkazilgan",
    centerConducted: "Markaz ma'lumotlari bo'yicha",
    notConducted: "O'tkazilmagan",
    balance: 'Qoldiq',
    overpayment: "Ortiqcha to'lov",
    surcharge: "Qo'shimcha to'lov",
    status: 'Holat',
    missedByReasonTitle: "O'tkazilmagan mashg'ulotlar sabablari bo'yicha",
    dailyDetailTitle: "Kunlar bo'yicha mashg'ulotlar",
    date: 'Sana',
    time: 'Vaqt',
    note: 'Izoh',
    total: 'Jami',
    parent: 'Ota-ona',
    centerAdmin: "Markaz ma'muri",
    signature: 'Imzo',
    sum: "so'm",
    reasons: {
      TRAINER_ABSENT: 'Mutaxassis kelmagan',
      CHILD_SICK_CERT: 'Bolaning kasalligi (spravka bor)',
      CHILD_SICK_NO_CERT: 'Bolaning kasalligi (spravka yoʻq)',
      CHILD_ABSENT: 'Bola kelmagan',
      CLOSED_DAY: 'Bayram / markaz yopiq',
      RESCHEDULED: "Ko'chirilgan",
    },
    statusLabels: {
      PLANNED: 'Rejalashtirilgan',
      COMPLETED: "O'tkazilgan",
      MAKEUP: "Qayta o'tkazilgan",
      TRAINER_ABSENT: 'Mutaxassis kelmagan',
      CHILD_SICK_CERT: 'Bolaning kasalligi (spravka bor)',
      CHILD_SICK_NO_CERT: 'Bolaning kasalligi (spravka yoʻq)',
      CHILD_ABSENT: 'Bola kelmagan',
      CLOSED_DAY: 'Bayram / markaz yopiq',
      RESCHEDULED: "Ko'chirilgan",
    },
  },
};

function t(lang) {
  return dict[lang] || dict.ru;
}

module.exports = { t, monthNameFor, formatDateFor };
