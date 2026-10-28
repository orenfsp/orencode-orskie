const test = require('node:test');
const assert = require('node:assert');

const {
  checkLogin, checkPassword, checkFio, checkEmail, checkPhone, checkBirthDate,
  checkStartYear, checkExperience, checkJudgeCategory, checkUrl, checkPlace,
  checkPoints, checkRegistration, checkRoleFields, checkCompetition, checkProfile,
  calcAge, isAgeInGroup,
} = require('../validation');

function isoYearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

test('логин: латиница, цифры и подчеркивание', () => {
  assert.strictEqual(checkLogin('ivanov_1'), '');
  assert.match(checkLogin('a1'), /Логин/);
  assert.match(checkLogin('иван'), /Логин/);
  assert.match(checkLogin('1ivan'), /Логин/);
  assert.match(checkLogin('iv an'), /Логин/);
});

test('пароль: от 6 до 40 символов без пробелов', () => {
  assert.strictEqual(checkPassword('secret123'), '');
  assert.match(checkPassword('12345'), /Пароль/);
  assert.match(checkPassword('with space'), /Пароль/);
  assert.match(checkPassword(''), /Укажите пароль/);
});

test('ФИО: 2-3 слова, кириллица, дефис', () => {
  assert.strictEqual(checkFio('Иванов Иван Иванович'), '');
  assert.strictEqual(checkFio('Петрова-Водкина Анна'), '');
  assert.strictEqual(checkFio('Иванов Иван'), '');
  assert.match(checkFio('Ivan Petrov'), /ФИО/);
  assert.match(checkFio('Иванов'), /ФИО/);
  assert.match(checkFio('Иванов Иван Иванович Петрович'), /ФИО/);
  assert.match(checkFio('Иванов И4'), /ФИО/);
});

test('e-mail: формат и длина', () => {
  assert.strictEqual(checkEmail('name@mail.ru'), '');
  assert.strictEqual(checkEmail(''), '');
  assert.match(checkEmail('bad@'), /E-mail/);
  assert.match(checkEmail('name@mail'), /E-mail/);
  assert.match(checkEmail('name mail@mail.ru'), /E-mail/);
});

test('телефон: российский формат', () => {
  assert.strictEqual(checkPhone('+7 900 000-00-00'), '');
  assert.strictEqual(checkPhone('8 (912) 345-67-89'), '');
  assert.strictEqual(checkPhone('8(912)3456789'), '');
  assert.strictEqual(checkPhone('+79123456789'), '');
  assert.match(checkPhone('12345'), /Телефон/);
  assert.match(checkPhone('+7 900 000 00 00 0'), /Телефон/);
  assert.match(checkPhone('+1 900 000-00-00'), /Телефон/);
});

test('дата рождения: реальная дата, не будущее, возраст 6-90', () => {
  assert.strictEqual(checkBirthDate('2000-05-15'), '');
  assert.match(checkBirthDate('2030-01-01'), /будущем/);
  assert.match(checkBirthDate('2001-02-30'), /некорректная/);
  assert.match(checkBirthDate(isoYearsAgo(3)), /6 до 90/);
  assert.match(checkBirthDate(''), /Укажите/);
});

test('год начала занятий: 1950 - текущий', () => {
  assert.strictEqual(checkStartYear('2015'), '');
  assert.match(checkStartYear('2050'), /1950/);
  assert.match(checkStartYear('20'), /четыре цифры/);
  assert.strictEqual(checkStartYear(''), '');
  assert.match(checkStartYear('', true), /Укажите/);
});

test('стаж и судейская категория', () => {
  assert.strictEqual(checkExperience('5'), '');
  assert.strictEqual(checkExperience('0'), '');
  assert.match(checkExperience('61'), /Стаж/);
  assert.match(checkExperience('abc'), /Стаж/);
  assert.strictEqual(checkJudgeCategory('первая'), '');
  assert.match(checkJudgeCategory('пятая'), /категория/);
  assert.match(checkJudgeCategory(''), /категорию/);
});

test('ссылки: http и https, корректный домен', () => {
  assert.strictEqual(checkUrl('https://fsp56.ru/regulations/2027.pdf'), '');
  assert.strictEqual(checkUrl('http://example.ru'), '');
  assert.match(checkUrl('ftp://example.ru'), /Ссылка/);
  assert.match(checkUrl('https://'), /Ссылка/);
  assert.match(checkUrl('https://localhost'), /Ссылка/);
  assert.strictEqual(checkUrl(''), '');
});

