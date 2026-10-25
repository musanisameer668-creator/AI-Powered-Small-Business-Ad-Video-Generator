import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';

const GOALS = ['Product Promotion', 'Festival Offer', 'New Shop Launch', 'Brand Awareness', 'Discount Sale'];
const TONES = ['Friendly and energetic', 'Professional', 'Festive', 'Premium', 'Funny'];
const PLATFORMS = ['Instagram', 'WhatsApp Status', 'Facebook', 'YouTube Shorts'];
const FORMATS = [['Portrait Reel', '9:16', 'Reels, Status, Shorts'], ['Square Post', '1:1', 'Feed posts'], ['Landscape Video', '16:9', 'YouTube, Facebook']];
const LANGS = [['Hinglish', 'Hindi words, English letters'], ['Hindi', 'हिंदी'], ['English', 'Simple Indian English']];
const STEPS = ['Product details', 'Target audience', 'Ad preferences', 'Generate'];

const EMPTY = {
  businessName: '', productName: '', description: '', usp: '', offer: '', city: '',
  audience: '', language: 'Hinglish', goal: GOALS[0], tone: TONES[0], platform: PLATFORMS[0], format: FORMATS[0][0],
};
const EXAMPLE = {
  businessName: 'Bean & Bloom Café', productName: 'Cold Coffee', description: 'Thick cold coffee blended with ice cream and chocolate',
  usp: 'Made with fresh beans, no artificial syrup', offer: 'Buy 1 Get 1 free on Fridays', city: 'Mumbai',
  audience: 'College students and young professionals', language: 'Hinglish', goal: 'Product Promotion', tone: 'Friendly and energetic', platform: 'Instagram', format: 'Portrait Reel',
};

