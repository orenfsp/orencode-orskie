const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const { db } = require('../db');

async function buildTeamOrder(season, disciplineId) {
  const disc = db.prepare('SELECT name FROM disciplines WHERE id = ?').get(disciplineId);
  const rows = db.prepare(`SELECT u.fio FROM team_members tm
    JOIN users u ON u.id = tm.athlete_user_id
    WHERE tm.season = ? AND tm.discipline_id = ? ORDER BY u.fio`).all(season, disciplineId);

  const children = [
    new Paragraph({ children: [new TextRun({ text: 'ПРОЕКТ ПРИКАЗА', bold: true, size: 32 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `О формировании сборной команды Оренбургской области по дисциплине "${disc ? disc.name : '-'}" на ${season} год` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '1. Утвердить состав сборной команды:' }),
  ];
  rows.forEach((r, i) => {
    children.push(new Paragraph({ text: `${i + 1}. ${r.fio}` }));
  });
  children.push(new Paragraph({ text: '' }));
  children.push(new Paragraph({ text: 'Президент Федерации _________________' }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildTeamOrder };