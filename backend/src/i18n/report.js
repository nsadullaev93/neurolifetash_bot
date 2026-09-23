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
// Китайский месяц — просто "N月" (цифра + иероглиф), а не название словом:
// это и естественная разговорная форма, и не требует добавлять в шрифт
// китайские иероглифы-числительные ради одной этой надписи.
const MONTHS_ZH = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

function monthNameFor(lang, month) {
  if (lang === 'uz') return MONTHS_UZ[month - 1];
  if (lang === 'zh') return MONTHS_ZH[month - 1];
  return MONTHS_RU[month - 1];
}

// Дата в родительном падеже для "Дата формирования: 21 сентября 2026" —
// узбекский не склоняется, поэтому используем тот же список месяцев.
// Китайский формат — свой порядок (год-месяц-день, "2026年9月21日").
function formatDateFor(lang, d) {
  const day = d.getUTCDate ? d.getUTCDate() : d.getDate();
  const month = (d.getUTCMonth ? d.getUTCMonth() : d.getMonth()) + 1;
  const year = d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear();
  if (lang === 'zh') return `${year}年${month}月${day}日`;
  const monthLabel = lang === 'uz' ? MONTHS_UZ[month - 1] : MONTHS_RU_GEN[month - 1];
  return `${day} ${monthLabel} ${year}`;
}

// "Месяц год" в шапке акта сверки (pdfReport.service.js) — единственное
// место, где порядок слов различается по языку (китайский — год впереди).
function monthYearLabel(lang, month, year) {
  if (lang === 'zh') return `${year}年${MONTHS_ZH[month - 1]}`;
  const monthLabel = monthNameFor(lang, month);
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`;
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
    spentOnConducted: 'Потрачено на проведённые занятия',
    sessionsUnit: 'занятий',
    discountApplied: 'Применена скидка 10% (более 20 занятий в месяц)',
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
    spentOnConducted: "O'tkazilgan mashg'ulotlarga sarflandi",
    sessionsUnit: "mashg'ulot",
    discountApplied: "10% chegirma qo'llanildi (oyiga 20 dan ortiq mashg'ulot)",
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
  // Упрощённый китайский. Валюта остаётся суммой в сумах (семья платит в
  // сумах, не юанях) — "苏姆" это транслитерация "сум", принятая в
  // китайских финансовых текстах про Узбекистан, а не перевод валюты.
  // Круглые скобки и слэш — обычные ASCII-символы, не полноширинные: так
  // это соответствует стилю остальных языков (сравните ru/uz) и не
  // расширяет набор символов, которые нужно вырезать в шрифт (assets/fonts,
  // см. pdfBase.js).
  zh: {
    reportTitle: '课时核对单',
    diaryTitle: '课时日记',
    generatedAt: '生成日期',
    child: '孩子',
    trainer: '专家',
    level: '级别',
    rate: '每节课费用',
    plan: '计划',
    paid: '已付款',
    conducted: '已完成',
    centerConducted: '中心记录',
    notConducted: '未完成',
    balance: '余额',
    overpayment: '多付',
    surcharge: '补付',
    status: '状态',
    missedByReasonTitle: '未完成课时原因统计',
    dailyDetailTitle: '每日课时明细',
    date: '日期',
    time: '时间',
    note: '备注',
    total: '总计',
    parent: '家长',
    centerAdmin: '中心管理员',
    signature: '签名',
    sum: '苏姆',
    spentOnConducted: '已完成课时花费',
    sessionsUnit: '节',
    discountApplied: '已享受9折优惠(每月超过20节)',
    reasons: {
      TRAINER_ABSENT: '专家缺席',
      CHILD_SICK_CERT: '孩子生病(有证明)',
      CHILD_SICK_NO_CERT: '孩子生病(无证明)',
      CHILD_ABSENT: '孩子缺席',
      CLOSED_DAY: '假日/中心休息',
      RESCHEDULED: '已改期',
    },
    statusLabels: {
      PLANNED: '已计划',
      COMPLETED: '已完成',
      MAKEUP: '补课',
      TRAINER_ABSENT: '专家缺席',
      CHILD_SICK_CERT: '孩子生病(有证明)',
      CHILD_SICK_NO_CERT: '孩子生病(无证明)',
      CHILD_ABSENT: '孩子缺席',
      CLOSED_DAY: '假日/中心休息',
      RESCHEDULED: '已改期',
    },
  },
};

function t(lang) {
  return dict[lang] || dict.ru;
}

const LANGS = Object.keys(dict);

module.exports = { t, monthNameFor, formatDateFor, monthYearLabel, LANGS };
