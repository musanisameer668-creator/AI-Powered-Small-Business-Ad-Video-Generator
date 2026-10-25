import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT } from './helpers/setup.js';

let t;
after(() => t?.close());

test('TC-11 Gemini never answers: the job FAILS with a message instead of loading forever', async () => {
  t = await boot({ mode: 'hang', env: { TEXT_TIMEOUT_MS: '1500' } });
  const u = await t.signup();
  const started = Date.now();
  const r = await t.api('POST', '/projects', { token: u.token, body: { input: INPUT } });
  assert.equal(r.status, 201);
  assert.ok(Date.now() - started < 1000, 'the request itself returns immediately');
  const p = await t.waitFor(r.body.project.id, u.token, 15000);
  assert.equal(p.status, 'failed');
  assert.match(p.error, /did not answer in time/);
  assert.ok(Date.now() - started < 8000);
  // and the failed ad can be retried in demo mode
  const again = await t.api('POST', `/projects/${p.id}/generate`, { token: u.token, body: { demo: true } });
  assert.equal(again.status, 202);
  const done = await t.waitFor(p.id, u.token);
  assert.equal(done.status, 'ready', done.error);
});
