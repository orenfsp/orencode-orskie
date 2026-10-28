const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole, notFound, validationError } = require('../auth/permissions');
const { pointsFor, stabilityCoefficient } = require('../ratingPoints');
const { buildTeamOrder } = require('../documents/teamOrder');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { disciplineId, ageGroupId } = req.query;
  let sql = `SELECT r.athlete_user_id, r.place, c.level, c.discipline_id, c.age_group_id,
    u.fio, u.disciplines FROM results r
    JOIN competitions c ON c.id = r.competition_id
    JOIN users u ON u.id = r.athlete_user_id
    WHERE r.place BETWEEN 1 AND 3 AND c.status='finished'`;
  const params = [];
  if (disciplineId) { sql += ' AND c.discipline_id = ?'; params.push(disciplineId); }
  if (ageGroupId) { sql += ' AND c.age_group_id = ?'; params.push(ageGroupId); }
  const rows = db.prepare(sql).all(...params);

  const byAthlete = new Map();
  rows.forEach(r => {
    const base = pointsFor(r.level, r.place);
    if (!byAthlete.has(r.athlete_user_id)) {
      byAthlete.set(r.athlete_user_id, { athleteUserId: r.athlete_user_id, fio: r.fio,
        results: [], total: 0, prizes: 0 });
    }
    const a = byAthlete.get(r.athlete_user_id);
    a.results.push({ level: r.level, place: r.place, basePoints: base });
    a.total += base;
    a.prizes++;
  });

  const list = [...byAthlete.values()]
    .map(a => ({
      ...a,
      stabilityCoefficient: stabilityCoefficient(a.prizes),
      total: Math.round(a.total * stabilityCoefficient(a.prizes))
    }))
    .sort((x, y) => y.total - x.total);

  res.json(list);
});

router.get('/:athleteUserId', auth, (req, res) => {
  const rows = db.prepare(`SELECT r.*, c.level, c.name AS comp_name
    FROM results r JOIN competitions c ON c.id = r.competition_id
    WHERE r.athlete_user_id = ? AND r.place BETWEEN 1 AND 3 AND c.status='finished'`)
    .all(req.params.athleteUserId);
  if (!rows.length) throw notFound('нет результатов');
  const breakdown = rows.map(r => ({
    competitionName: r.comp_name, level: r.level, place: r.place,
    basePoints: pointsFor(r.level, r.place),
  }));
  const prizes = rows.length;
  const baseSum = breakdown.reduce((s, x) => s + x.basePoints, 0);
  const coeff = stabilityCoefficient(prizes);
  res.json({ athleteUserId: Number(req.params.athleteUserId), breakdown,
    stabilityCoefficient: coeff, total: Math.round(baseSum * coeff) });
});

router.post('/team/select', auth, (req, res) => {
  requireRole(req, ['federation']);
  const body = req.body || {};
  const fields = {};

  const season = Number(body.season);
  const disciplineId = Number(body.disciplineId);
  const athleteIds = Array.isArray(body.athleteIds) ? body.athleteIds : null;

  if (!Number.isInteger(season) || season < 2020 || season > 2100) fields.season = 'Сезон: год от 2020 до 2100';
  if (!Number.isInteger(disciplineId) || disciplineId <= 0) fields.disciplineId = 'Выберите дисциплину';
  else if (!db.prepare('SELECT id FROM disciplines WHERE id = ?').get(disciplineId)) {
    fields.disciplineId = 'Дисциплина не найдена';
  }
  if (!athleteIds) fields.athleteIds = 'Отметьте спортсменов';

  if (Object.keys(fields).length) throw validationError(fields);

  const uniqueIds = [...new Set(athleteIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  uniqueIds.forEach((id) => {
    const athlete = db.prepare(`SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'athlete'
      WHERE u.id = ?`).get(id);
    if (!athlete) throw validationError({ athleteIds: 'Спортсмен не найден: ' + id });
  });

  db.prepare('DELETE FROM team_members WHERE season = ? AND discipline_id = ?').run(season, disciplineId);
  const insert = db.prepare('INSERT INTO team_members (season, discipline_id, athlete_user_id) VALUES (?, ?, ?)');
  uniqueIds.forEach((id) => insert.run(season, disciplineId, id));

  res.json({ ok: true, count: uniqueIds.length });
});

router.get('/team/:season/:disciplineId', auth, (req, res) => {
  const rows = db.prepare(`SELECT tm.*, u.fio FROM team_members tm
    JOIN users u ON u.id = tm.athlete_user_id
    WHERE tm.season=? AND tm.discipline_id=?`).all(req.params.season, req.params.disciplineId);
  res.json(rows.map(r => ({ athleteUserId: r.athlete_user_id, athleteFio: r.fio })));
});

router.get('/team/order/:season/:disciplineId', auth, async (req, res, next) => {
  try {
    requireRole(req, ['federation']);
    const buffer = await buildTeamOrder(req.params.season, req.params.disciplineId);    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="team_order_${req.params.season}_${req.params.disciplineId}.docx"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

module.exports = router;