/*
 * Проверка полей по регулярным выражениям.
 * Один модуль и для API, и для тестов. Фронтенд использует такие же правила
 * в public/js/validate.js, чтобы ошибки показывались до отправки формы.
 */

const ROLE_TITLES = {
  federation: 'Федерация',
  athlete: 'Спортсмен',
  coach: 'Тренер',
  judge: 'Судья',
};

const ROLE_ORDER = ['athlete', 'coach', 'judge', 'federation'];
const OPEN_ROLES = ['athlete', 'coach', 'judge'];
const JUDGE_CATEGORIES = ['третья', 'вторая', 'первая', 'высшая'];
const COMPETITION_LEVELS = ['Региональные', 'Межрегиональные', 'Всероссийские', 'ЕКП'];
const COMPETITION_FORMATS = ['очный', 'онлайн', 'смешанный'];

const PATTERNS = {
  // логин: латиница, цифры, подчеркивание, начинается с буквы
  login: /^[A-Za-z][A-Za-z0-9_]{2,19}$/,
  // пароль: от 6 до 40 символов, без пробелов
  password: /^\S{6,40}$/,
  // ФИО проверяется по словам, здесь только общий вид строки
  fio: /^[А-ЯЁа-яёA-Za-z -]{3,80}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  // российский телефон: +7 или 8, код из трех цифр, семь цифр номера
  phone: /^(\+7|8)[\s-]*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$/,
  municipality: /^[А-ЯЁа-яё][А-ЯЁа-яё\s.-]{1,39}$/,
  competitionName: /^[А-ЯЁа-яёA-Za-z0-9"][А-ЯЁа-яёA-Za-z0-9\s"().,/-]{2,119}$/,
  calendarPlan: /^[А-ЯЁа-яёA-Za-z0-9\s-]{2,40}$/,
  calendarNumber: /^[0-9A-Za-zА-Яа-яЁё/-]{1,20}$/,
  orderNumber: /^[0-9A-Za-zА-Яа-яЁё/-]{1,30}$/,
  placeText: /^[А-ЯЁа-яёA-Za-z0-9][А-ЯЁа-яёA-Za-z0-9\s.,-]{0,59}$/,
  year: /^(19[5-9]\d|20\d{2})$/,
  experience: /^\d{1,2}$/,
  place: /^[1-9]\d?$/,
  points: /^\d{1,4}$/,
  url: /^https?:\/\/[^\s]+$/,
  positiveInt: /^[1-9]\d{0,5}$/,
  reason: /^[\s\S]{3,300}$/,
};

