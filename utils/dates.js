/* Работа с датами: разбор строки, локальная дата, остаток дней. */

function parseDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function todayLocal(now) {
  const value = now || new Date();
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysLeft(until, now) {
  const target = parseDate(until);
  if (!target) return null;
  return Math.round((target - todayLocal(now)) / (1000 * 60 * 60 * 24));
}

function expiringSoon(until, now) {
  const left = daysLeft(until, now);
  return left !== null && left < 30 && left >= 0;
}

module.exports = { parseDate, todayLocal, daysLeft, expiringSoon };
