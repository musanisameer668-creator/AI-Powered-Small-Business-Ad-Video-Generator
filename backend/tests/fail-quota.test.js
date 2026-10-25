import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT } from './helpers/setup.js';

let t;
after(() => t?.close());

test('TC-11b quota error is reported in plain words', async () => {
  t = await boot({ mode: 'quota' });
  const u = await t.signup();
  const r = await t.api('POST', '/projects', { token: u.token, body: { input: INPUT } });
  const p = await t.waitFor(r.body.project.id, u.token, 15000);
  assert.equal(p.status, 'failed');
  assert.match(p.error, /free Gemini limit/);
});
