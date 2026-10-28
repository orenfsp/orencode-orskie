const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = path.join(os.tmpdir(), 'fsp-roles-' + process.pid + '.sqlite');
process.env.DB_PATH = dbPath;

const { initDb, db } = require('../db');
const {
  getUserRoles, getRoleDetails, addUserRole, hasRole, removeUserRole, primaryRole, syncLegacyRoles,
} = require('../db/roles');

initDb();

function createUser(login, legacyRoles, category) {
  const info = db.prepare(`
    INSERT INTO users (login, password_hash, fio, roles, category)
    VALUES (?, 'hash', 'Тестов Тест Тестович', ?, ?)
  `).run(login, legacyRoles || '', category || null);
  return info.lastInsertRowid;
}

test('роль добавляется и читается', () => {
  const userId = createUser('user_one', '');
  const roles = addUserRole(userId, 'athlete', { disciplines: [1, 2] });

  assert.deepStrictEqual(roles, ['athlete']);
  assert.deepStrictEqual(getUserRoles(userId), ['athlete']);
  assert.strictEqual(hasRole(userId, 'athlete'), true);
  assert.strictEqual(hasRole(userId, 'coach'), false);

  const details = getRoleDetails(userId);
  assert.strictEqual(details.length, 1);
  assert.strictEqual(details[0].title, 'Спортсмен');
  assert.strictEqual(details[0].disciplines, '1,2');

  const legacy = db.prepare('SELECT roles FROM users WHERE id = ?').get(userId);
  assert.strictEqual(legacy.roles, 'athlete');
});

test('несколько ролей у одного аккаунта', () => {
  const userId = createUser('user_two', '');
  addUserRole(userId, 'athlete', { disciplines: [1] });
  addUserRole(userId, 'coach', { experienceYears: 7, disciplines: [2] });
  addUserRole(userId, 'judge', { judgeCategory: 'первая' });

  assert.deepStrictEqual(getUserRoles(userId), ['athlete', 'coach', 'judge']);

  const details = getRoleDetails(userId);
  assert.strictEqual(details[1].experienceYears, 7);
  assert.strictEqual(details[2].judgeCategory, 'первая');

  const legacy = db.prepare('SELECT roles FROM users WHERE id = ?').get(userId);
  assert.strictEqual(legacy.roles, 'athlete,coach,judge');
  assert.strictEqual(primaryRole(userId), 'athlete');
});

test('повторная выдача роли не создает дубль', () => {
  const userId = createUser('user_three', '');
  addUserRole(userId, 'coach', { experienceYears: 3 });
  addUserRole(userId, 'coach', { experienceYears: 9 });

  assert.deepStrictEqual(getUserRoles(userId), ['coach']);
  assert.strictEqual(getRoleDetails(userId)[0].experienceYears, 3);
});

test('роль можно снять', () => {
  const userId = createUser('user_four', '');
  addUserRole(userId, 'athlete');
  addUserRole(userId, 'judge', { judgeCategory: 'вторая' });

  const left = removeUserRole(userId, 'judge');
  assert.deepStrictEqual(left, ['athlete']);
  assert.strictEqual(hasRole(userId, 'judge'), false);
});

test('старые роли из users.roles переносятся в user_roles', () => {
  const userId = createUser('user_legacy', 'athlete,judge', 'вторая');
  assert.deepStrictEqual(getUserRoles(userId), []);

  initDb();

  assert.deepStrictEqual(getUserRoles(userId), ['athlete', 'judge']);
  const judge = getRoleDetails(userId).find((item) => item.role === 'judge');
  assert.strictEqual(judge.judgeCategory, 'вторая');
});

test('служебная синхронизация ролей', () => {
  const userId = createUser('user_sync', '');
  addUserRole(userId, 'athlete');
  addUserRole(userId, 'federation');

  assert.deepStrictEqual(syncLegacyRoles(userId), ['athlete', 'federation']);
  const legacy = db.prepare('SELECT roles FROM users WHERE id = ?').get(userId);
  assert.strictEqual(legacy.roles, 'athlete,federation');
});

test.after(() => {
  db.close();
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach((file) => {
    try { fs.unlinkSync(file); } catch (error) { /* файла может не быть */ }
  });
});
