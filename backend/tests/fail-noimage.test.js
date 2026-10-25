import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT } from './helpers/setup.js';

let t;
after(() => t?.close());

test('images unavailable: the video is still built from designed graphics and says why', async () => {
  t = await boot({ mode: 'noimage', env: { FREE_IMAGE_URL: 'off', STOCK_IMAGE_URL: 'off' } });
  const u = await t.signup();
  const r = await t.api('POST', '/projects', { token: u.token, body: { input: INPUT } });
  const p = await t.waitFor(r.body.project.id, u.token, 40000);
  assert.equal(p.status, 'ready', p.error);
  assert.deepEqual(p.assets.aiImages, [false, false, false]);
  assert.deepEqual(p.assets.imageSources, ['none', 'none', 'none']);
  assert.equal(p.progress.images.state, 'done');
  assert.ok(p.notes.some((n) => /Pictures/.test(n)));
});
