import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT } from './helpers/setup.js';

let t;
after(() => t?.close());


test('Gemini image models missing: free source fills the pictures', async () => {
  t = await boot({ mode: 'noimage' });
  const u = await t.signup();
  const r = await t.api('POST', '/projects', { token: u.token, body: { input: INPUT } });
  const p = await t.waitFor(r.body.project.id, u.token, 40000);
  assert.equal(p.status, 'ready', p.error);
  assert.deepEqual(p.assets.aiImages, [true, true, true]);
  assert.ok(p.notes.some((n) => /free backup source/.test(n)));
});
