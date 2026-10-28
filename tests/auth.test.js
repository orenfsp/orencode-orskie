const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = 'test-secret-for-tests';

test('JWT: sign -> verify возвращает тот же sub', () => {
  const token = jwt.sign({ sub: 42 }, SECRET, { expiresIn: '1h' });
  const payload = jwt.verify(token, SECRET);
  assert.strictEqual(payload.sub, 42);
});

test('JWT: чужой секрет -> ошибка', () => {
  const token = jwt.sign({ sub: 42 }, SECRET, { expiresIn: '1h' });
  assert.throws(() => jwt.verify(token, 'wrong-secret'));
});

test('JWT: просроченный токен -> ошибка', () => {
  const token = jwt.sign({ sub: 42, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
  assert.throws(() => jwt.verify(token, SECRET));
});

test('JWT: битый токен -> ошибка', () => {
  assert.throws(() => jwt.verify('not.a.token', SECRET));
});

test('bcrypt: hash -> compare с правильным паролем true', () => {
  const hash = bcrypt.hashSync('123', 10);
  assert.strictEqual(bcrypt.compareSync('123', hash), true);
});

test('bcrypt: hash -> compare с неправильным паролем false', () => {
  const hash = bcrypt.hashSync('123', 10);
  assert.strictEqual(bcrypt.compareSync('456', hash), false);
});

test('bcrypt: два хеша одного пароля разные (соль)', () => {
  const h1 = bcrypt.hashSync('123', 10);
  const h2 = bcrypt.hashSync('123', 10);
  assert.notStrictEqual(h1, h2);
});