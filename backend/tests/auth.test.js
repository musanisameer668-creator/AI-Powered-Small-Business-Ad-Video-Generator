import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './helpers/setup.js';

let t;
before(async () => { t = await boot({ gemini: false }); });
after(() => t.close());

test('TC-01 registration and login work', async () => {
  const r = await t.api('POST', '/auth/register', { body: { name: 'Jheel', email: 'Jheel@Test.com', password: 'secret12' } });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  const l = await t.api('POST', '/auth/login', { body: { email: 'jheel@test.com', password: 'secret12' } });
  assert.equal(l.status, 200);
  const me = await t.api('GET', '/auth/me', { token: l.body.token });
  assert.equal(me.body.user.email, 'jheel@test.com');
  assert.equal(me.body.user.passwordHash, undefined);
});

test('TC-01b duplicate email is rejected', async () => {
  const r = await t.api('POST', '/auth/register', { body: { name: 'X', email: 'jheel@test.com', password: 'secret12' } });
  assert.equal(r.status, 409);
});

test('TC-02 wrong password is rejected', async () => {
  const r = await t.api('POST', '/auth/login', { body: { email: 'jheel@test.com', password: 'nope-nope' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.message, 'Incorrect email or password.');
});

test('requests without a token are refused', async () => {
  const r = await t.api('GET', '/projects');
  assert.equal(r.status, 401);
});