export default function CreateProject() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [files, setFiles] = useState([]);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  function addFiles(e) {
    const picked = [...(e.target.files || [])]; e.target.value = '';
    const bad = picked.find((f) => !/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 8 * 1024 * 1024);
    if (bad) { setErr(`"${bad.name}" cannot be used. Choose PNG, JPG or WEBP photos up to 8 MB.`); return; }
    setErr(''); setFiles([...files, ...picked].slice(0, 3));
  }
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }); };
  const pick = (k, v) => setF({ ...f, [k]: v });

  function next() {
    if (step === 0) {
      const e = {};
      if (!f.businessName.trim()) e.businessName = 'Business name is required.';
      if (!f.productName.trim()) e.productName = 'Product or service is required.';
      if (Object.keys(e).length) return setErrors(e);
    }
    setStep(step + 1);
  }

  async function generate() {
    setBusy(true); setErr('');
    try {
      if (!files.length) { const r = await api.createProject(f, true); nav(`/projects/${r.project.id}`); return; }
      const r = await api.createProject(f, false);
      await api.uploadPhotos(r.project.id, files);
      await api.generate(r.project.id, false);
      nav(`/projects/${r.project.id}`);
    } catch (e) {
      setErr(e.message);
      if (e.details) { setErrors(e.details); setStep(0); }
    } finally { setBusy(false); }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div><h1>Create a new ad</h1><p className="muted">Four short steps. You can write in Hindi, English or Hinglish.</p></div>
        <button className="btn ghost" type="button" onClick={() => { setF(EXAMPLE); setErrors({}); }}>Fill an example</button>
      </div>

      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)}>
              <span className="dot">{i < step ? <Icon name="check" size={14} /> : i + 1}</span><span className="lbl">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card form">
        {step === 0 && (
          <>
            <div className="two">
              <Field label="Business name" error={errors.businessName}><input value={f.businessName} onChange={set('businessName')} placeholder="Sharma Chai Corner" maxLength={80} /></Field>
              <Field label="Product or service" error={errors.productName}><input value={f.productName} onChange={set('productName')} placeholder="Masala chai and samosa" maxLength={80} /></Field>
            </div>
            <Field label="Short description" hint="Optional"><textarea rows={3} value={f.description} onChange={set('description')} placeholder="Garma garam chai, taaza samosa" maxLength={500} /></Field>
            <Field label="What makes it special?" hint="Optional"><input value={f.usp} onChange={set('usp')} placeholder="Fresh every morning, no preservatives" maxLength={300} /></Field>
            <div className="two">
              <Field label="Offer or discount" hint="Optional"><input value={f.offer} onChange={set('offer')} placeholder="2 chai pe 1 samosa free" maxLength={120} /></Field>
              <Field label="City" hint="Optional"><input value={f.city} onChange={set('city')} placeholder="Mumbai" maxLength={60} /></Field>
            </div>
            <div className="field">
              <span>Your product photos<em>Optional, up to 3. Best results</em></span>
              <div className="photos">
                {previews.map((u, i) => (
                  <div key={u} className="photo"><img src={u} alt={`Photo ${i + 1}`} /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></div>
                ))}
                {files.length < 3 && <label className="photo add"><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addFiles} /><Icon name="img" size={22} /><small>Add photo</small></label>}
              </div>
              <small className="muted">Add up to 3 photos of your shop or products (3 is best). With fewer, AI creates the missing pictures. With none, AI creates all of them.</small>
              {err && step === 0 && <small className="err">{err}</small>}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Who is this ad for?" hint="Optional"><input value={f.audience} onChange={set('audience')} placeholder="College students and young professionals" maxLength={200} /></Field>
            <div className="chips">
              {['College students', 'Families', 'Office workers', 'Women', 'Senior citizens'].map((c) => <button type="button" key={c} className="chip" onClick={() => pick('audience', c)}>{c}</button>)}
            </div>
            <fieldset className="choice"><legend>Language of the ad</legend>
              <div className="options">
                {LANGS.map(([v, d]) => <Option key={v} on={f.language === v} onClick={() => pick('language', v)} title={v} sub={d} />)}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Campaign goal"><select value={f.goal} onChange={set('goal')}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <div className="two">
              <Field label="Tone"><select value={f.tone} onChange={set('tone')}>{TONES.map((g) => <option key={g}>{g}</option>)}</select></Field>
              <Field label="Platform"><select value={f.platform} onChange={set('platform')}>{PLATFORMS.map((g) => <option key={g}>{g}</option>)}</select></Field>
            </div>
            <fieldset className="choice"><legend>Video shape</legend>
              <div className="options">
                {FORMATS.map(([v, r, d]) => <Option key={v} on={f.format === v} onClick={() => pick('format', v)} title={v} sub={`${r} · ${d}`} />)}
              </div>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="review-title">Check your details</h3>
            <dl className="review">
              {[['Business', f.businessName], ['Product', f.productName], ['Offer', f.offer], ['City', f.city], ['Audience', f.audience], ['Language', f.language], ['Goal', f.goal], ['Tone', f.tone], ['Platform', `${f.platform} · ${f.format}`]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <p className="muted small">Gemini will write the ad, then make three pictures and a voiceover. This usually takes one to two minutes, and you will see each step as it happens.</p>
            {err && <div className="alert error" role="alert"><Icon name="alert" size={18} />{err}</div>}
          </>
        )}

        <div className="form-actions">
          <button type="button" className="btn ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</button>
          {step < 3
            ? <button type="button" className="btn primary" onClick={next}>Continue</button>
            : <button type="button" className="btn primary lg" disabled={busy} onClick={generate}>{busy ? <><span className="spinner sm" /> Starting</> : <><Icon name="spark" size={18} /> Generate my ad</>}</button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span>{label}{hint && <em>{hint}</em>}</span>
      {children}
      {error && <small className="err">{error}</small>}
    </label>
  );
}
function Option({ on, onClick, title, sub }) {
  return <button type="button" className={`option ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}><b>{title}</b><small>{sub}</small></button>;
}
