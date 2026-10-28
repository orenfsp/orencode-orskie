const express = require('express');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const { requireRole } = require('../auth/permissions');
const { buildRegistryXlsx } = require('../documents/registryXlsx');

const router = express.Router();

router.get('/athletes', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`SELECT u.*, o.name AS org_name FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'athlete'
    ORDER BY u.fio`).all();
  res.json(rows.map(r => ({
    id: r.id, fio: r.fio, login: r.login, birthDate: r.birth_date,
    municipality: r.municipality, organization: r.org_name,
    disciplines: r.disciplines, rankType: r.rank_type, rankUntil: r.rank_until,
    startYear: r.start_year,
  })));
});

router.get('/report', auth, async (req, res, next) => {
  try {
    requireRole(req, ['federation']);
    const buffer = await buildRegistryXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="registry.xlsx"');
    res.send(buffer);
  } catch (e) { next(e); }
});

module.exports = router;