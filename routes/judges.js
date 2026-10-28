const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, badRequest, conflict, notFound, validationError } = require('../auth/permissions');
const {
  JUDGE_CATEGORIES, parseIsoDate, checkReason, text,
} = require('../validation');
const { daysLeft } = require('../utils/dates');
const { notify, notifyFederation } = require('../notifications');

const router = express.Router();

const JUDGE_POSITIONS = [
  'главный судья',
  'заместитель главного судьи',
  'судья',
  'секретарь',
];

/* --- Назначения на соревнования ----------------------------------------- */

router.get('/assignments', auth, (req, res) => {
  requireRole(req, ['federation']);
  const { competitionId } = req.query;
  if (!competitionId) throw badRequest('competitionId обязателен');
  const rows = db.prepare(`SELECT ja.*, u.fio FROM judge_assignments ja
    JOIN users u ON u.id = ja.judge_user_id WHERE ja.competition_id = ?`).all(competitionId);
  res.json(rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    judgeUserId: row.judge_user_id,
    judgeFio: row.fio,
    position: row.position,
  })));
});

router.post('/assignments', auth, (req, res) => {
  requireRole(req, ['federation']);
  const body = req.body || {};
  const fields = {};

  const competitionId = Number(body.competitionId);
  if (!Number.isInteger(competitionId) || competitionId <= 0) fields.competitionId = 'Выберите соревнование';
  else if (!db.prepare('SELECT id FROM competitions WHERE id = ?').get(competitionId)) {
    fields.competitionId = 'Соревнование не найдено';
  }

  const judgeUserId = Number(body.judgeUserId);
  if (!Number.isInteger(judgeUserId) || judgeUserId <= 0) {
    fields.judgeUserId = 'Выберите судью';
  } else {
    const judge = db.prepare(`SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'judge'
      WHERE u.id = ?`).get(judgeUserId);
    if (!judge) fields.judgeUserId = 'Пользователь не имеет роли судьи';
  }

  const position = text(body.position);
  if (!position) fields.position = 'Выберите судейскую должность';
  else if (JUDGE_POSITIONS.indexOf(position) === -1) fields.position = 'Недопустимая судейская должность';

  if (Object.keys(fields).length) throw validationError(fields);

  const duplicate = db.prepare(`
    SELECT id FROM judge_assignments WHERE competition_id = ? AND judge_user_id = ?
  `).get(competitionId, judgeUserId);
  if (duplicate) throw conflict('этот судья уже назначен на соревнование');

  const info = db.prepare('INSERT INTO judge_assignments (competition_id, judge_user_id, position) VALUES (?, ?, ?)')
    .run(competitionId, judgeUserId, position);

  const competition = db.prepare('SELECT name FROM competitions WHERE id = ?').get(competitionId);
  notify(judgeUserId, 'judge_assigned',
    'Назначение на "' + (competition ? competition.name : 'соревнование') + '": ' + position);

  res.status(201).json({ id: info.lastInsertRowid });
});

/* --- Список судей для назначения ---------------------------------------- */

router.get('/list', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`SELECT u.id, u.fio, u.category, u.category_until, ur.judge_category
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'judge'
    ORDER BY u.fio`).all();
  res.json(rows.map((row) => ({
    id: row.id,
    fio: row.fio,
    category: row.judge_category || row.category,
    categoryUntil: row.category_until,
  })));
});

/* --- Кабинет судьи ------------------------------------------------------- */

router.get('/my', auth, (req, res) => {
  requireRole(req, ['judge']);
  const rows = db.prepare(`SELECT ja.*, c.name AS comp_name, c.date_start
    FROM judge_assignments ja JOIN competitions c ON c.id = ja.competition_id
    WHERE ja.judge_user_id = ? ORDER BY c.date_start DESC`).all(req.user.id);
  res.json(rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.comp_name,
    dateStart: row.date_start,
    position: row.position,
  })));
});

