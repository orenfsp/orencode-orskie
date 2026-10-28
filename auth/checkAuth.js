const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { getUserRoles } = require('../db/roles');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'требуется авторизация' } });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'токен недействителен' } });
  }

  const user = db.prepare('SELECT id, fio, login, roles FROM users WHERE id = ?').get(payload.sub);
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'пользователь не найден' } });
  }

  const roles = getUserRoles(user.id);
  const requestedRole = req.headers['x-role'];
  const activeRole = requestedRole || roles[0] || null;

  if (activeRole && !roles.includes(activeRole)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'доступ запрещён: роль не выдана' } });
  }

  req.user = { id: user.id, fio: user.fio, login: user.login, roles, activeRole };
  next();
};
