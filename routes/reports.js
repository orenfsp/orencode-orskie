const express = require('express');
const auth = require('../auth/checkAuth');
const { requireRole } = require('../auth/permissions');
const { buildAthleteReport } = require('../documents/athleteReport');
const { buildProtocol } = require('../documents/protocol');
const { buildRegistryXlsx } = require('../documents/registryXlsx');
const { buildTeamOrder } = require('../documents/teamOrder');

const router = express.Router();

router.get('/registry', auth, async (req, res, next) => {
  try {
    requireRole(req, ['federation']);
    const buf = await buildRegistryXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="registry.xlsx"');
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/athlete/:id', auth, async (req, res, next) => {
  try {
    if (req.user.activeRole === 'athlete' && req.user.id !== Number(req.params.id)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'доступ запрещён' } });
    }
    const buf = await buildAthleteReport(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="athlete_${req.params.id}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/protocol/:competitionId', auth, async (req, res, next) => {
  try {
    const buf = await buildProtocol(req.params.competitionId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="protocol_${req.params.competitionId}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/team/:season/:disciplineId', auth, async (req, res, next) => {
  try {
    requireRole(req, ['federation']);
    const buf = await buildTeamOrder(req.params.season, req.params.disciplineId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="team_order_${req.params.season}_${req.params.disciplineId}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

module.exports = router;