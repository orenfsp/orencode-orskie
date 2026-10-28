/*
 * Уведомления: запись в базу и во внешний канал.
 * В демо-версии внешний канал - файл logs/emails.log (имитация письма).
 * В продакшене здесь подключается почтовый сервис или бот, интерфейс notify не меняется.
 */

const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'emails.log');

function ensureLogFile() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function emailOf(userId) {
  const user = db.prepare('SELECT email, fio FROM users WHERE id = ?').get(userId);
  if (!user) return { email: '(нет пользователя)', fio: '' };
  return { email: user.email || '(нет email)', fio: user.fio || '' };
}

function writeExternalLog(userId, type, text) {
  ensureLogFile();
  const user = emailOf(userId);
  const line = '[' + new Date().toISOString() + '] to=' + user.email +
    ' user=' + userId + ' type=' + type + ' | ' + text + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

/*
 * Создает уведомление. Одинаковые уведомления за день не дублируются:
 * cron может запускаться несколько раз, а пользователь не должен получать спам.
 */
function notify(userId, type, text) {
  if (!userId || !text) return null;

  const existing = db.prepare(`
    SELECT id FROM notifications
    WHERE user_id = ? AND type = ? AND text = ? AND date(created_at) = date('now')
  `).get(userId, type, text);

  if (existing) return existing.id;

  const info = db.prepare('INSERT INTO notifications (user_id, type, text) VALUES (?, ?, ?)')
    .run(userId, type, text);

  try {
    writeExternalLog(userId, type, text);
  } catch (error) {
    /* Лог не должен ломать основной сценарий, если файл занят или нет прав. */
    console.error('[notify] не удалось записать внешний лог:', error.message);
  }

  return info.lastInsertRowid;
}

/* Уведомляет всех пользователей с указанной ролью. */
function notifyRole(role, type, text) {
  const users = db.prepare(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = ?
  `).all(role);

  return users.map((user) => notify(user.id, type, text));
}

function notifyFederation(type, text) {
  return notifyRole('federation', type, text);
}

function unreadCount(userId) {
  return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId).c;
}

module.exports = { notify, notifyRole, notifyFederation, unreadCount };
