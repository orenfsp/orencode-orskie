const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, badRequest, notFound, validationError } = require('../auth/permissions');
const {
  PATTERNS, parseIsoDate, checkReason, text,
} = require('../validation');
const { daysLeft } = require('../utils/dates');
const { notify, notifyFederation } = require('../notifications');

const router = express.Router();

const RANK_TYPES = ['III', 'II', 'I', 'КМС', 'МС'];

function rankInfo(userId) {
  const user = db.prepare('SELECT rank_type, rank_until FROM users WHERE id = ?').get(userId);
  if (!user) return { rankType: null, rankUntil: null, expiringSoon: false };
  const left = daysLeft(user.rank_until);
  return {
    rankType: user.rank_type,
    rankUntil: user.rank_until,
    expiringSoon: left !== null && left < 30 && left >= 0,
  };
}

router.get('/my', auth, (req, res) => {
  requireRole(req, ['athlete']);
  res.json(rankInfo(req.user.id));
});

router.get('/my-athletes', auth, (req, res) => {
  requireRole(req, ['coach']);
  const rows = db.prepare(`SELECT u.id, u.fio FROM coach_athlete ca
    JOIN users u ON u.id = ca.athlete_user_id
    WHERE ca.coach_user_id = ? AND ca.status = 'active'`).all(req.user.id);
  res.json(rows.map((row) => ({ athleteUserId: row.id, athleteFio: row.fio, ...rankInfo(row.id) })));
});

router.get('/', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`SELECT u.id, u.fio, u.rank_type, u.rank_until
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'athlete'
    ORDER BY u.fio`).all();
  res.json(rows.map((row) => ({
    athleteUserId: row.id,
    athleteFio: row.fio,
    rankType: row.rank_type,
    rankUntil: row.rank_until,
    ...rankInfo(row.id),
  })));
});

router.post('/request', auth, (req, res) => {
  requireRole(req, ['athlete', 'coach']);
  const body = req.body || {};

  const fields = {};
  const competitionId = Number(body.competitionId);
  const resultId = Number(body.resultId);
  const rankType = text(body.rankType);

  if (!Number.isInteger(competitionId) || competitionId <= 0) fields.competitionId = 'Выберите соревнование';
  if (!Number.isInteger(resultId) || resultId <= 0) fields.resultId = 'Выберите результат';
  if (!rankType) fields.rankType = 'Выберите разряд';
  else if (RANK_TYPES.indexOf(rankType) === -1) fields.rankType = 'Недопустимый разряд';

  let target = req.user.id;
  if (req.user.activeRole === 'coach') {
    target = Number(body.athleteUserId);
    if (!Number.isInteger(target) || target <= 0) {
      fields.athleteUserId = 'Выберите спортсмена';
    } else {
      const link = db.prepare("SELECT id FROM coach_athlete WHERE coach_user_id = ? AND athlete_user_id = ? AND status = 'active'")
        .get(req.user.id, target);
      if (!link) fields.athleteUserId = 'Спортсмен не привязан к вам';
    }
  }

  if (Object.keys(fields).length) throw validationError(fields);

  const result = db.prepare('SELECT id, competition_id, athlete_user_id FROM results WHERE id = ?').get(resultId);
  if (!result) throw validationError({ resultId: 'Результат не найден' });
  if (Number(result.athlete_user_id) !== Number(target)) {
    throw validationError({ resultId: 'Результат принадлежит другому спортсмену' });
  }
  if (Number(result.competition_id) !== competitionId) {
    throw validationError({ competitionId: 'Соревнование не совпадает с результатом' });
  }

  const info = db.prepare(`INSERT INTO requests (type, user_id, competition_id, result_id, requested_type, status)
    VALUES ('rank', ?, ?, ?, ?, 'pending')`)
    .run(target, competitionId, resultId, rankType);

  notify(target, 'rank_requested', 'Заявка на разряд "' + rankType + '" отправлена федерации');
  notifyFederation('rank_request_new', 'Новая заявка на разряд "' + rankType + '" от спортсмена #' + target);

  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/approve', auth, (req, res) => {
  requireRole(req, ['federation']);
  const requestRow = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'rank'").get(req.params.id);
  if (!requestRow) throw notFound('заявка не найдена');
  if (requestRow.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const body = req.body || {};
  const fields = {};

  const assignedDate = text(body.assignedDate);
  if (!assignedDate) fields.assignedDate = 'Укажите дату присвоения';
  else if (!parseIsoDate(assignedDate)) fields.assignedDate = 'Дата присвоения: некорректная дата';

  const orderNumber = text(body.orderNumber);
  if (!orderNumber) fields.orderNumber = 'Укажите номер приказа';
  else if (!PATTERNS.orderNumber.test(orderNumber)) fields.orderNumber = 'Номер приказа: буквы, цифры, дефис или слэш';

  const assignedUntil = text(body.assignedUntil);
  if (!assignedUntil) fields.assignedUntil = 'Укажите срок действия';
  else if (!parseIsoDate(assignedUntil)) fields.assignedUntil = 'Срок действия: некорректная дата';

  if (!fields.assignedDate && !fields.assignedUntil) {
    if (parseIsoDate(assignedUntil).getTime() <= parseIsoDate(assignedDate).getTime()) {
      fields.assignedUntil = 'Срок действия должен быть позже даты присвоения';
    }
  }

  if (Object.keys(fields).length) throw validationError(fields);

  db.prepare(`UPDATE requests SET status = 'approved', assigned_date = ?, order_number = ?, assigned_until = ? WHERE id = ?`)
    .run(assignedDate, orderNumber, assignedUntil, req.params.id);
  db.prepare('UPDATE users SET rank_type = ?, rank_until = ? WHERE id = ?')
    .run(requestRow.requested_type, assignedUntil, requestRow.user_id);

  notify(requestRow.user_id, 'rank_approved',
    'Разряд "' + requestRow.requested_type + '" присвоен, действует до ' + assignedUntil);

  res.json({ ok: true });
});

router.post('/:id/reject', auth, (req, res) => {
  requireRole(req, ['federation']);
  const requestRow = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'rank'").get(req.params.id);
  if (!requestRow) throw notFound('заявка не найдена');
  if (requestRow.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const reason = text(req.body && req.body.reason);
  const reasonError = checkReason(reason);
  if (reasonError) throw validationError({ reason: reasonError });

  db.prepare("UPDATE requests SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .run(reason, req.params.id);

  notify(requestRow.user_id, 'rank_rejected', 'Заявка на разряд отклонена. Причина: ' + reason);

  res.json({ ok: true });
});

router.get('/requests', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`SELECT r.*, u.fio FROM requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.type = 'rank' ORDER BY r.created_at DESC`).all();
  res.json(rows.map((row) => ({
    id: row.id,
    athleteUserId: row.user_id,
    athleteFio: row.fio,
    competitionId: row.competition_id,
    resultId: row.result_id,
    requestedType: row.requested_type,
    status: row.status,
  })));
});

module.exports = router;
