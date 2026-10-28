const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, badRequest, notFound, validationError } = require('../auth/permissions');
const { checkResult, text } = require('../validation');
const { notify } = require('../notifications');
const { buildProtocol } = require('../documents/protocol');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { competitionId } = req.query;
  if (!competitionId) throw badRequest('competitionId обязателен');
  const rows = db.prepare(`SELECT r.*, u.fio, u.login
    FROM results r JOIN users u ON u.id = r.athlete_user_id
    WHERE r.competition_id = ? ORDER BY r.place ASC`).all(competitionId);
  res.json(rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    athleteUserId: row.athlete_user_id,
    athleteFio: row.fio,
    place: row.place,
    points: row.points,
  })));
});

router.post('/', auth, (req, res) => {
  requireRole(req, ['federation']);
  const body = req.body || {};
  const competitionId = Number(body.competitionId);
  const athleteUserId = Number(body.athleteUserId);

  const fields = checkResult(body);
  if (!Number.isInteger(competitionId) || competitionId <= 0) fields.competitionId = 'Выберите соревнование';
  if (!Number.isInteger(athleteUserId) || athleteUserId <= 0) fields.athleteUserId = 'Выберите спортсмена';
  if (Object.keys(fields).length) throw validationError(fields);

  const competition = db.prepare('SELECT * FROM competitions WHERE id = ?').get(competitionId);
  if (!competition) throw validationError({ competitionId: 'Соревнование не найдено' });
  if (competition.status === 'draft') {
    throw badRequest('соревнование не опубликовано');
  }
  if (competition.status === 'applications_open') {
    throw badRequest('сначала закройте приём заявок');
  }

  const application = db.prepare(`
    SELECT id FROM applications
    WHERE competition_id = ? AND athlete_user_id = ? AND status = 'approved'
  `).get(competitionId, athleteUserId);
  if (!application) throw badRequest('нет одобренной заявки этого спортсмена');

  const place = Number(body.place);
  const points = text(body.points) ? Number(body.points) : null;

  const taken = db.prepare(`
    SELECT u.fio FROM results r JOIN users u ON u.id = r.athlete_user_id
    WHERE r.competition_id = ? AND r.place = ? AND r.athlete_user_id <> ?
  `).get(competitionId, place, athleteUserId);
  if (taken) throw validationError({ place: 'Место уже занято: ' + taken.fio });

  const existing = db.prepare('SELECT id FROM results WHERE competition_id = ? AND athlete_user_id = ?')
    .get(competitionId, athleteUserId);

  let resultId;
  if (existing) {
    db.prepare('UPDATE results SET place = ?, points = ? WHERE id = ?')
      .run(place, points, existing.id);
    resultId = existing.id;
  } else {
    const info = db.prepare('INSERT INTO results (competition_id, athlete_user_id, place, points) VALUES (?, ?, ?, ?)')
      .run(competitionId, athleteUserId, place, points);
    resultId = info.lastInsertRowid;
    db.prepare("UPDATE competitions SET status = 'finished' WHERE id = ? AND status = 'closed'").run(competitionId);
  }

  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)')
    .run(req.user.id, existing ? 'update_result' : 'create_result', 'result', resultId);

  notify(athleteUserId, existing ? 'result_updated' : 'result_added',
    'Результат на "' + competition.name + '": место ' + place +
    (points === null ? '' : ', ' + points + ' баллов'));

  if (!existing && competition.status === 'closed') {
    const participants = db.prepare(`
      SELECT athlete_user_id FROM applications
      WHERE competition_id = ? AND status = 'approved'
    `).all(competitionId);

    participants.forEach((participant) => {
      notify(participant.athlete_user_id, 'protocol_published',
        'Протокол соревнования "' + competition.name + '" опубликован');
    });
  }

  res.status(existing ? 200 : 201).json({ id: resultId });
});

router.get('/athlete/:id', auth, (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.activeRole === 'athlete' && req.user.id !== targetId) {
    throw badRequest('можно смотреть только свои результаты');
  }
  if (req.user.activeRole === 'coach') {
    const link = db.prepare("SELECT id FROM coach_athlete WHERE coach_user_id = ? AND athlete_user_id = ? AND status = 'active'")
      .get(req.user.id, targetId);
    if (!link) throw badRequest('спортсмен не привязан к вам');
  }

  const rows = db.prepare(`SELECT r.*, c.name AS comp_name, c.date_start, c.level, c.type
    FROM results r JOIN competitions c ON c.id = r.competition_id
    WHERE r.athlete_user_id = ? ORDER BY c.date_start DESC`).all(targetId);

  res.json(rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.comp_name,
    dateStart: row.date_start,
    level: row.level,
    type: row.type,
    place: row.place,
    points: row.points,
  })));
});

router.get('/:competitionId/protocol', auth, async (req, res, next) => {
  try {
    const buffer = await buildProtocol(req.params.competitionId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="protocol_${req.params.competitionId}.docx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
