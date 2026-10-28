const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/disciplines', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM disciplines ORDER BY id').all());
});
router.get('/organizations', (req, res) => {
  res.json(db.prepare('SELECT id, name, type FROM organizations ORDER BY name').all());
});
router.get('/age-groups', (req, res) => {
  const rows = db.prepare('SELECT * FROM age_groups ORDER BY age_from').all();
  res.json(rows.map(r => ({ id: r.id, name: r.name, ageFrom: r.age_from, ageTo: r.age_to })));
});

module.exports = router;