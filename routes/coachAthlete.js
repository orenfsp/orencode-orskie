const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, badRequest, conflict, notFound, validationError } = require('../auth/permissions');
const { checkLogin, checkPositiveInt, text } = require('../validation');
const { notify } = require('../notifications');

const router = express.Router();

router.get('/', auth, (req, res) => {
  requireRole(req, ['coach']);
  const rows = db.prepare(`SELECT ca.*, u.fio, d.name AS discipline_name
    FROM coach_athlete ca
    JOIN users u ON u.id = ca.athlete_user_id
    JOIN disciplines d ON d.id = ca.discipline_id
    WHERE ca.coach_user_id = ? ORDER BY ca.created_at DESC`).all(req.user.id);
  res.json(rows.map((row) => ({
    id: row.id,
    athleteUserId: row.athlete_user_id,
    athleteFio: row.fio,
    discipline: row.discipline_name,
    status: row.status,
    createdAt: row.created_at,
  })));
});

router.post('/request', auth, (req, res) => {
  requireRole(req, ['coach']);
  const body = req.body || {};
  const fields = {};

  const login = text(body.athleteLogin);
  const loginError = checkLogin(login);
  if (loginError) fields.athleteLogin = loginError;

  const disciplineError = checkPositiveInt(body.disciplineId, 'Выберите дисциплину');
  if (disciplineError) fields.disciplineId = disciplineError;

  if (Object.keys(fields).length) throw validationError(fields);

  if (!db.prepare('SELECT id FROM disciplines WHERE id = ?').get(Number(body.disciplineId))) {
    throw validationError({ disciplineId: 'Дисциплина не найдена' });
  }

  const athlete = db.prepare(`SELECT u.* FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'athlete'
    WHERE u.login = ?`).get(login);
  if (!athlete) throw notFound('спортсмен с таким логином не найден');

  const duplicate = db.prepare(`SELECT id, status FROM coach_athlete
    WHERE coach_user_id = ? AND athlete_user_id = ? AND discipline_id = ?`).get(req.user.id, athlete.id, Number(body.disciplineId));
  if (duplicate) throw conflict('запрос по этой дисциплине уже отправлен');

  const info = db.prepare("INSERT INTO coach_athlete (coach_user_id, athlete_user_id, discipline_id, status) VALUES (?, ?, ?, 'pending')")
    .run(req.user.id, athlete.id, Number(body.disciplineId));

  notify(athlete.id, 'coach_link_requested',
    'Тренер отправил запрос на привязку. Подтвердите связь в профиле.');

  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/confirm', auth, (req, res) => {
  requireRole(req, ['athlete']);
  const link = db.prepare('SELECT * FROM coach_athlete WHERE id = ?').get(req.params.id);
  if (!link) throw notFound('связь не найдена');
  if (link.athlete_user_id !== req.user.id) throw badRequest('это не ваша связь');
  if (link.status !== 'pending') throw badRequest('запрос уже обработан');

  db.prepare("UPDATE coach_athlete SET status = 'active' WHERE id = ?").run(req.params.id);
  notify(link.coach_user_id, 'coach_link_confirmed', 'Спортсмен подтвердил связь с вами');
  res.json({ ok: true });
});

router.post('/:id/pause', auth, (req, res) => {
  requireRole(req, ['coach']);
  const link = db.prepare('SELECT * FROM coach_athlete WHERE id = ?').get(req.params.id);
  if (!link) throw notFound('связь не найдена');
  if (link.coach_user_id !== req.user.id) throw badRequest('это не ваша связь');
  if (link.status !== 'active' && link.status !== 'pending') throw badRequest('связь уже приостановлена или завершена');

  db.prepare("UPDATE coach_athlete SET status = 'paused' WHERE id = ?").run(req.params.id);
  notify(link.athlete_user_id, 'coach_link_paused', 'Связь с тренером приостановлена');
  res.json({ ok: true });
});

router.post('/:id/finish', auth, (req, res) => {
  requireRole(req, ['coach']);
  const link = db.prepare('SELECT * FROM coach_athlete WHERE id = ?').get(req.params.id);
  if (!link) throw notFound('связь не найдена');
  if (link.coach_user_id !== req.user.id) throw badRequest('это не ваша связь');
  if (link.status === 'finished') throw badRequest('связь уже завершена');

  db.prepare("UPDATE coach_athlete SET status = 'finished' WHERE id = ?").run(req.params.id);
  notify(link.athlete_user_id, 'coach_link_finished', 'Связь с тренером завершена');
  res.json({ ok: true });
});

module.exports = router;
