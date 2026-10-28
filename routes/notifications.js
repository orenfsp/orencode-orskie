const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole } = require('../auth/permissions');
const { unreadCount } = require('../notifications');
const { runDeadlineCheck } = require('../workers/deadlines');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, type, text, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 50
  `).all(req.user.id);

  res.json(rows.map((row) => ({
    id: row.id,
    type: row.type,
    text: row.text,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  })));
});

router.get('/unread-count', auth, (req, res) => {
  res.json({ count: unreadCount(req.user.id) });
});

router.post('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

/* Ручной запуск проверки сроков: удобно для демонстрации, не дожидаясь 9:00. */
router.post('/check-deadlines', auth, async (req, res, next) => {
  try {
    requireRole(req, ['federation']);
    const result = await runDeadlineCheck();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
