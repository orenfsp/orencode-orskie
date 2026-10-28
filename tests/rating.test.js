const test = require('node:test');
const assert = require('node:assert');
const { pointsFor, stabilityCoefficient } = require('../ratingPoints');

test('баллы за 1 место на чемпионате России = 100', () => {
  assert.strictEqual(pointsFor('Чемпионат России', 1), 100);
});

test('баллы за 3 место на региональных = 20', () => {
  assert.strictEqual(pointsFor('Региональные', 3), 20);
});

test('баллы за 2 место на межрегиональных = 45', () => {
  assert.strictEqual(pointsFor('Межрегиональные', 2), 45);
});

test('всероссийские считаются как первенство России', () => {
  assert.strictEqual(pointsFor('Всероссийские', 1), 80);
});

test('ЕКП считается как межрегиональные', () => {
  assert.strictEqual(pointsFor('ЕКП', 1), 60);
});

test('неизвестный уровень = 0', () => {
  assert.strictEqual(pointsFor('Неизвестно', 1), 0);
});

test('коэффициент стабильности 1.2 при 2+ призах', () => {
  assert.strictEqual(stabilityCoefficient(2), 1.2);
  assert.strictEqual(stabilityCoefficient(5), 1.2);
});

test('коэффициент стабильности 1 при одном призе', () => {
  assert.strictEqual(stabilityCoefficient(1), 1);
  assert.strictEqual(stabilityCoefficient(0), 1);
});