router.get('/category/my', auth, (req, res) => {
  requireRole(req, ['judge']);
  const user = db.prepare('SELECT category, category_until FROM users WHERE id = ?').get(req.user.id);
  const left = daysLeft(user.category_until);

  res.json({
    category: user.category,
    categoryUntil: user.category_until,
    expiringSoon: left !== null && left < 30 && left >= 0,
  });
});

router.post('/category/request', auth, (req, res) => {
  requireRole(req, ['judge']);
  const category = text(req.body && req.body.category);
  if (!category) throw validationError({ category: 'Выберите категорию' });
  if (JUDGE_CATEGORIES.indexOf(category) === -1) throw validationError({ category: 'Недопустимая категория' });

  const pending = db.prepare(`
    SELECT id FROM requests WHERE user_id = ? AND type = 'judge_category' AND status = 'pending'
  `).get(req.user.id);
  if (pending) throw conflict('заявка на категорию уже отправлена');

  const info = db.prepare(`INSERT INTO requests (type, user_id, requested_type, status)
    VALUES ('judge_category', ?, ?, 'pending')`).run(req.user.id, category);

  notify(req.user.id, 'judge_category_requested',
    'Заявка на судейскую категорию "' + category + '" отправлена федерации');
  notifyFederation('judge_category_new',
    'Новая заявка на судейскую категорию "' + category + '" от судьи #' + req.user.id);

  res.status(201).json({ id: info.lastInsertRowid });
});

/* --- Рассмотрение заявок на категорию ----------------------------------- */

router.get('/category/requests', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`SELECT r.*, u.fio FROM requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.type = 'judge_category'
    ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`).all();
  res.json(rows.map((row) => ({
    id: row.id,
    judgeUserId: row.user_id,
    judgeFio: row.fio,
    requestedType: row.requested_type,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
  })));
});

router.post('/category/requests/:id/approve', auth, (req, res) => {
  requireRole(req, ['federation']);
  const requestRow = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'judge_category'").get(req.params.id);
  if (!requestRow) throw notFound('заявка не найдена');
  if (requestRow.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const body = req.body || {};
  const category = text(body.category) || requestRow.requested_type;
  const fields = {};

  if (JUDGE_CATEGORIES.indexOf(category) === -1) fields.category = 'Недопустимая категория';

  const until = text(body.assignedUntil);
  if (!until) fields.assignedUntil = 'Укажите срок действия категории';
  else if (!parseIsoDate(until)) fields.assignedUntil = 'Срок действия: некорректная дата';

  if (Object.keys(fields).length) throw validationError(fields);

  db.prepare(`UPDATE requests SET status = 'approved', requested_type = ?, assigned_until = ? WHERE id = ?`)
    .run(category, until, requestRow.id);
  db.prepare('UPDATE users SET category = ?, category_until = ? WHERE id = ?')
    .run(category, until, requestRow.user_id);
  db.prepare('UPDATE user_roles SET judge_category = ? WHERE user_id = ? AND role = ?')
    .run(category, requestRow.user_id, 'judge');

  notify(requestRow.user_id, 'judge_category_approved',
    'Судейская категория "' + category + '" подтверждена до ' + until);

  res.json({ ok: true });
});

router.post('/category/requests/:id/reject', auth, (req, res) => {
  requireRole(req, ['federation']);
  const requestRow = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'judge_category'").get(req.params.id);
  if (!requestRow) throw notFound('заявка не найдена');
  if (requestRow.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const reason = text(req.body && req.body.reason);
  const reasonError = checkReason(reason);
  if (reasonError) throw validationError({ reason: reasonError });

  db.prepare("UPDATE requests SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .run(reason, requestRow.id);

  notify(requestRow.user_id, 'judge_category_rejected',
    'Заявка на судейскую категорию отклонена. Причина: ' + reason);

  res.json({ ok: true });
});

module.exports = router;
