const test = require('node:test');
const assert = require('node:assert');
const { isAgeInGroup } = require('../validation');

function birthYearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

test('14-летний проходит в группу 14-17', () => {
  assert.strictEqual(isAgeInGroup(birthYearsAgo(14), 14, 17), true);
});

test('13-летний не проходит в группу 14-17', () => {
  assert.strictEqual(isAgeInGroup(birthYearsAgo(13), 14, 17), false);
});

test('22-летний не проходит в группу 18-21', () => {
  assert.strictEqual(isAgeInGroup(birthYearsAgo(22), 18, 21), false);
});

test('18-летний проходит в группу 18-21', () => {
  assert.strictEqual(isAgeInGroup(birthYearsAgo(18), 18, 21), true);
});

test('без даты рождения ограничение не применяется', () => {
  assert.strictEqual(isAgeInGroup(null, 14, 17), true);
});
