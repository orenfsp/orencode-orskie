/*
 * Работа с ролями пользователя.
 * Роли хранятся в таблице user_roles (связь многие-ко-многим), в users.roles
 * остается строка-кэш для старых запросов и совместимости с прежней базой.
 */

const { db } = require('./index');

const ROLE_TITLES = {
  athlete: 'Спортсмен',
  coach: 'Тренер',
  judge: 'Судья',
  federation: 'Федерация',
};

const ROLE_ORDER = ['athlete', 'coach', 'judge', 'federation'];

function getUserRoles(userId) {
  const rows = db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY id').all(userId);
  return rows.map((row) => row.role);
}

function getRoleDetails(userId) {
  const rows = db.prepare(`
    SELECT ur.role, ur.experience_years, ur.judge_category, ur.disciplines, ur.created_at
    FROM user_roles ur
    WHERE ur.user_id = ?
    ORDER BY ur.id
  `).all(userId);

  return rows.map((row) => ({
    role: row.role,
    title: ROLE_TITLES[row.role] || row.role,
    experienceYears: row.experience_years,
    judgeCategory: row.judge_category,
    disciplines: row.disciplines,
    createdAt: row.created_at,
  }));
}

function hasRole(userId, role) {
  return !!db.prepare('SELECT id FROM user_roles WHERE user_id = ? AND role = ?').get(userId, role);
}

function syncLegacyRoles(userId) {
  const roles = getUserRoles(userId);
  db.prepare('UPDATE users SET roles = ? WHERE id = ?').run(roles.join(','), userId);
  return roles;
}

/*
 * Добавляет роль. Повторная выдача роли не создает дубль.
 * experienceYears нужен тренеру, judgeCategory - судье.
 */
function addUserRole(userId, role, extra) {
  const options = extra || {};
  const disciplines = Array.isArray(options.disciplines)
    ? options.disciplines.join(',')
    : options.disciplines || null;

  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role, experience_years, judge_category, disciplines)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    userId,
    role,
    options.experienceYears === undefined ? null : options.experienceYears,
    options.judgeCategory || null,
    disciplines
  );

  return syncLegacyRoles(userId);
}

function removeUserRole(userId, role) {
  db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').run(userId, role);
  return syncLegacyRoles(userId);
}

/* Первая роль считается основной: её видит пользователь после входа. */
function primaryRole(userId) {
  const roles = getUserRoles(userId);
  return roles[0] || null;
}

function isKnownRole(role) {
  return ROLE_ORDER.indexOf(role) !== -1;
}

module.exports = {
  ROLE_TITLES,
  ROLE_ORDER,
  getUserRoles,
  getRoleDetails,
  hasRole,
  addUserRole,
  removeUserRole,
  primaryRole,
  syncLegacyRoles,
  isKnownRole,
};
