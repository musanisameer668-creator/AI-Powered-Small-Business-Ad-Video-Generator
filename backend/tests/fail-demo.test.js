import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT } from './helpers/setup.js';

let t;
after(() => t?.close());

test('no API key: demo mode still produces a finished video', async () => {
  t = await boot({ gemini: false });
  const u = await t.signup();
  const r = await t.api('POST', '/projects', { token: u.token, body: { input: { ...INPUT, language: 'Hindi' } } });
  const p = await t.waitFor(r.body.project.id, u.token);
  assert.equal(p.status, 'ready', p.error);
  assert.equal(p.mode, 'demo');
  assert.ok(p.notes.some((n) => /Demo mode/.test(n)));
  assert.match(p.content.headline, /एकदम अलग/);
});
