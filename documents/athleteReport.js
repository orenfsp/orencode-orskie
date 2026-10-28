const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');
const { db } = require('../db');

async function buildAthleteReport(athleteUserId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(athleteUserId);
  if (!user) throw Object.assign(new Error('спортсмен не найден'), { status: 404, code: 'NOT_FOUND' });

  const rows = db.prepare(`SELECT r.*, c.name AS comp_name, c.date_start, c.level, c.type
    FROM results r JOIN competitions c ON c.id = r.competition_id
    WHERE r.athlete_user_id = ? ORDER BY c.date_start DESC`).all(athleteUserId);

  const headerCell = (text) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    shading: { fill: 'D9E2F3' },
  });
  const tableRows = [new TableRow({ children: [
    headerCell('Соревнование'), headerCell('Дата'), headerCell('Уровень'),
    headerCell('Место'), headerCell('Баллы'),
  ]})];
  rows.forEach(r => {
    tableRows.push(new TableRow({ children: [
      new TableCell({ children: [new Paragraph(r.comp_name)] }),
      new TableCell({ children: [new Paragraph(r.date_start)] }),
      new TableCell({ children: [new Paragraph(r.level)] }),
      new TableCell({ children: [new Paragraph(String(r.place ?? '-'))] }),
      new TableCell({ children: [new Paragraph(String(r.points ?? '-'))] }),
    ]}));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'ОТЧЁТ О СОРЕВНОВАНИЯХ СПОРТСМЕНА', bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: `ФИО: ${user.fio}` }),
        new Paragraph({ text: `Дата рождения: ${user.birth_date || '-'}` }),
        new Paragraph({ text: `Муниципалитет: ${user.municipality || '-'}` }),
        new Paragraph({ text: `Разряд: ${user.rank_type || '-'} (до ${user.rank_until || '-'})` }),
        new Paragraph({ text: '' }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildAthleteReport };