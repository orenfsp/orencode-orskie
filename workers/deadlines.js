const cron = require('node-cron');
const { db } = require('../db');
const { notify, notifyFederation } = require('../notifications');
const { daysLeft } = require('../utils/dates');

/*
 * Проверяет сроки и создает уведомления.
 * Вызывается по расписанию и вручную из кабинета федерации.
 */
function runDeadlineCheck() {
  const result = { ranks: 0, categories: 0, deadlines: 0 };

  const users = db.prepare('SELECT id, rank_type, rank_until, category, category_until FROM users').all();

  users.forEach((user) => {
    if (user.rank_until) {
      const left = daysLeft(user.rank_until);
      if (left !== null && left >= 0 && left <= 30) {
        notify(user.id, 'rank_expiring',
          'Разряд ' + (user.rank_type || '') + ' истекает ' + user.rank_until + ' (осталось ' + left + ' дн.)');
        result.ranks += 1;
      }
    }

    if (user.category_until) {
      const left = daysLeft(user.category_until);
      if (left !== null && left >= 0 && left <= 30) {
        notify(user.id, 'category_expiring',
          'Судейская категория "' + (user.category || '') + '" истекает ' + user.category_until +
          ' (осталось ' + left + ' дн.)');
        result.categories += 1;
      }
    }
  });

  const competitions = db.prepare(`
    SELECT id, name, applications_deadline
    FROM competitions
    WHERE status = 'applications_open' AND applications_deadline IS NOT NULL
  `).all();

  competitions.forEach((competition) => {
    const left = daysLeft(competition.applications_deadline);
    if (left !== null && left >= 0 && left <= 7) {
      notifyFederation('deadline_soon',
        'До закрытия приема заявок на "' + competition.name + '" осталось ' + left + ' дн.');
      result.deadlines += 1;
    }
  });

  return result;
}

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 9 * * *', () => {
    try {
      const result = runDeadlineCheck();
      console.log('[cron] проверка сроков: разряды ' + result.ranks +
        ', категории ' + result.categories + ', дедлайны ' + result.deadlines);
    } catch (error) {
      console.error('[cron] ошибка проверки сроков:', error.message);
    }
  });

  console.log('cron запущен: ежедневная проверка сроков в 9:00');
}

module.exports = { runDeadlineCheck };
