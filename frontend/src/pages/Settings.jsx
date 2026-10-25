import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';

export default function Settings() {
  const { refresh } = useAuth();
  const [s, setS] = useState(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState('');
  const [imgTest, setImgTest] = useState(null);
  async function checkImages() {
    setBusy('img'); setImgTest(null);
    try { setImgTest(await api.testImages()); } catch (e) { setImgTest({ error: e.message }); } finally { setBusy(''); }
  }

  const load = () => api.settings().then(setS).catch((e) => setMsg({ kind: 'error', text: e.message }));
  useEffect(() => { load(); }, []);

  async function save(value) {
    setBusy('save'); setMsg(null);
    try { await api.saveKey(value); setKey(''); await load(); await refresh(); setMsg({ kind: 'ok', text: value ? 'Key saved to your account.' : 'Your saved key was removed.' }); }
    catch (e) { setMsg({ kind: 'error', text: e.message }); } finally { setBusy(''); }
  }
  async function check() {
    setBusy('test'); setTest(null);
    try { setTest(await api.testKey()); } catch (e) { setTest({ ok: false, message: e.message }); } finally { setBusy(''); }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><div><h1>Settings</h1><p className="muted">Connect Gemini to switch from demo mode to real AI.</p></div></div>
      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'error'}`} role="status"><Icon name={msg.kind === 'ok' ? 'check' : 'alert'} size={18} />{msg.text}</div>}

      <div className="card">
        <div className="row between"><h3>Gemini API key</h3>
          {s && <span className={`badge ${s.mode === 'live' ? 'ready' : 'draft'}`}>{s.mode === 'live' ? 'Connected' : 'Demo mode'}</span>}</div>
        <p className="muted small">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>, paste it below and save. {s?.keySource === 'server' && 'A key is already set on the server in backend/.env.'}</p>
        <label className="field"><span>API key</span><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s?.keySource === 'account' ? 'A key is saved. Paste a new one to replace it.' : 'AIza…'} autoComplete="off" /></label>
        <div className="row gap wrap">
          <button className="btn primary" disabled={!key.trim() || busy} onClick={() => save(key.trim())}>{busy === 'save' ? 'Saving' : 'Save key'}</button>
          <button className="btn ghost" disabled={!!busy} onClick={check}>{busy === 'test' ? <><span className="spinner sm" /> Testing</> : 'Test connection'}</button>
          {s?.keySource === 'account' && <button className="btn ghost danger" disabled={!!busy} onClick={() => save('')}>Remove saved key</button>}
        </div>
        {test && <div className={`alert ${test.ok ? 'ok' : 'error'}`} role="status"><Icon name={test.ok ? 'check' : 'alert'} size={18} />{test.ok ? `Connected. ${test.model} answered.` : test.message}</div>}
      </div>

      <div className="card">
        <h3>Test pictures</h3>
        <p className="muted small">Checks whether Gemini and the free backup source can make a picture right now, and shows the exact reason if not. Takes up to a minute.</p>
        <div className="row gap"><button className="btn ghost" disabled={!!busy} onClick={checkImages}>{busy === 'img' ? <><span className="spinner sm" /> Testing</> : 'Test pictures'}</button></div>
        {imgTest?.error && <div className="alert error"><Icon name="alert" size={18} />{imgTest.error}</div>}
        {imgTest && !imgTest.error && [['Gemini pictures', imgTest.gemini], ['Free backup source', imgTest.free]].map(([n, r]) => (
          <div key={n} className={`alert ${r.ok ? 'ok' : 'error'}`}><Icon name={r.ok ? 'check' : 'alert'} size={18} /><div><b>{n}:</b> {r.ok ? 'works.' : 'not working.'} <span style={{ wordBreak: 'break-word' }}>{r.detail}</span></div></div>
        ))}
      </div>

      <div className="card">
        <h3>This installation</h3>
        <dl className="review">
          <div><dt>Database</dt><dd>{s ? (s.database === 'mongodb' ? 'MongoDB' : 'Local file (backend/data/db.json)') : '–'}</dd></div>
          <div><dt>Text model</dt><dd>{s?.textModel || '–'}</dd></div>
          <div><dt>Image models</dt><dd>{s?.imageModels?.join(', ') || '–'}</dd></div>
          <div><dt>Voice models</dt><dd>{s?.ttsModels?.join(', ') || '–'}</dd></div>
        </dl>
      </div>
    </div>
  );
}
