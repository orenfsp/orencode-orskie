const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, badRequest, conflict, notFound, validationError } = require('../auth/permissions');
const { checkReason, isAgeInGroup, text } = require('../validation');
const { notify, notifyFederation } = require('../notifications');

const router = express.Router();

function audit(userId, action, entity, entityId) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)')
    .run(userId, action, entity, entityId);
}

function competitionName(id) {
  const row = db.prepare('SELECT name FROM competitions WHERE id = ?').get(id);
  return row ? row.name : 'соревнование';
}

function checkAge(userId, ageGroupId) {
  const user = db.prepare('SELECT birth_date FROM users WHERE id = ?').get(userId);
  if (!user || !user.birth_date) return true;
  const ag = db.prepare('SELECT age_from, age_to FROM age_groups WHERE id = ?').get(ageGroupId);
  if (!ag) return true;
  return isAgeInGroup(user.birth_date, ag.age_from, ag.age_to);
}

router.get('/', auth, (req, res) => {
  requireRole(req, ['federation']);
  const { competitionId, status } = req.query;
  let sql = `SELECT a.*, u.fio, u.login FROM applications a
    JOIN users u ON u.id = a.athlete_user_id WHERE 1=1`;
  const params = [];
  if (competitionId) { sql += ' AND a.competition_id = ?'; params.push(competitionId); }
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  sql += ' ORDER BY a.created_at DESC';
  res.json(db.prepare(sql).all(...params).map(r => ({
    id: r.id, competitionId: r.competition_id, athleteUserId: r.athlete_user_id,
    athleteFio: r.fio, status: r.status, rejectReason: r.reject_reason, createdAt: r.created_at,
  })));
});

router.get('/my', auth, (req, res) => {
  requireRole(req, ['athlete']);
  const rows = db.prepare(`SELECT a.*, c.name AS comp_name, c.date_start
    FROM applications a JOIN competitions c ON c.id = a.competition_id
    WHERE a.athlete_user_id = ? ORDER BY a.created_at DESC`).all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id, competitionId: r.competition_id, competitionName: r.comp_name,
    dateStart: r.date_start, status: r.status, rejectReason: r.reject_reason,
  })));
});

router.get('/my-athletes', auth, (req, res) => {
  requireRole(req, ['coach']);
  const rows = db.prepare(`SELECT a.*, u.fio, c.name AS comp_name
    FROM applications a
    JOIN users u ON u.id = a.athlete_user_id
    JOIN competitions c ON c.id = a.competition_id
    JOIN coach_athlete ca ON ca.athlete_user_id = a.athlete_user_id
    WHERE ca.coach_user_id = ? AND ca.status='active'
    ORDER BY a.created_at DESC`).all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id, competitionId: r.competition_id, competitionName: r.comp_name,
    athleteUserId: r.athlete_user_id, athleteFio: r.fio,
    status: r.status, rejectReason: r.reject_reason,
  })));
});

router.post('/', auth, (req, res) => {
  requireRole(req, ['athlete', 'coach']);
  const { competitionId, athleteId } = req.body;
  if (!competitionId) throw badRequest('competitionId обязателен');

  let athleteUserId;
  if (req.user.activeRole === 'athlete') {
    athleteUserId = req.user.id;
  } else {
    if (!athleteId) throw badRequest('athleteId обязателен для тренера');
    const link = db.prepare("SELECT id FROM coach_athlete WHERE coach_user_id=? AND athlete_user_id=? AND status='active'")
      .get(req.user.id, athleteId);
    if (!link) throw badRequest('спортсмен не привязан к вам');
    athleteUserId = athleteId;
  }

  const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(competitionId);
  if (!comp) throw notFound('соревнование не найдено');
  if (comp.status !== 'applications_open') throw badRequest('приём заявок закрыт');

  if (!checkAge(athleteUserId, comp.age_group_id)) throw badRequest('не подходите по возрасту');

  const exists = db.prepare('SELECT id FROM applications WHERE competition_id=? AND athlete_user_id=?')
    .get(competitionId, athleteUserId);
  if (exists) throw conflict('заявка уже подана');

  const info = db.prepare("INSERT INTO applications (competition_id, athlete_user_id, status) VALUES (?, ?, 'pending')")
    .run(competitionId, athleteUserId);

  audit(req.user.id, 'create', 'application', info.lastInsertRowid);
  notify(athleteUserId, 'application_created',
    'Заявка на "' + comp.name + '" подана, статус: на рассмотрении');
  notifyFederation('application_new',
    'Новая заявка на "' + comp.name + '" от спортсмена #' + athleteUserId);

  res.status(201).json({ id: info.lastInsertRowid, status: 'pending' });
});

router.post('/:id/approve', auth, (req, res) => {
  requireRole(req, ['federation']);
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) throw notFound('заявка не найдена');
  if (app.status !== 'pending') throw badRequest('заявка уже рассмотрена');
  db.prepare("UPDATE applications SET status = 'approved', reject_reason = NULL WHERE id = ?").run(req.params.id);
  audit(req.user.id, 'approve', 'application', app.id);
  notify(app.athlete_user_id, 'application_approved',
    'Заявка на "' + competitionName(app.competition_id) + '" одобрена');
  res.json({ ok: true });
});

router.post('/:id/reject', auth, (req, res) => {
  requireRole(req, ['federation']);
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) throw notFound('заявка не найдена');
  if (app.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const reason = text(req.body && req.body.reason);
  const reasonError = checkReason(reason);
  if (reasonError) throw validationError({ reason: reasonError });

  db.prepare("UPDATE applications SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .run(reason, req.params.id);
  audit(req.user.id, 'reject', 'application', app.id);
  notify(app.athlete_user_id, 'application_rejected',
    'Заявка на "' + competitionName(app.competition_id) + '" отклонена. Причина: ' + reason);
  res.json({ ok: true });
});

module.exports = router;