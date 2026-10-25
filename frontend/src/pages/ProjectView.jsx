import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, assetUrl } from '../api.js';
import Icon from '../components/Icon.jsx';
import { StatusBadge } from '../components/ProjectCard.jsx';
import { useToast } from '../components/Toast.jsx';

const STEPS = [
  ['text', 'Write the ad', 'text', 'Headline, caption and script'],
  ['images', 'Create pictures', 'img', 'Three promo images'],
  ['voice', 'Record voiceover', 'mic', 'Narration for the video'],
  ['video', 'Build the video', 'film', 'Join pictures, captions and voice'],
];

export default function ProjectView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('video');
  const [toast, toastNode] = useToast();
  const misses = useRef(0);

  const load = useCallback(async () => {
    try { const r = await api.project(id); misses.current = 0; setErr(''); setP(r.project); return r.project; }
    catch (e) {
      if (e.status === 403 || e.status === 404) { setErr(e.message); return null; }
      misses.current += 1; if (misses.current >= 3) setErr(e.message); return null;
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (p?.status !== 'generating') return undefined;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [p?.status, load]);

  if (err && !p) return <div className="page narrow"><div className="empty"><Icon name="alert" size={34} /><h3>{err}</h3><Link className="btn primary" to="/projects">Back to my ads</Link></div></div>;
  if (!p) return <div className="page"><div className="empty"><span className="spinner" /></div></div>;

  async function regenerate(demo = false) {
    try { const r = await api.generate(p.id, demo); setP(r.project); setTab('video'); } catch (e) { toast(e.message); }
  }
  async function remove() {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try { await api.deleteProject(p.id); nav('/projects'); } catch (e) { toast(e.message); }
  }

  return (
    <div className="page">
      <div className="crumbs"><Link to="/projects">My ads</Link> / <span>{p.name}</span></div>
      <div className="page-head">
        <div>
          <h1>{p.name} <StatusBadge status={p.status} /></h1>
          <p className="muted">{p.input.productName} · {p.input.language} · {p.input.platform} · {p.input.format}</p>
        </div>
        <div className="row gap">
          {p.status !== 'generating' && <button className="btn ghost" onClick={() => regenerate(false)}><Icon name="retry" size={17} /> Generate again</button>}
          {p.status !== 'generating' && <button className="btn ghost danger" onClick={remove}><Icon name="trash" size={17} /> Delete</button>}
        </div>
      </div>
      {err && <div className="alert error"><Icon name="alert" size={18} />{err}</div>}

      {p.status === 'generating' && <Progress p={p} />}
      {p.status === 'draft' && (
        <div className="empty"><Icon name="film" size={34} /><h3>This ad is saved as a draft</h3><p className="muted">Nothing has been generated yet.</p>
          <button className="btn primary" onClick={() => regenerate(false)}><Icon name="spark" size={18} /> Generate my ad</button></div>
      )}
      {p.status === 'failed' && (
        <div className="fail">
          <Icon name="alert" size={28} />
          <div>
            <h3>The ad could not be finished</h3>
            <p>{p.error || 'Something went wrong.'}</p>
            <div className="row gap">
              <button className="btn primary" onClick={() => regenerate(false)}><Icon name="retry" size={17} /> Try again</button>
              <button className="btn ghost" onClick={() => regenerate(true)}>Use demo mode instead</button>
              <Link className="btn ghost" to="/settings">Check API key</Link>
            </div>
          </div>
        </div>
      )}
      {p.status === 'ready' && <Results p={p} setP={setP} tab={tab} setTab={setTab} toast={toast} regenerate={regenerate} />}
      {toastNode}
    </div>
  );
}

function Progress({ p }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = p.progress?.startedAt ? Math.max(0, Math.round((now - p.progress.startedAt) / 1000)) : 0;
  return (
    <div className="card progress" aria-live="polite">
      <div className="row between">
        <h3>Making your ad{p.mode === 'demo' ? ' (demo mode)' : ''}</h3>
        <span className="clock">{secs}s</span>
      </div>
      <ol className="psteps">
        {STEPS.map(([k, title, icon, def]) => {
          const s = p.progress?.[k] || { state: 'pending', detail: '' };
          return (
            <li key={k} className={s.state}>
              <span className="pdot">{s.state === 'active' ? <span className="spinner sm" /> : s.state === 'done' ? <Icon name="check" size={16} /> : s.state === 'warn' ? '!' : s.state === 'skipped' ? '–' : <Icon name={icon} size={16} />}</span>
              <div><b>{title}</b><small>{s.detail || def}</small></div>
            </li>
          );
        })}
      </ol>
      <p className="muted small">You can leave this page. Your ad keeps building and will be in My ads.</p>
    </div>
  );
}

function Results({ p, setP, tab, setTab, toast, regenerate }) {
  const [form, setForm] = useState({ headline: p.content.headline, caption: p.content.caption, cta: p.content.cta || '', narration: p.content.narration || '', hashtags: (p.content.hashtags || []).join(' ') });
  const [saving, setSaving] = useState(false);
  const [upErr, setUpErr] = useState('');
  const [phErr, setPhErr] = useState('');
  async function uploadPh(e) {
    const picked = [...(e.target.files || [])].slice(0, 3); e.target.value = ''; if (!picked.length) return; setPhErr('');
    try { const r = await api.uploadPhotos(p.id, picked); setP(r.project); toast('Photos saved. Generate again to use them.'); } catch (x) { setPhErr(x.message); }
  }
  async function removePh() { try { const r = await api.removePhotos(p.id); setP(r.project); } catch (x) { setPhErr(x.message); } }
  const portrait = p.input.format === 'Portrait Reel';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Could not copy. Select the text and copy it.'); } };

  async function save() {
    setSaving(true);
    try {
      const hashtags = form.hashtags.split(/[\s,]+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`));
      const r = await api.updateProject(p.id, { content: { headline: form.headline, caption: form.caption, cta: form.cta, narration: form.narration, hashtags } });
      setP(r.project); toast('Saved');
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUpErr('');
    try { const r = await api.uploadLogo(p.id, file); setP(r.project); toast('Logo saved. Generate again to add it to the video.'); } catch (x) { setUpErr(x.message); }
  }
  const full = `${form.headline}\n\n${form.caption}\n\n${form.cta}\n\n${form.hashtags}`.replace(/\n{3,}/g, '\n\n').trim();

  return (
    <>
      <div className="tabs" role="tablist">
        {[['video', 'Video'], ['copy', 'Ad copy'], ['story', 'Storyboard'], ['details', 'Details']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'video' && (
        <div className="video-grid">
          <div className={`player ${portrait ? 'portrait' : ''}`}>
            <video key={p.updatedAt} controls playsInline preload="metadata" poster={assetUrl(p.id, p.assets.images[0])} src={assetUrl(p.id, p.assets.video)} />
          </div>
          <div className="card side-card">
            <h3>{form.headline}</h3>
            <p className="pre">{p.content.caption}</p>
            <div className="row gap wrap">
              <a className="btn primary" href={assetUrl(p.id, p.assets.video, true)} download><Icon name="download" size={18} /> Download MP4</a>
              <button className="btn ghost" onClick={() => copy(full, 'Ad text')}><Icon name="copy" size={17} /> Copy ad text</button>
            </div>
            {!p.assets.hasVoice && <div className="alert info"><Icon name="mic" size={18} />This video has no voiceover. See Details for the reason.</div>}
            {p.mode === 'demo' && <div className="alert info"><Icon name="spark" size={18} /><div>Demo mode ad. <Link to="/settings">Add a Gemini key</Link> for AI pictures and voice.</div></div>}
          </div>
        </div>
      )}

      {tab === 'copy' && (
        <div className="card form">
          <label className="field"><span>Headline</span><input value={form.headline} onChange={set('headline')} maxLength={120} /></label>
          <label className="field"><span>Caption</span><textarea rows={5} value={form.caption} onChange={set('caption')} maxLength={1200} /></label>
          <div className="two">
            <label className="field"><span>Call to action</span><input value={form.cta} onChange={set('cta')} maxLength={120} /></label>
            <label className="field"><span>Hashtags</span><input value={form.hashtags} onChange={set('hashtags')} /></label>
          </div>
          <label className="field"><span>Voiceover script<em>Read aloud in the video</em></span><textarea rows={3} value={form.narration} onChange={set('narration')} maxLength={1200} /></label>
          <p className="muted small">Edits here change the text you copy. To change what is spoken or shown in the video, edit and then choose Generate again.</p>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => copy(full, 'Ad text')}><Icon name="copy" size={17} /> Copy all</button>
            <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving' : 'Save changes'}</button>
          </div>
        </div>
      )}

      {tab === 'story' && (
        <div className="scenes">
          {p.content.scenes.map((s, i) => (
            <figure key={i} className="scene">
              <div className={`scene-img ${p.input.format === 'Landscape Video' ? 'wide' : p.input.format === 'Square Post' ? 'sq' : ''}`}>
                <img src={assetUrl(p.id, p.assets.images[i])} alt={`Scene ${i + 1}`} loading="lazy" />
                <span className="tag">{p.assets.imageSources?.[i] === 'photo' ? 'Your photo' : p.assets.aiImages?.[i] ? 'AI picture' : 'Text scene'}</span>
              </div>
              <figcaption><b>Scene {i + 1}</b><span>{s.caption}</span><small>{s.imagePrompt}</small>
                <a className="link" href={assetUrl(p.id, p.assets.images[i], true)} download>Download picture</a></figcaption>
            </figure>
          ))}
        </div>
      )}

      {tab === 'details' && (
        <div className="details">
          <div className="card">
            <h3>How this ad was made</h3>
            <dl className="review">
              <div><dt>Mode</dt><dd>{p.mode === 'live' ? 'Gemini (live)' : 'Demo (no API key)'}</dd></div>
              <div><dt>Pictures</dt><dd>{p.assets.photos?.length ? 'Your photos' : `${p.assets.aiImages?.filter(Boolean).length || 0} of 3 from AI`}</dd></div>
              <div><dt>Voiceover</dt><dd>{p.assets.hasVoice ? p.assets.voiceSource : 'None'}</dd></div>
              {STEPS.map(([k, t]) => <div key={k}><dt>{t}</dt><dd>{p.progress?.[k]?.detail || p.progress?.[k]?.state}</dd></div>)}
            </dl>
            <h4>Messages</h4>
            {p.notes.length ? <ul className="notes">{p.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : <p className="muted small">Everything worked. No problems were reported.</p>}
          </div>
          <div className="card">
            <h3>Your product photos</h3>
            <p className="muted small">Up to 3 PNG, JPG or WEBP photos. They replace AI pictures in the video the next time you generate.</p>
            {p.assets.photos?.length > 0 && <div className="photos">{p.assets.photos.map((n) => <div key={n} className="photo"><img src={assetUrl(p.id, n)} alt="Product" /></div>)}</div>}
            {phErr && <div className="alert error" role="alert"><Icon name="alert" size={18} />{phErr}</div>}
            <div className="row gap wrap">
              <label className="btn ghost file"><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={uploadPh} />{p.assets.photos?.length ? 'Replace photos' : 'Choose photos'}</label>
              {p.assets.photos?.length > 0 && <button className="btn ghost danger" onClick={removePh}>Remove photos</button>}
            </div>
          </div>
          <div className="card">
            <h3>Your logo</h3>
            <p className="muted small">PNG or JPG, up to 2 MB. It appears on the closing card the next time you generate.</p>
            {p.assets.logo && <img className="logo-prev" src={assetUrl(p.id, p.assets.logo)} alt="Uploaded logo" />}
            {upErr && <div className="alert error" role="alert"><Icon name="alert" size={18} />{upErr}</div>}
            <label className="btn ghost file"><input type="file" accept="image/png,image/jpeg" onChange={upload} />Choose image</label>
            <div className="row gap" style={{ marginTop: 16 }}>
              <button className="btn primary" onClick={() => regenerate(false)}><Icon name="retry" size={17} /> Generate again</button>
              <button className="btn ghost" onClick={() => regenerate(true)}>Generate in demo mode</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
