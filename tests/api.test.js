const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = path.join(os.tmpdir(), 'fsp-api-' + process.pid + '.sqlite');
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = 'api-test-secret';
process.env.NODE_ENV = 'test';

const { app } = require('../server');
const { db } = require('../db');

let server;
let base;
const suffix = String(process.pid).slice(-5);

const tokens = {};
const userIds = {};

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

after(() => {
  server.close();
  db.close();
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach((file) => {
    try { fs.unlinkSync(file); } catch (error) { /* файла может не быть */ }
  });
});

async function request(method, url, options) {
  const settings = options || {};
  const headers = {};
  if (settings.token) headers.Authorization = 'Bearer ' + settings.token;
  if (settings.role) headers['X-Role'] = settings.role;
  if (settings.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(base + url, {
    method,
    headers,
    body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
  });

  const type = response.headers.get('content-type') || '';
  let data = null;
  if (type.indexOf('application/json') !== -1) data = await response.json();
  return { status: response.status, data, type, response };
}

async function login(loginName, password) {
  const result = await request('POST', '/api/auth/login', {
    body: { login: loginName, password: password || '123' },
  });
  assert.strictEqual(result.status, 200, 'вход ' + loginName);
  return result.data;
}

function registration(overrides) {
  return {
    login: 'api_' + suffix + '_' + Math.random().toString(36).slice(2, 7),
    password: 'secret123',
    fio: 'Тестов Иван Петрович',
    consentPd: true,
    role: 'athlete',
    birthDate: '2000-05-15',
    municipality: 'Оренбург',
    startYear: 2015,
    disciplines: [1],
    ...overrides,
  };
}

test('health отвечает ok', async () => {
  const result = await request('GET', '/api/health');
  assert.strictEqual(result.status, 200);
});

test('вход демо-пользователей и роли из базы', async () => {
  const fed = await login('fed');
  tokens.fed = fed.token;
  assert.deepStrictEqual(fed.roles, ['federation']);

  const athlete = await login('athlete');
  tokens.seedAthlete = athlete.token;
  assert.deepStrictEqual(athlete.roles, ['athlete']);

  const both = await login('both');
  assert.deepStrictEqual(both.roles, ['athlete', 'coach']);
  assert.strictEqual(both.activeRole, 'athlete');
});

test('регистрация: ошибки возвращаются по полям', async () => {
  const result = await request('POST', '/api/auth/register', {
    body: registration({
      login: 'x',
      password: '123',
      fio: 'Ivan Petrov',
      email: 'bad@',
      phone: '123',
      birthDate: '2030-01-01',
      municipality: '1',
      disciplines: [],
    }),
  });

  assert.strictEqual(result.status, 400);
  assert.strictEqual(result.data.error.code, 'VALIDATION_ERROR');
  ['login', 'password', 'fio', 'email', 'phone', 'birthDate', 'municipality', 'disciplines']
    .forEach((field) => assert.ok(result.data.error.fields[field], 'нет ошибки поля ' + field));
});

test('регистрация: тренеру нужен стаж, судье категория', async () => {
  const coach = await request('POST', '/api/auth/register', {
    body: registration({ role: 'coach', birthDate: undefined, municipality: undefined, disciplines: [1] }),
  });
  assert.strictEqual(coach.status, 400);
  assert.ok(coach.data.error.fields.experienceYears);

  const judge = await request('POST', '/api/auth/register', {
    body: registration({ role: 'judge', birthDate: undefined, municipality: undefined, disciplines: undefined }),
  });
  assert.strictEqual(judge.status, 400);
  assert.ok(judge.data.error.fields.judgeCategory);
});

test('регистрация спортсмена: аккаунт и роль в user_roles', async () => {
  const loginName = 'api_' + suffix + '_ath';
  const result = await request('POST', '/api/auth/register', {
    body: registration({ login: loginName, email: 'api_ath@example.ru', phone: '+7 912 111-22-33' }),
  });

  assert.strictEqual(result.status, 201);
  assert.deepStrictEqual(result.data.roles, ['athlete']);
  assert.strictEqual(result.data.activeRole, 'athlete');
  assert.strictEqual(result.data.profile.fio, 'Тестов Иван Петрович');

  tokens.athlete = result.data.token;
  userIds.athlete = result.data.user.id;

  const row = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(userIds.athlete);
  assert.deepStrictEqual(row.map((item) => item.role), ['athlete']);

  const legacy = db.prepare('SELECT roles FROM users WHERE id = ?').get(userIds.athlete);
  assert.strictEqual(legacy.roles, 'athlete');

  const duplicate = await request('POST', '/api/auth/register', {
    body: registration({ login: loginName }),
  });
  assert.strictEqual(duplicate.status, 409);
});

test('добавление ролей: проверки и сохранение', async () => {
  const bad = await request('POST', '/api/auth/roles', {
    token: tokens.athlete,
    body: { role: 'coach', experienceYears: 99, disciplines: [1] },
  });
  assert.strictEqual(bad.status, 400);
  assert.ok(bad.data.error.fields.experienceYears);

  const coach = await request('POST', '/api/auth/roles', {
    token: tokens.athlete,
    body: { role: 'coach', experienceYears: 6, disciplines: [1, 2] },
  });
  assert.strictEqual(coach.status, 201);
  assert.deepStrictEqual(coach.data.roles, ['athlete', 'coach']);
  assert.strictEqual(coach.data.activeRole, 'coach');
  assert.strictEqual(coach.data.profile.id, userIds.athlete);

  const duplicate = await request('POST', '/api/auth/roles', {
    token: tokens.athlete,
    body: { role: 'coach', experienceYears: 6, disciplines: [1] },
  });
  assert.strictEqual(duplicate.status, 409);

  const judge = await request('POST', '/api/auth/roles', {
    token: tokens.athlete,
    body: { role: 'judge', judgeCategory: 'первая' },
  });
  assert.strictEqual(judge.status, 201);
  assert.deepStrictEqual(judge.data.roles, ['athlete', 'coach', 'judge']);

  const details = judge.data.roleDetails.find((item) => item.role === 'judge');
  assert.strictEqual(details.judgeCategory, 'первая');

  const coachDetails = judge.data.roleDetails.find((item) => item.role === 'coach');
  assert.strictEqual(coachDetails.experienceYears, 6);
});

test('права зависят от активной роли', async () => {
  const coach = await request('GET', '/api/ranks/my-athletes', { token: tokens.athlete, role: 'coach' });
  assert.strictEqual(coach.status, 200);
  assert.ok(Array.isArray(coach.data));

  const athlete = await request('GET', '/api/ranks/my', { token: tokens.athlete, role: 'athlete' });
  assert.strictEqual(athlete.status, 200);
  assert.ok('rankType' in athlete.data);

  const forbidden = await request('GET', '/api/ranks/my-athletes', { token: tokens.athlete, role: 'federation' });
  assert.strictEqual(forbidden.status, 403);

  const federation = await request('GET', '/api/auth/federation-requests', { token: tokens.athlete, role: 'coach' });
  assert.strictEqual(federation.status, 403);
});

test('профиль: валидация и сохранение', async () => {
  const profile = await request('GET', '/api/auth/profile', { token: tokens.athlete, role: 'athlete' });
  assert.strictEqual(profile.status, 200);
  assert.deepStrictEqual(profile.data.roles, ['athlete', 'coach', 'judge']);
  assert.deepStrictEqual(profile.data.disciplines, [1]);

  const bad = await request('PATCH', '/api/auth/profile', {
    token: tokens.athlete,
    role: 'athlete',
    body: { phone: '123', rusadaUrl: 'ftp://bad', municipality: '' },
  });
  assert.strictEqual(bad.status, 400);
  assert.ok(bad.data.error.fields.phone);
  assert.ok(bad.data.error.fields.rusadaUrl);
  assert.ok(bad.data.error.fields.municipality);

  const good = await request('PATCH', '/api/auth/profile', {
    token: tokens.athlete,
    role: 'athlete',
    body: {
      fio: 'Тестов Иван Петрович',
      phone: '+7 912 111-22-33',
      email: 'api_ath@example.ru',
      municipality: 'Оренбург',
      organizationId: 1,
      startYear: 2015,
      disciplines: [1, 2],
      rusadaDate: '2025-02-10',
      rusadaUrl: 'https://rusada.ru/education/online-course/',
    },
  });
  assert.strictEqual(good.status, 200);
  assert.strictEqual(good.data.rusadaUrl, 'https://rusada.ru/education/online-course/');
  assert.deepStrictEqual(good.data.disciplines, [1, 2]);
});

test('заявка на роль федерации: подача и одобрение', async () => {
  const loginName = 'api_' + suffix + '_fed';
  const register = await request('POST', '/api/auth/register', {
    body: registration({
      login: loginName,
      role: 'federation',
      birthDate: undefined,
      municipality: undefined,
      disciplines: undefined,
    }),
  });
  assert.strictEqual(register.status, 201);
  assert.strictEqual(register.data.pendingFederation, true);
  assert.deepStrictEqual(register.data.roles, []);

  const list = await request('GET', '/api/auth/federation-requests', { token: tokens.fed, role: 'federation' });
  assert.strictEqual(list.status, 200);
  const requestRow = list.data.find((item) => item.login === loginName);
  assert.ok(requestRow, 'заявка не появилась в списке');

  const approve = await request('POST', '/api/auth/federation-requests/' + requestRow.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(approve.status, 200);
  assert.ok(approve.data.roles.indexOf('federation') !== -1);

  const session = await login(loginName, 'secret123');
  assert.ok(session.roles.indexOf('federation') !== -1);
});

test('судейская категория: заявка и подтверждение', async () => {
  const requestResult = await request('POST', '/api/judges/category/request', {
    token: tokens.athlete,
    role: 'judge',
    body: { category: 'высшая' },
  });
  assert.strictEqual(requestResult.status, 201);

  const duplicate = await request('POST', '/api/judges/category/request', {
    token: tokens.athlete,
    role: 'judge',
    body: { category: 'высшая' },
  });
  assert.strictEqual(duplicate.status, 409);

  const list = await request('GET', '/api/judges/category/requests', { token: tokens.fed, role: 'federation' });
  const row = list.data.find((item) => item.judgeUserId === userIds.athlete);
  assert.ok(row);

  const approve = await request('POST', '/api/judges/category/requests/' + row.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
    body: { category: 'высшая', assignedUntil: '2029-01-01' },
  });
  assert.strictEqual(approve.status, 200);

  const my = await request('GET', '/api/judges/category/my', { token: tokens.athlete, role: 'judge' });
  assert.strictEqual(my.data.category, 'высшая');
  assert.strictEqual(my.data.categoryUntil, '2029-01-01');
});

test('соревнование, заявки, протокол и рейтинг', async () => {
  const invalid = await request('POST', '/api/competitions', {
    token: tokens.fed,
    role: 'federation',
    body: {
      name: 'X',
      disciplineId: 1,
      ageGroupId: 1,
      type: 'Чемпионат',
      level: 'Региональные',
      format: 'очный',
      dateStart: '2027-05-10',
      dateEnd: '2027-05-01',
      regulationUrl: 'ftp://bad',
    },
  });
  assert.strictEqual(invalid.status, 400);
  assert.ok(invalid.data.error.fields.dateEnd);
  assert.ok(invalid.data.error.fields.regulationUrl);
  assert.ok(invalid.data.error.fields.name);

  const created = await request('POST', '/api/competitions', {
    token: tokens.fed,
    role: 'federation',
    body: {
      name: 'Тестовый кубок ' + suffix,
      disciplineId: 1,
      ageGroupId: 3,
      type: 'Кубок',
      level: 'Региональные',
      format: 'смешанный',
      dateStart: '2027-05-10',
      dateEnd: '2027-05-11',
      applicationsDeadline: '2027-04-20',
      place: 'Оренбург',
      regulationUrl: 'https://example.ru/regulations/test.pdf',
    },
  });
  assert.strictEqual(created.status, 201);
  const competitionId = created.data.id;

  const publish = await request('POST', '/api/competitions/' + competitionId + '/publish', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(publish.status, 200);

  const second = await request('POST', '/api/auth/register', {
    body: registration({ login: 'api_' + suffix + '_ath2' }),
  });
  assert.strictEqual(second.status, 201);
  tokens.secondAthlete = second.data.token;
  userIds.secondAthlete = second.data.user.id;

  const applyFirst = await request('POST', '/api/applications', {
    token: tokens.athlete,
    role: 'athlete',
    body: { competitionId },
  });
  assert.strictEqual(applyFirst.status, 201);

  const applySecond = await request('POST', '/api/applications', {
    token: tokens.secondAthlete,
    role: 'athlete',
    body: { competitionId },
  });
  assert.strictEqual(applySecond.status, 201);

  const approveFirst = await request('POST', '/api/applications/' + applyFirst.data.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(approveFirst.status, 200);

  const approveSecond = await request('POST', '/api/applications/' + applySecond.data.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(approveSecond.status, 200);

  const earlyResult = await request('POST', '/api/results', {
    token: tokens.fed,
    role: 'federation',
    body: { competitionId, athleteUserId: userIds.athlete, place: 1 },
  });
  assert.strictEqual(earlyResult.status, 400);

  const close = await request('POST', '/api/competitions/' + competitionId + '/close-applications', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(close.status, 200);

  const badPlace = await request('POST', '/api/results', {
    token: tokens.fed,
    role: 'federation',
    body: { competitionId, athleteUserId: userIds.athlete, place: 0 },
  });
  assert.strictEqual(badPlace.status, 400);
  assert.ok(badPlace.data.error.fields.place);

  const firstResult = await request('POST', '/api/results', {
    token: tokens.fed,
    role: 'federation',
    body: { competitionId, athleteUserId: userIds.athlete, place: 1, points: 40 },
  });
  assert.strictEqual(firstResult.status, 201);

  const duplicatePlace = await request('POST', '/api/results', {
    token: tokens.fed,
    role: 'federation',
    body: { competitionId, athleteUserId: userIds.secondAthlete, place: 1 },
  });
  assert.strictEqual(duplicatePlace.status, 400);
  assert.ok(duplicatePlace.data.error.fields.place);

  const secondResult = await request('POST', '/api/results', {
    token: tokens.fed,
    role: 'federation',
    body: { competitionId, athleteUserId: userIds.secondAthlete, place: 2 },
  });
  assert.strictEqual(secondResult.status, 201);

  const protocol = await fetch(base + '/api/reports/protocol/' + competitionId, {
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
  });
  assert.strictEqual(protocol.status, 200);
  assert.match(protocol.headers.get('content-type'), /wordprocessingml/);
  const buffer = await protocol.arrayBuffer();
  assert.ok(buffer.byteLength > 5000);

  const rating = await request('GET', '/api/rating', { token: tokens.athlete, role: 'athlete' });
  assert.strictEqual(rating.status, 200);
  const place = rating.data.find((item) => item.athleteUserId === userIds.athlete);
  assert.ok(place, 'спортсмена нет в рейтинге');
  assert.strictEqual(place.total, 40);
  assert.strictEqual(place.stabilityCoefficient, 1);

  const history = await request('GET', '/api/results/athlete/' + userIds.athlete, {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.ok(history.data.some((item) => item.competitionId === competitionId && item.place === 1));

  const foreignHistory = await request('GET', '/api/results/athlete/' + userIds.secondAthlete, {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(foreignHistory.status, 400);
});

test('заявка на роль федерации: отклонение с причиной', async () => {
  const loginName = 'api_' + suffix + '_fed2';
  const register = await request('POST', '/api/auth/register', {
    body: registration({
      login: loginName,
      role: 'federation',
      birthDate: undefined,
      municipality: undefined,
      disciplines: undefined,
    }),
  });
  assert.strictEqual(register.status, 201);

  const list = await request('GET', '/api/auth/federation-requests', { token: tokens.fed, role: 'federation' });
  const row = list.data.find((item) => item.login === loginName);

  const emptyReason = await request('POST', '/api/auth/federation-requests/' + row.id + '/reject', {
    token: tokens.fed,
    role: 'federation',
    body: { reason: '' },
  });
  assert.strictEqual(emptyReason.status, 400);

  const reject = await request('POST', '/api/auth/federation-requests/' + row.id + '/reject', {
    token: tokens.fed,
    role: 'federation',
    body: { reason: 'Не подтверждены полномочия' },
  });
  assert.strictEqual(reject.status, 200);
});


test('разряды: проверка приказа и присвоение', async () => {
  const list = await request('GET', '/api/ranks/requests', { token: tokens.fed, role: 'federation' });
  assert.strictEqual(list.status, 200);
  const pending = list.data.find((item) => item.status === 'pending');
  assert.ok(pending, 'в демо-данных должна быть заявка на разряд');

  const invalid = await request('POST', '/api/ranks/' + pending.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
    body: { assignedDate: '2026-01-01', orderNumber: '', assignedUntil: '2025-01-01' },
  });
  assert.strictEqual(invalid.status, 400);
  assert.ok(invalid.data.error.fields.orderNumber);
  assert.ok(invalid.data.error.fields.assignedUntil);

  const approved = await request('POST', '/api/ranks/' + pending.id + '/approve', {
    token: tokens.fed,
    role: 'federation',
    body: { assignedDate: '2026-01-01', orderNumber: '15-од', assignedUntil: '2028-01-01' },
  });
  assert.strictEqual(approved.status, 200);

  const my = await request('GET', '/api/ranks/my', { token: tokens.seedAthlete, role: 'athlete' });
  assert.strictEqual(my.status, 200);
  assert.strictEqual(my.data.rankType, pending.requestedType);
  assert.strictEqual(my.data.rankUntil, '2028-01-01');
});

test('отчёты: реестр, справка спортсмена, приказ по сборной', async () => {
  const registry = await fetch(base + '/api/reports/registry', {
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
  });
  assert.strictEqual(registry.status, 200);
  assert.match(registry.headers.get('content-type'), /spreadsheetml/);
  assert.ok((await registry.arrayBuffer()).byteLength > 1000);

  const athleteReport = await fetch(base + '/api/reports/athlete/2', {
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
  });
  assert.strictEqual(athleteReport.status, 200);
  assert.match(athleteReport.headers.get('content-type'), /wordprocessingml/);
  assert.ok((await athleteReport.arrayBuffer()).byteLength > 1000);

  const team = await request('POST', '/api/rating/team/select', {
    token: tokens.fed,
    role: 'federation',
    body: { season: 2026, disciplineId: 1, athleteIds: [2] },
  });
  assert.strictEqual(team.status, 200);
  assert.strictEqual(team.data.count, 1);

  const order = await fetch(base + '/api/reports/team/2026/1', {
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
  });
  assert.strictEqual(order.status, 200);
  assert.ok((await order.arrayBuffer()).byteLength > 1000);
});


test('уведомления: список, счетчик и прочтение', async () => {
  const list = await request('GET', '/api/notifications', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(list.status, 200);
  assert.ok(Array.isArray(list.data));
  assert.ok(list.data.length > 0, 'после заявок должны быть уведомления');
  assert.ok(list.data.some((item) => item.type === 'application_created'));
  assert.ok(list.data.some((item) => item.type === 'application_approved'));

  const unread = await request('GET', '/api/notifications/unread-count', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(unread.status, 200);
  assert.ok(unread.data.count > 0);

  const first = list.data[0];
  const read = await request('POST', '/api/notifications/' + first.id + '/read', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(read.status, 200);

  const after = await request('GET', '/api/notifications/unread-count', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(after.data.count, unread.data.count - 1);

  const all = await request('POST', '/api/notifications/read-all', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(all.status, 200);

  const empty = await request('GET', '/api/notifications/unread-count', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(empty.data.count, 0);
});

test('уведомления: ручная проверка сроков доступна федерации', async () => {
  const forbidden = await request('POST', '/api/notifications/check-deadlines', {
    token: tokens.athlete,
    role: 'athlete',
  });
  assert.strictEqual(forbidden.status, 403);

  const result = await request('POST', '/api/notifications/check-deadlines', {
    token: tokens.fed,
    role: 'federation',
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.data.ok, true);
  assert.strictEqual(typeof result.data.deadlines, 'number');
});

test('положение соревнования: загрузка, выдача и проверка файла', async () => {
  const created = await request('POST', '/api/competitions', {
    token: tokens.fed,
    role: 'federation',
    body: {
      name: 'Соревнование с положением ' + suffix,
      disciplineId: 1,
      ageGroupId: 3,
      type: 'Кубок',
      level: 'Региональные',
      format: 'очный',
      dateStart: '2027-08-10',
      dateEnd: '2027-08-11',
      applicationsDeadline: '2027-07-20',
    },
  });
  assert.strictEqual(created.status, 201);
  const competitionId = created.data.id;

  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('text')], { type: 'text/plain' }), 'note.txt');
  const bad = await fetch(base + '/api/competitions/' + competitionId + '/regulation', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
    body: badForm,
  });
  assert.strictEqual(bad.status, 400);

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')], { type: 'application/pdf' }), 'regulation.pdf');

  const uploaded = await fetch(base + '/api/competitions/' + competitionId + '/regulation', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokens.fed, 'X-Role': 'federation' },
    body: form,
  });
  assert.strictEqual(uploaded.status, 200);
  const uploadData = await uploaded.json();
  assert.ok(uploadData.path);

  const detail = await request('GET', '/api/competitions/' + competitionId);
  assert.strictEqual(detail.data.regulationPath, uploadData.path);

  const download = await fetch(base + '/api/competitions/' + competitionId + '/regulation');
  assert.strictEqual(download.status, 200);
  assert.match(download.headers.get('content-type'), /pdf/);
  assert.ok((await download.arrayBuffer()).byteLength > 10);
});
