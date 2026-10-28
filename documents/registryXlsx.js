const ExcelJS = require('exceljs');
const { db } = require('../db');

async function buildRegistryXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Численность');

  ws.columns = [
    { header: 'Год', key: 'year', width: 10 },
    { header: 'Организация', key: 'org', width: 30 },
    { header: 'Муниципалитет', key: 'municipality', width: 20 },
    { header: 'Дисциплина', key: 'discipline', width: 40 },
    { header: 'Количество', key: 'count', width: 15 },
  ];

  const rows = db.prepare(`SELECT u.start_year AS year, o.name AS org, u.municipality, u.disciplines
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'athlete'`).all();

  const disciplines = db.prepare('SELECT id, name FROM disciplines').all();
  const discMap = Object.fromEntries(disciplines.map(d => [d.id, d.name]));

  const agg = new Map();
  rows.forEach(r => {
    if (!r.year) return;
    const discIds = (r.disciplines || '').split(',').filter(Boolean);
    discIds.forEach(dId => {
      const key = `${r.year}|${r.org || 'без организации'}|${r.municipality || '-'}|${discMap[dId] || '-'}`;
      agg.set(key, (agg.get(key) || 0) + 1);
    });
  });

  [...agg.entries()].sort().forEach(([key, count]) => {
    const [year, org, municipality, discipline] = key.split('|');
    ws.addRow({ year, org, municipality, discipline, count });
  });

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

module.exports = { buildRegistryXlsx };