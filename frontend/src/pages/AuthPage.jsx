import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';

export default function AuthPage({ mode }) {
  const isReg = mode === 'register';
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (isReg) await register(f); else await login({ email: f.email, password: f.password });
      nav(loc.state?.from || '/dashboard', { replace: true });
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <div className="auth-art">
        <Brand />
        <div>
          <h2>Your shop, on every phone in town.</h2>
          <p>Create scroll-stopping video ads in under two minutes. No editing skills needed.</p>
        </div>
        <small>Made with Google Gemini</small>
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="mobile-only"><Brand /></div>
        <h1>{isReg ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isReg ? 'It takes a few seconds.' : 'Log in to see your ads.'}</p>
        {err && <div className="alert error" role="alert"><Icon name="alert" size={18} />{err}</div>}
        {isReg && <label className="field"><span>Your name</span><input value={f.name} onChange={set('name')} autoComplete="name" placeholder="Jheel Mehta" required /></label>}
        <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required /></label>
        <label className="field"><span>Password</span><input type="password" value={f.password} onChange={set('password')} autoComplete={isReg ? 'new-password' : 'current-password'} placeholder={isReg ? 'At least 6 characters' : 'Your password'} required /></label>
        <button className="btn primary lg block" disabled={busy}>{busy ? <><span className="spinner sm" /> Please wait</> : isReg ? 'Create account' : 'Log in'}</button>
        <p className="swap">{isReg ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}</p>
      </form>
    </div>
  );
}