const MESSAGES = {
  login: 'Логин: 3-20 символов, латиница, цифры и знак подчеркивания',
  password: 'Пароль: от 6 до 40 символов без пробелов',
  fio: 'ФИО: 2 или 3 слова, только буквы и дефис',
  email: 'E-mail: например name@mail.ru',
  phone: 'Телефон: +7 900 000-00-00',
  municipality: 'Муниципалитет: буквы, пробелы, точка и дефис',
  competitionName: 'Название: от 3 до 120 символов',
  calendarPlan: 'Календарный план: буквы, цифры и дефис',
  calendarNumber: 'Номер в плане: буквы, цифры, дефис или слэш',
  orderNumber: 'Номер приказа: буквы, цифры, дефис или слэш',
  placeText: 'Место: буквы, цифры, пробелы, точка, запятая и дефис',
  year: 'Год: четыре цифры',
  experience: 'Стаж: целое число от 0 до 60 лет',
  place: 'Место: целое число от 1 до 99',
  points: 'Баллы: целое число от 0 до 9999',
  url: 'Ссылка: адрес должен начинаться с http:// или https://',
  positiveInt: 'Укажите целое число больше нуля',
  reason: 'Причина: от 3 до 300 символов',
};

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function calcAge(birthDate, nowDate) {
  const birth = typeof birthDate === 'string' ? parseIsoDate(birthDate) : birthDate;
  if (!birth) return null;
  const now = nowDate || new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function isFio(value) {
  const parts = text(value).split(/\s+/);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((part) => /^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*$/.test(part) && part.length >= 2);
}

/* Подходит ли спортсмен по возрасту в группу соревнования. */
function isAgeInGroup(birthDate, ageFrom, ageTo) {
  if (!birthDate) return true;
  const age = calcAge(birthDate);
  if (age === null) return false;
  return age >= Number(ageFrom) && age <= Number(ageTo);
}

function checkLogin(value) {
  if (!text(value)) return 'Укажите логин';
  if (!PATTERNS.login.test(text(value))) return MESSAGES.login;
  return '';
}

function checkPassword(value) {
  if (!value) return 'Укажите пароль';
  if (!PATTERNS.password.test(String(value))) return MESSAGES.password;
  return '';
}

function checkFio(value, options) {
  const required = !options || options.required !== false;
  if (!text(value)) return required ? 'Укажите ФИО' : '';
  if (!isFio(value)) return MESSAGES.fio;
  return '';
}

function checkEmail(value, options) {
  const required = options && options.required;
  if (!text(value)) return required ? 'Укажите e-mail' : '';
  if (!PATTERNS.email.test(text(value))) return MESSAGES.email;
  if (text(value).length > 120) return 'E-mail: не длиннее 120 символов';
  return '';
}

function checkPhone(value, options) {
  const required = options && options.required;
  if (!text(value)) return required ? 'Укажите телефон' : '';
  if (!PATTERNS.phone.test(text(value))) return MESSAGES.phone;
  return '';
}

function checkBirthDate(value) {
  if (!text(value)) return 'Укажите дату рождения';
  const date = parseIsoDate(value);
  if (!date) return 'Дата рождения: некорректная дата';
  const now = new Date();
  if (date.getTime() > now.getTime()) return 'Дата рождения не может быть в будущем';
  const age = calcAge(date);
  if (age < 6 || age > 90) return 'Дата рождения: возраст от 6 до 90 лет';
  return '';
}

function checkStartYear(value, required) {
  if (!text(value)) return required ? 'Укажите год начала занятий' : '';
  if (!PATTERNS.year.test(text(value))) return MESSAGES.year;
  const year = Number(text(value));
  const current = new Date().getFullYear();
  if (year < 1950 || year > current) return 'Год начала занятий: от 1950 до ' + current;
  return '';
}

function checkExperience(value) {
  if (!text(value)) return 'Укажите стаж работы тренером';
  if (!PATTERNS.experience.test(text(value))) return MESSAGES.experience;
  const years = Number(text(value));
  if (years < 0 || years > 60) return MESSAGES.experience;
  return '';
}

function checkJudgeCategory(value) {
  if (!text(value)) return 'Выберите судейскую категорию';
  if (JUDGE_CATEGORIES.indexOf(text(value)) === -1) return 'Судейская категория: третья, вторая, первая или высшая';
  return '';
}

function checkUrl(value, options) {
  const required = options && options.required;
  if (!text(value)) return required ? 'Укажите ссылку' : '';
  if (!PATTERNS.url.test(text(value))) return MESSAGES.url;
  if (text(value).length > 300) return 'Ссылка: не длиннее 300 символов';
  try {
    const parsed = new URL(text(value));
    if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return MESSAGES.url;
  } catch (error) {
    return MESSAGES.url;
  }
  return '';
}

function checkPlace(value) {
  if (!text(value)) return 'Укажите место';
  if (!PATTERNS.place.test(text(value))) return MESSAGES.place;
  if (Number(text(value)) < 1 || Number(text(value)) > 99) return MESSAGES.place;
  return '';
}

function checkPoints(value) {
  if (!text(value)) return '';
  if (!PATTERNS.points.test(text(value))) return MESSAGES.points;
  if (Number(text(value)) > 9999) return MESSAGES.points;
  return '';
}

function checkPositiveInt(value, message) {
  if (!text(value)) return message || MESSAGES.positiveInt;
  if (!PATTERNS.positiveInt.test(text(value))) return message || MESSAGES.positiveInt;
  return '';
}

function checkReason(value) {
  if (!text(value)) return 'Укажите причину';
  if (!PATTERNS.reason.test(text(value))) return MESSAGES.reason;
  return '';
}

function checkDateRange(dateStart, dateEnd) {
  const start = parseIsoDate(dateStart);
  const end = parseIsoDate(dateEnd);
  if (!start) return 'Дата начала: некорректная дата';
  if (!end) return 'Дата окончания: некорректная дата';
  if (end.getTime() < start.getTime()) return 'Дата окончания не может быть раньше даты начала';
  return '';
}

function checkDeadline(deadline, dateStart) {
  if (!text(deadline)) return '';
  const value = parseIsoDate(deadline);
  if (!value) return 'Приём заявок: некорректная дата';
  const start = parseIsoDate(dateStart);
  if (start && value.getTime() > start.getTime()) return 'Приём заявок должен закрыться до начала соревнования';
  return '';
}

function checkDisciplines(value) {
  const list = Array.isArray(value) ? value : text(value) ? text(value).split(',') : [];
  const ids = list
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return 'Выберите хотя бы одну дисциплину';
  return '';
}

/* Проверка полей, общих для регистрации. */
function checkRegistration(body) {
  const fields = {};

  const login = checkLogin(body.login);
  if (login) fields.login = login;

  const password = checkPassword(body.password);
  if (password) fields.password = password;

  const fio = checkFio(body.fio);
  if (fio) fields.fio = fio;

  const email = checkEmail(body.email);
  if (email) fields.email = email;

  const phone = checkPhone(body.phone);
  if (phone) fields.phone = phone;

  if (!body.consentPd) fields.consentPd = 'Нужно согласие на обработку персональных данных';

  if (!body.role) fields.role = 'Выберите роль';
  else if (ROLE_ORDER.indexOf(body.role) === -1) fields.role = 'Недопустимая роль';

  return fields;
}

/* Обязательные поля конкретной роли. */
function checkRoleFields(role, body) {
  const fields = {};

  if (role === 'athlete') {
    const birthDate = checkBirthDate(body.birthDate);
    if (birthDate) fields.birthDate = birthDate;

    if (!text(body.municipality)) fields.municipality = 'Укажите муниципалитет';
    else if (!PATTERNS.municipality.test(text(body.municipality))) fields.municipality = MESSAGES.municipality;

    const startYear = checkStartYear(body.startYear, false);
    if (startYear) fields.startYear = startYear;

    const disciplines = checkDisciplines(body.disciplines);
    if (disciplines) fields.disciplines = disciplines;

    if (body.birthDate && calcAge(body.birthDate) !== null && calcAge(body.birthDate) < 18) {
      const representative = checkFio(body.legalRepresentative, { required: true });
      if (representative) fields.legalRepresentative = 'Для несовершеннолетнего укажите законного представителя';
    } else if (text(body.legalRepresentative)) {
      const representative = checkFio(body.legalRepresentative, { required: false });
      if (representative) fields.legalRepresentative = representative;
    }
  }

  if (role === 'coach') {
    const experience = checkExperience(body.experienceYears);
    if (experience) fields.experienceYears = experience;

    const disciplines = checkDisciplines(body.disciplines);
    if (disciplines) fields.disciplines = disciplines;
  }

  if (role === 'judge') {
    const category = checkJudgeCategory(body.judgeCategory);
    if (category) fields.judgeCategory = category;

    if (text(body.experienceYears)) {
      const experience = checkExperience(body.experienceYears);
      if (experience) fields.experienceYears = experience;
    }
  }

  return fields;
}

/* Проверка профиля при редактировании. */
function checkProfile(body, roles) {
  const fields = {};

  const fio = checkFio(body.fio);
  if (fio) fields.fio = fio;

  const email = checkEmail(body.email);
  if (email) fields.email = email;

  const phone = checkPhone(body.phone);
  if (phone) fields.phone = phone;

  if (text(body.municipality) && !PATTERNS.municipality.test(text(body.municipality))) {
    fields.municipality = MESSAGES.municipality;
  }

  const startYear = checkStartYear(body.startYear, false);
  if (startYear) fields.startYear = startYear;

  if (text(body.legalRepresentative)) {
    const representative = checkFio(body.legalRepresentative, { required: false });
    if (representative) fields.legalRepresentative = representative;
  }

  if (text(body.rusadaDate)) {
    const date = parseIsoDate(body.rusadaDate);
    if (!date) fields.rusadaDate = 'Дата курса РУСАДА: некорректная дата';
    else if (date.getTime() > Date.now()) fields.rusadaDate = 'Дата курса не может быть в будущем';
  }

  const rusadaUrl = checkUrl(body.rusadaUrl);
  if (rusadaUrl) fields.rusadaUrl = rusadaUrl;

  if (body.municipality !== undefined && roles && roles.indexOf('athlete') !== -1 && !text(body.municipality)) {
    fields.municipality = 'Укажите муниципалитет';
  }

  if (body.disciplines !== undefined) {
    const disciplines = checkDisciplines(body.disciplines);
    if (disciplines) fields.disciplines = disciplines;
  }

  return fields;
}

/* Проверка формы соревнования. */
function checkCompetition(body) {
  const fields = {};

  if (!text(body.name)) fields.name = 'Укажите название соревнования';
  else if (!PATTERNS.competitionName.test(text(body.name))) fields.name = MESSAGES.competitionName;

  const discipline = checkPositiveInt(body.disciplineId, 'Выберите дисциплину');
  if (discipline) fields.disciplineId = discipline;

  const ageGroup = checkPositiveInt(body.ageGroupId, 'Выберите возрастную группу');
  if (ageGroup) fields.ageGroupId = ageGroup;

  if (!text(body.type)) fields.type = 'Укажите тип соревнования';
  else if (text(body.type).length > 40) fields.type = 'Тип: не длиннее 40 символов';

  if (COMPETITION_LEVELS.indexOf(text(body.level)) === -1) fields.level = 'Выберите уровень соревнования';
  if (COMPETITION_FORMATS.indexOf(text(body.format)) === -1) fields.format = 'Выберите формат проведения';

  if (!text(body.dateStart)) fields.dateStart = 'Укажите дату начала';
  if (!text(body.dateEnd)) fields.dateEnd = 'Укажите дату окончания';
  if (!fields.dateStart && !fields.dateEnd) {
    const range = checkDateRange(body.dateStart, body.dateEnd);
    if (range) {
      if (range.indexOf('окончания') !== -1) fields.dateEnd = range;
      else fields.dateStart = range;
    }
  }

  const deadline = checkDeadline(body.applicationsDeadline, body.dateStart);
  if (deadline) fields.applicationsDeadline = deadline;

  if (text(body.place) && !PATTERNS.placeText.test(text(body.place))) fields.place = MESSAGES.placeText;

  if (text(body.calendarPlan) && !PATTERNS.calendarPlan.test(text(body.calendarPlan))) {
    fields.calendarPlan = MESSAGES.calendarPlan;
  }

  if (text(body.calendarNumber) && !PATTERNS.calendarNumber.test(text(body.calendarNumber))) {
    fields.calendarNumber = MESSAGES.calendarNumber;
  }

  const regulationUrl = checkUrl(body.regulationUrl);
  if (regulationUrl) fields.regulationUrl = regulationUrl;

  return fields;
}

/* Проверка результата соревнования. */
function checkResult(body) {
  const fields = {};

  const place = checkPlace(body.place);
  if (place) fields.place = place;

  const points = checkPoints(body.points);
  if (points) fields.points = points;

  return fields;
}

module.exports = {
  ROLE_TITLES,
  ROLE_ORDER,
  OPEN_ROLES,
  JUDGE_CATEGORIES,
  COMPETITION_LEVELS,
  COMPETITION_FORMATS,
  PATTERNS,
  MESSAGES,
  text,
  parseIsoDate,
  calcAge,
  isFio,
  isAgeInGroup,
  checkLogin,
  checkPassword,
  checkFio,
  checkEmail,
  checkPhone,
  checkBirthDate,
  checkStartYear,
  checkExperience,
  checkJudgeCategory,
  checkUrl,
  checkPlace,
  checkPoints,
  checkPositiveInt,
  checkReason,
  checkDisciplines,
  checkDateRange,
  checkRegistration,
  checkRoleFields,
  checkProfile,
  checkCompetition,
  checkResult,
};
