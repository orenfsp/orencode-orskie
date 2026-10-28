const test = require('node:test');
const assert = require('node:assert');
const { requireRole, ensureSelf, badRequest, conflict, notFound } = require('../auth/permissions');

test('requireRole: разрешённая роль не бросает', () => {
  const req = { user: { activeRole: 'athlete' } };
  assert.doesNotThrow(() => requireRole(req, ['athlete', 'coach']));
});

test('requireRole: запрещённая роль бросает 403', () => {
  const req = { user: { activeRole: 'judge' } };
  assert.throws(
    () => requireRole(req, ['athlete', 'coach']),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('requireRole: activeRole null бросает 403', () => {
  const req = { user: { activeRole: null } };
  assert.throws(
    () => requireRole(req, ['athlete']),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('requireRole: activeRole undefined бросает 403', () => {
  const req = { user: { activeRole: undefined } };
  assert.throws(
    () => requireRole(req, ['federation']),
    (err) => err.status === 403
  );
});

test('requireRole: federation для федерации ок', () => {
  const req = { user: { activeRole: 'federation' } };
  assert.doesNotThrow(() => requireRole(req, ['federation']));
});

test('requireRole: athlete без роли federation в списке', () => {
  const req = { user: { activeRole: 'athlete' } };
  assert.throws(
    () => requireRole(req, ['federation']),
    (err) => err.status === 403
  );
});

test('ensureSelf: свой id не бросает', () => {
  const req = { user: { id: 5 } };
  assert.doesNotThrow(() => ensureSelf(req, 5));
});

test('ensureSelf: чужой id бросает 403', () => {
  const req = { user: { id: 5 } };
  assert.throws(
    () => ensureSelf(req, 7),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('badRequest: 400 и код BAD_REQUEST', () => {
  const err = badRequest('плохо');
  assert.strictEqual(err.status, 400);
  assert.strictEqual(err.code, 'BAD_REQUEST');
  assert.strictEqual(err.message, 'плохо');
});

test('conflict: 409 и код CONFLICT', () => {
  const err = conflict('уже есть');
  assert.strictEqual(err.status, 409);
  assert.strictEqual(err.code, 'CONFLICT');
});

test('notFound: 404 и код NOT_FOUND', () => {
  const err = notFound();
  assert.strictEqual(err.status, 404);
  assert.strictEqual(err.code, 'NOT_FOUND');
});