test('числовые поля: место, баллы', () => {
  assert.strictEqual(checkPlace('1'), '');
  assert.strictEqual(checkPlace('99'), '');
  assert.match(checkPlace('0'), /Место/);
  assert.match(checkPlace('100'), /Место/);
  assert.strictEqual(checkPoints(''), '');
  assert.strictEqual(checkPoints('9999'), '');
  assert.match(checkPoints('10000'), /Баллы/);
  assert.match(checkPoints('-1'), /Баллы/);
});

test('регистрация: обязательные поля и согласие', () => {
  const base = {
    login: 'ivanov', password: 'secret123', fio: 'Иванов Иван Иванович',
    role: 'athlete', consentPd: true, birthDate: '2000-01-01',
    municipality: 'Оренбург', disciplines: [1],
  };

  assert.deepStrictEqual(checkRegistration(base), {});
  assert.strictEqual(typeof checkRegistration({ ...base, consentPd: false }).consentPd, 'string');
  assert.strictEqual(typeof checkRegistration({ ...base, login: '' }).login, 'string');
  assert.strictEqual(typeof checkRegistration({ ...base, role: 'admin' }).role, 'string');
});

test('роль тренера: нужен стаж и дисциплина', () => {
  const fields = checkRoleFields('coach', {});
  assert.ok(fields.experienceYears);
  assert.ok(fields.disciplines);

  const ok = checkRoleFields('coach', { experienceYears: 5, disciplines: [1] });
  assert.deepStrictEqual(ok, {});
});

test('роль судьи: нужна категория', () => {
  assert.ok(checkRoleFields('judge', {}).judgeCategory);
  assert.deepStrictEqual(checkRoleFields('judge', { judgeCategory: 'вторая' }), {});
});

test('роль спортсмена: несовершеннолетний без представителя', () => {
  const data = {
    birthDate: isoYearsAgo(15),
    municipality: 'Оренбург',
    disciplines: [1],
  };
  assert.ok(checkRoleFields('athlete', data).legalRepresentative);

  const ok = checkRoleFields('athlete', { ...data, legalRepresentative: 'Петрова Анна Ивановна' });
  assert.deepStrictEqual(ok, {});
});

test('соревнование: даты, ссылка, название', () => {
  const base = {
    name: 'Кубок области 2027', disciplineId: 1, ageGroupId: 1,
    type: 'Кубок', level: 'Региональные', format: 'очный',
    dateStart: '2027-05-10', dateEnd: '2027-05-11',
    applicationsDeadline: '2027-04-20',
  };

  assert.deepStrictEqual(checkCompetition(base), {});
  assert.ok(checkCompetition({ ...base, dateEnd: '2027-05-01' }).dateEnd);
  assert.ok(checkCompetition({ ...base, applicationsDeadline: '2027-06-01' }).applicationsDeadline);
  assert.ok(checkCompetition({ ...base, regulationUrl: 'ftp://bad' }).regulationUrl);
  assert.ok(checkCompetition({ ...base, name: 'X' }).name);
  assert.ok(checkCompetition({ ...base, level: 'Мировой' }).level);
});

test('профиль: телефон, РУСАДА, муниципалитет', () => {
  const base = {
    fio: 'Иванов Иван Иванович',
    email: 'ivanov@example.ru',
    phone: '+7 900 000-00-00',
    municipality: 'Оренбург',
    rusadaDate: '2025-02-10',
    rusadaUrl: 'https://rusada.ru/education/',
  };

  assert.deepStrictEqual(checkProfile(base, ['athlete']), {});
  assert.ok(checkProfile({ ...base, phone: '123' }, ['athlete']).phone);
  assert.ok(checkProfile({ ...base, rusadaUrl: 'bad' }, ['athlete']).rusadaUrl);
  assert.ok(checkProfile({ ...base, municipality: '' }, ['athlete']).municipality);
});

test('возраст: расчет и группа соревнования', () => {
  assert.strictEqual(calcAge(isoYearsAgo(20)), 20);
  assert.strictEqual(calcAge(isoYearsAgo(15)), 15);
  assert.strictEqual(isAgeInGroup(isoYearsAgo(15), 14, 17), true);
  assert.strictEqual(isAgeInGroup(isoYearsAgo(13), 14, 17), false);
  assert.strictEqual(isAgeInGroup(null, 14, 17), true);
});
