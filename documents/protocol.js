const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType,
} = require('docx');
const { db } = require('../db');

const FONT = 'Arial';

async function buildProtocol(competitionId) {
  const comp = db.prepare(`
    SELECT c.*, d.name AS discipline_name, ag.name AS age_group_name
    FROM competitions c
    JOIN disciplines d ON d.id = c.discipline_id
    JOIN age_groups ag ON ag.id = c.age_group_id
    WHERE c.id = ?
  `).get(competitionId);

  if (!comp) {
    throw Object.assign(new Error('соревнование не найдено'), { status: 404, code: 'NOT_FOUND' });
  }

  const rows = db.prepare(`
    SELECT a.athlete_user_id, u.fio, r.place, r.points
    FROM applications a
    JOIN users u ON u.id = a.athlete_user_id
    LEFT JOIN results r
      ON r.competition_id = a.competition_id
     AND r.athlete_user_id = a.athlete_user_id
    WHERE a.competition_id = ? AND a.status = 'approved'
    ORDER BY CASE WHEN r.place IS NULL THEN 1 ELSE 0 END,
             r.place ASC,
             u.fio ASC
  `).all(competitionId);

  const headerCell = (text) => new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, font: FONT, size: 22 })],
    })],
    shading: { fill: 'D9E2F3' },
  });

  const tableRows = [new TableRow({
    children: [
      headerCell('Место'),
      headerCell('ФИО'),
      headerCell('Баллы'),
    ],
  })];

  rows.forEach(r => {
    tableRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.place ?? '-'), font: FONT, size: 22 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.fio, font: FONT, size: 22 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.points != null ? String(r.points) : '-', font: FONT, size: 22 })] })] }),
      ],
    }));
  });

  const p = (text, opts = {}) => new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    children: [new TextRun({ text, font: FONT, ...opts })],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
          paragraph: {},
        },
      },
    },
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'ПРОТОКОЛ', bold: true, size: 32, font: FONT })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: comp.name, bold: true, size: 26, font: FONT })],
        }),
        p(`Дисциплина: ${comp.discipline_name}`),
        p(`Возрастная группа: ${comp.age_group_name}`),
        p(`Даты: ${comp.date_start} - ${comp.date_end}`),
        p(`Место: ${comp.place || '-'}`),
        p(`Статус: ${comp.status}`),
        p(''),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildProtocol };