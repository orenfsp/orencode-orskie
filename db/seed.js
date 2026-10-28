const bcrypt = require('bcryptjs');
const { db } = require('./index');
const { addUserRole } = require('./roles');

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const hash = bcrypt.hashSync('123', 10);

  const insertDiscipline = db.prepare('INSERT INTO disciplines (name) VALUES (?)');
  [
    'программирование алгоритмическое',
    'программирование продуктовое',
    'программирование систем информационной безопасности',
    'программирование систем искусственного интеллекта',
    'программирование робототехники',
    'программирование беспилотных авиационных систем',
  ].forEach((name) => insertDiscipline.run(name));

  const insertAge = db.prepare('INSERT INTO age_groups (name, age_from, age_to) VALUES (?, ?, ?)');
  [['Юноши 14-17', 14, 17], ['Юниоры 18-21', 18, 21],
    ['Мужчины и женщины 22+', 22, 99], ['Без ограничений', 14, 99]]
    .forEach((row) => insertAge.run(...row));

  const insertOrg = db.prepare('INSERT INTO organizations (name, type) VALUES (?, ?)');
  [['СШОР №2', 'спортивная школа'], ['ОГУ', 'вуз'],
    ['Гимназия №1', 'школа'], ['Клуб Прогресс', 'клуб']]
    .forEach((row) => insertOrg.run(...row));

  const insertUser = db.prepare(`
    INSERT INTO users (login, password_hash, fio, roles, email, phone, consent_pd,
      birth_date, municipality, organization_id, start_year,
      disciplines, rank_type, rank_until, category, category_until, rusada_date, rusada_url)
    VALUES (?, ?, ?, '', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function createUser(data) {
    const info = insertUser.run(
      data.login, hash, data.fio, data.email || null, data.phone || null,
      data.birthDate || null, data.municipality || null, data.organizationId || null,
      data.startYear || null, data.disciplines || null,
      data.rankType || null, data.rankUntil || null,
      data.category || null, data.categoryUntil || null,
      data.rusadaDate || null, data.rusadaUrl || null
    );
    return info.lastInsertRowid;
  }

  const fedId = createUser({
    login: 'fed', fio: 'Смирнов Алексей Петрович', email: 'fed@example.ru',
  });
  addUserRole(fedId, 'federation');

  const athleteId = createUser({
    login: 'athlete', fio: 'Иванов Иван Иванович', email: 'athlete@example.ru',
    birthDate: '2005-05-15', municipality: 'Оренбург', organizationId: 1,
    startYear: 2018, disciplines: '1,2', rusadaDate: '2025-02-10',
    rusadaUrl: 'https://rusada.ru/education/online-course/',
  });
  addUserRole(athleteId, 'athlete', { disciplines: [1, 2] });

  const coachId = createUser({
    login: 'coach', fio: 'Петров Пётр Петрович', email: 'coach@example.ru',
    phone: '+7 900 111-22-33', municipality: 'Оренбург', organizationId: 1,
  });
  addUserRole(coachId, 'coach', { experienceYears: 8, disciplines: [1, 2] });

  const judgeId = createUser({
    login: 'judge', fio: 'Сидоров Сидор Сидорович', email: 'judge@example.ru',
    municipality: 'Оренбург', category: 'первая', categoryUntil: '2027-06-01',
  });
  addUserRole(judgeId, 'judge', { judgeCategory: 'первая' });

  const bothId = createUser({
    login: 'both', fio: 'Козлов Дмитрий Сергеевич', email: 'both@example.ru',
    birthDate: '2000-03-20', municipality: 'Оренбург', organizationId: 2,
    startYear: 2015, disciplines: '1',
  });
  addUserRole(bothId, 'athlete', { disciplines: [1] });
  addUserRole(bothId, 'coach', { experienceYears: 4, disciplines: [1] });

  const athletes = {};
  [['ath2', 'Морозова Анна Сергеевна', '2006-08-12', 3, 3, 2019, '3'],
    ['ath3', 'Волков Никита Андреевич', '2004-11-01', 1, 1, 2017, '1'],
    ['ath4', 'Лебедева Мария Олеговна', '2007-02-25', 2, 3, 2020, '2'],
    ['ath5', 'Новиков Артём Игоревич', '2003-07-14', 4, 2, 2016, '4'],
    ['ath6', 'Зайцева Дарья Викторовна', '2005-12-03', 5, 1, 2018, '5'],
    ['ath7', 'Соколов Максим Олегович', '2002-04-19', 6, 2, 2015, '6'],
    ['ath8', 'Павлова Екатерина Ивановна', '2006-09-07', 1, 4, 2019, '1']]
    .forEach(([login, fio, birthDate, discipline, org, startYear, rank]) => {
      const id = createUser({
        login,
        fio,
        email: `${login}@example.ru`,
        birthDate,
        municipality: 'Оренбург',
        organizationId: org,
        startYear,
        disciplines: String(discipline),
      });
      addUserRole(id, 'athlete', { disciplines: [discipline] });
      athletes[login] = id;
    });

  db.prepare("UPDATE users SET rank_type = 'I', rank_until = '2027-01-01' WHERE login IN ('ath3', 'ath5')").run();

  const insertLink = db.prepare('INSERT INTO coach_athlete (coach_user_id, athlete_user_id, discipline_id, status) VALUES (?, ?, ?, ?)');
  insertLink.run(coachId, athleteId, 1, 'active');
  insertLink.run(coachId, bothId, 1, 'active');

  const insertComp = db.prepare(`
    INSERT INTO competitions (name, discipline_id, age_group_id, type, level, format, status,
      date_start, date_end, place, calendar_plan, calendar_number, applications_deadline, regulation_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const regulation = 'https://fsp56.ru/regulations/';
  const c2024a = insertComp.run('Чемпионат Оренбургской области 2024', 1, 3, 'Чемпионат', 'Региональные', 'очный', 'finished', '2024-03-15', '2024-03-16', 'Оренбург', 'Региональный', '1-Р', '2024-03-01', regulation + '2024/chempionat.pdf').lastInsertRowid;
  const c2024b = insertComp.run('Кубок Оренбуржья 2024', 2, 4, 'Кубок', 'Региональные', 'онлайн', 'finished', '2024-10-10', '2024-10-11', 'Оренбург', 'Региональный', '2-Р', '2024-09-25', regulation + '2024/kubok.pdf').lastInsertRowid;
  const c2025a = insertComp.run('Первенство Оренбургской области 2025', 1, 2, 'Первенство', 'Региональные', 'очный', 'finished', '2025-04-20', '2025-04-21', 'Оренбург', 'Региональный', '3-Р', '2025-04-05', regulation + '2025/pervenstvo.pdf').lastInsertRowid;
  const c2025b = insertComp.run('Межрегиональный турнир 2025', 3, 3, 'Чемпионат', 'Межрегиональные', 'очный', 'finished', '2025-09-12', '2025-09-13', 'Самара', 'ЕКП', '100-ЕКП', '2025-08-30', regulation + '2025/turnir.pdf').lastInsertRowid;
  const c2026a = insertComp.run('Чемпионат Оренбургской области 2026', 1, 3, 'Чемпионат', 'Региональные', 'очный', 'applications_open', '2026-11-15', '2026-11-16', 'Оренбург', 'Региональный', '5-Р', '2026-11-01', regulation + '2026/chempionat.pdf').lastInsertRowid;
  insertComp.run('ОренКод 2026', 2, 4, 'Чемпионат', 'Региональные', 'смешанный', 'applications_open', '2026-12-10', '2026-12-12', 'Оренбург', 'Региональный', '6-Р', '2026-12-01', regulation + '2026/orencode.pdf');

  const ids = {
    ath: athleteId,
    ath2: athletes.ath2,
    ath3: athletes.ath3,
    ath4: athletes.ath4,
    ath5: athletes.ath5,
    ath6: athletes.ath6,
    ath7: athletes.ath7,
  };
  const insertApp = db.prepare('INSERT INTO applications (competition_id, athlete_user_id, status) VALUES (?, ?, ?)');
  const insertRes = db.prepare('INSERT INTO results (competition_id, athlete_user_id, place, points) VALUES (?, ?, ?, ?)');

  insertApp.run(c2024a, ids.ath, 'approved'); insertRes.run(c2024a, ids.ath, 1, 40);
  insertApp.run(c2024a, ids.ath3, 'approved'); insertRes.run(c2024a, ids.ath3, 2, 30);
  insertApp.run(c2024a, ids.ath2, 'approved'); insertRes.run(c2024a, ids.ath2, 3, 20);
  insertApp.run(c2024b, ids.ath3, 'approved'); insertRes.run(c2024b, ids.ath3, 1, 40);
  insertApp.run(c2024b, ids.ath, 'approved'); insertRes.run(c2024b, ids.ath, 2, 30);
  insertApp.run(c2025a, ids.ath, 'approved'); insertRes.run(c2025a, ids.ath, 1, 40);
  insertApp.run(c2025a, ids.ath2, 'approved'); insertRes.run(c2025a, ids.ath2, 2, 30);
  insertApp.run(c2025a, ids.ath4, 'approved'); insertRes.run(c2025a, ids.ath4, 3, 20);
  insertApp.run(c2025a, ids.ath5, 'approved'); insertRes.run(c2025a, ids.ath5, 4, 10);
  insertApp.run(c2025b, ids.ath5, 'approved'); insertRes.run(c2025b, ids.ath5, 1, 60);
  insertApp.run(c2025b, ids.ath6, 'approved'); insertRes.run(c2025b, ids.ath6, 2, 45);
  insertApp.run(c2026a, ids.ath, 'pending');
  insertApp.run(c2026a, ids.ath2, 'pending');
  insertApp.run(c2026a, ids.ath7, 'pending');

  const insertAssign = db.prepare('INSERT INTO judge_assignments (competition_id, judge_user_id, position) VALUES (?, ?, ?)');
  insertAssign.run(c2025a, judgeId, 'главный судья');
  insertAssign.run(c2024a, judgeId, 'судья');

  db.prepare(`INSERT INTO requests (type, user_id, competition_id, result_id, requested_type, status)
    VALUES ('rank', ?, ?, (SELECT id FROM results WHERE competition_id = ? AND athlete_user_id = ?), 'II', 'pending')`)
    .run(ids.ath, c2024a, c2024a, ids.ath);

  db.prepare(`INSERT INTO requests (type, user_id, requested_type, status)
    VALUES ('judge_category', ?, 'высшая', 'pending')`).run(judgeId);

  const fedApplicantId = createUser({
    login: 'fedreq', fio: 'Орлова Наталья Викторовна', email: 'fedreq@example.ru',
    phone: '+7 912 345-67-89',
  });
  db.prepare(`INSERT INTO requests (type, user_id, requested_type, status)
    VALUES ('federation', ?, 'federation', 'pending')`).run(fedApplicantId);

  console.log('демо-данные загружены');
}

module.exports = { seed };
