const test = require('node:test');
const assert = require('node:assert');
const { daysLeft, expiringSoon } = require('../utils/dates');

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function inDays(count) {
  const date = new Date();
  date.setDate(date.getDate() + count);
  return dateString(date);
}

test('срок через 10 дней -> expiringSoon true', () => {
  assert.strictEqual(expiringSoon(inDays(10)), true);
});

test('срок через 29 дней -> expiringSoon true', () => {
  assert.strictEqual(expiringSoon(inDays(29)), true);
});

test('срок через 30 дней -> expiringSoon false (порог)', () => {
  assert.strictEqual(expiringSoon(inDays(30)), false);
});

test('срок через 60 дней -> expiringSoon false', () => {
  assert.strictEqual(expiringSoon(inDays(60)), false);
});

test('срок вчера -> expiringSoon false (уже истёк)', () => {
  assert.strictEqual(expiringSoon(inDays(-1)), false);
});

test('срок не задан (null) -> expiringSoon false', () => {
  assert.strictEqual(expiringSoon(null), false);
});

test('срок завтра -> daysLeft 1', () => {
  assert.strictEqual(daysLeft(inDays(1)), 1);
});
