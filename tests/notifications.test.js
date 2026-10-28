const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = path.join(os.tmpdir(), 'fsp-notify-' + process.pid + '.sqlite');
process.env.DB_PATH = dbPath;

const { initDb, db } = require('../db');
const { notify, notifyRole, notifyFederation, unreadCount } = require('../notifications');

initDb();

function createUser(login, email) {
  const info = db.prepare(`
    INSERT INTO users (login, password_hash, fio, roles, email)
    VALUES (?, 'hash', 'Тестов Тест Тестович', '', ?)
  `).run(login, email || null);
  return info.lastInsertRowid;
}

test('уведомление сохраняется и увеличивает счетчик', () => {
  const userId = createUser('notify_one', 'notify@example.ru');

  assert.strictEqual(unreadCount(userId), 0);
  const id = notify(userId, 'application_created', 'Заявка подана');

  assert.ok(id);
  assert.strictEqual(unreadCount(userId), 1);

  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  assert.strictEqual(row.type, 'application_created');
  assert.strictEqual(row.text, 'Заявка подана');
});

test('одинаковые уведомления за день не дублируются', () => {
  const userId = createUser('notify_two');
  const first = notify(userId, 'deadline_soon', 'До дедлайна 3 дня');
  const second = notify(userId, 'deadline_soon', 'До дедлайна 3 дня');

  assert.strictEqual(first, second);
  const count = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?').get(userId).c;
  assert.strictEqual(count, 1);
});

test('уведомление роли уходит всем пользователям с этой ролью', () => {
  const first = createUser('notify_fed1');
  const second = createUser('notify_fed2');
  db.prepare("INSERT INTO roles (code, title) VALUES ('federation', 'Федерация') ON CONFLICT(code) DO NOTHING").run();
  db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, 'federation')").run(first);
  db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, 'federation')").run(second);

  const ids = notifyFederation('test_role', 'Сообщение федерации');

  assert.strictEqual(ids.length, 2);
  assert.strictEqual(unreadCount(first), 1);
  assert.strictEqual(unreadCount(second), 1);
});

test('notifyRole не падает без пользователей роли', () => {
  const ids = notifyRole('judge', 'test_empty_role', 'Никому');
  assert.deepStrictEqual(ids, []);
});

test('внешний канал пишет письмо в лог', () => {
  const userId = createUser('notify_log', 'log@example.ru');
  notify(userId, 'test_log', 'Проверка внешнего канала');

  const logPath = path.join(__dirname, '..', 'logs', 'emails.log');
  assert.strictEqual(fs.existsSync(logPath), true);

  const content = fs.readFileSync(logPath, 'utf8');
  assert.match(content, /to=log@example\.ru/);
  assert.match(content, /Проверка внешнего канала/);
});

test.after(() => {
  db.close();
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach((file) => {
    try { fs.unlinkSync(file); } catch (error) { /* файла может не быть */ }
  });
});
