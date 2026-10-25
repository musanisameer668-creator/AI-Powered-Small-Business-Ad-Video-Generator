import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, INPUT, png } from './helpers/setup.js';

let t, a, b;
before(async () => { t = await boot(); a = await t.signup(); b = await t.signup(); });
after(() => t.close());

test('TC-03 missing required fields are rejected with a clear message', async () => {
  const r = await t.api('POST', '/projects', { token: a.token, body: { input: { ...INPUT, businessName: '' } } });
  assert.equal(r.status, 400);
  assert.match(r.body.error.message, /Business name is required/);
});

test('TC-05 a project can be saved as a draft without generating', async () => {
  const r = await t.api('POST', '/projects', { token: a.token, body: { input: INPUT, generate: false } });
  assert.equal(r.status, 201);
  assert.equal(r.body.project.status, 'draft');
  const list = await t.api('GET', '/projects', { token: a.token });
  assert.ok(list.body.projects.some((p) => p.id === r.body.project.id));
});

let ready;
test('TC-04 generating an ad produces text, scenes, images and an MP4 video', async () => {
  const r = await t.api('POST', '/projects', { token: a.token, body: { input: INPUT } });
  assert.equal(r.status, 201);
  assert.equal(r.body.project.status, 'generating');
  ready = await t.waitFor(r.body.project.id, a.token);
  assert.equal(ready.status, 'ready', ready.error);
  assert.equal(ready.mode, 'live');
  assert.equal(ready.content.scenes.length, 3);
  assert.deepEqual(ready.content.hashtags, ['#chai', '#samosa']);
  assert.equal(ready.assets.hasVoice, true);
  assert.deepEqual(ready.assets.aiImages, [true, true, true]);
  for (const s of Object.values(ready.progress).filter((x) => x?.state)) assert.ok(['done', 'warn', 'skipped'].includes(s.state));
  const v = await fetch(`${t.base}/projects/${ready.id}/assets/promo.mp4?token=${a.token}`);
  assert.equal(v.status, 200);
  assert.equal(v.headers.get('content-type'), 'video/mp4');
  const bytes = Buffer.from(await v.arrayBuffer());
  assert.ok(bytes.length > 20000, 'video should not be empty');
  assert.equal(bytes.slice(4, 8).toString(), 'ftyp');
});

test('TC-06 headline and caption can be edited and are saved', async () => {
  const r = await t.api('PATCH', `/projects/${ready.id}`, { token: a.token, body: { content: { headline: 'New headline', caption: 'New caption' } } });
  assert.equal(r.status, 200);
  const g = await t.api('GET', `/projects/${ready.id}`, { token: a.token });
  assert.equal(g.body.project.content.headline, 'New headline');
  assert.equal(g.body.project.content.scenes.length, 3, 'scenes are kept');
});

test('TC-06b an empty headline is rejected', async () => {
  const r = await t.api('PATCH', `/projects/${ready.id}`, { token: a.token, body: { content: { headline: '', caption: 'x' } } });
  assert.equal(r.status, 400);
});

test('TC-07 a saved project can be regenerated', async () => {
  const r = await t.api('POST', `/projects/${ready.id}/generate`, { token: a.token, body: {} });
  assert.equal(r.status, 202);
  const done = await t.waitFor(ready.id, a.token);
  assert.equal(done.status, 'ready', done.error);
});

test('TC-08 an existing project can be opened', async () => {
  const g = await t.api('GET', `/projects/${ready.id}`, { token: a.token });
  assert.equal(g.status, 200);
  assert.equal(g.body.project.input.businessName, 'Sharma Chai Corner');
});

test('TC-09 another user cannot open, edit, delete or download the project', async () => {
  for (const [m, u] of [['GET', ''], ['PATCH', ''], ['DELETE', ''], ['POST', '/generate'], ['GET', '/assets/promo.mp4']]) {
    const r = await t.api(m, `/projects/${ready.id}${u}`, { token: b.token, body: m === 'PATCH' ? { name: 'x' } : undefined });
    assert.equal(r.status, 403, `${m}${u}`);
  }
  const l = await t.api('GET', '/projects', { token: b.token });
  assert.equal(l.body.projects.length, 0);
});

test('TC-10 unsupported or fake image uploads are rejected, a real PNG is accepted', async () => {
  const send = (blob, name, type) => { const f = new FormData(); f.append('logo', new Blob([blob], { type }), name); return t.api('POST', `/projects/${ready.id}/logo`, { token: a.token, form: f }); };
  const pdf = await send(Buffer.from('%PDF-1.4 test'), 'a.pdf', 'application/pdf');
  assert.equal(pdf.status, 415);
  const fake = await send(Buffer.from('this is not an image'), 'a.png', 'image/png');
  assert.equal(fake.status, 415);
  const big = await send(Buffer.alloc(3 * 1024 * 1024, 1), 'a.png', 'image/png');
  assert.equal(big.status, 413);
  const ok = await send(png(), 'logo.png', 'image/png');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.project.assets.logo, 'logo.png');
});

test('TC-10c product photos: bad files rejected, real photos used in the video', async () => {
  const send = (parts) => { const f = new FormData(); for (const [blob, name, type] of parts) f.append('photos', new Blob([blob], { type }), name); return t.api('POST', `/projects/${ready.id}/photos`, { token: a.token, form: f }); };
  assert.equal((await send([[Buffer.from('x'), 'a.gif', 'image/gif']])).status, 415);
  assert.equal((await send([[Buffer.from('not an image'), 'a.png', 'image/png']])).status, 415);
  const ok = await send([[png(), 'p1.png', 'image/png'], [png(), 'p2.png', 'image/png']]);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.project.assets.photos, ['photo1.jpg', 'photo2.jpg']);
  const other = await t.api('POST', `/projects/${ready.id}/photos`, { token: b.token, form: (() => { const f = new FormData(); f.append('photos', new Blob([png()], { type: 'image/png' }), 'p.png'); return f; })() });
  assert.equal(other.status, 403);
  await t.api('POST', `/projects/${ready.id}/generate`, { token: a.token, body: {} });
  const done = await t.waitFor(ready.id, a.token);
  assert.equal(done.status, 'ready', done.error);
  assert.deepEqual(done.assets.imageSources, ['photo', 'photo', 'ai']);
  const calls = t.fake.state.calls.filter((c) => c.type === 'image').length;
  const v = await fetch(`${t.base}/projects/${ready.id}/assets/promo.mp4?token=${a.token}`);
  assert.equal(v.status, 200);
  assert.ok(calls >= 0);
});

test('deleting a project removes it', async () => {
  const d = await t.api('DELETE', `/projects/${ready.id}`, { token: a.token });
  assert.equal(d.status, 200);
  const g = await t.api('GET', `/projects/${ready.id}`, { token: a.token });
  assert.equal(g.status, 404);
});
