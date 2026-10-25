import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import Icon from '../components/Icon.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.projects().then((r) => setItems(r.projects)).catch((e) => setErr(e.message));
    api.settings().then(setStatus).catch(() => {});
  }, []);

  const ready = items?.filter((p) => p.status === 'ready').length ?? 0;
  const first = user?.name?.split(' ')[0];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Namaste, {first}</h1>
          <p className="muted">Here is what is happening with your ads.</p>
        </div>
        <Link className="btn primary" to="/create"><Icon name="plus" size={18} /> New ad</Link>
      </div>

      {status?.mode === 'demo' && (
        <div className="alert info">
          <Icon name="spark" size={18} />
          <div>Demo mode is on because no Gemini API key is set. Ads use built-in text and text-only scenes. <Link to="/settings">Add your free key</Link> for AI text, pictures and voice.</div>
        </div>
      )}
      {err && <div className="alert error"><Icon name="alert" size={18} />{err}</div>}

      <div className="stats">
        <div className="stat"><small>Total ads</small><b>{items?.length ?? '–'}</b></div>
        <div className="stat"><small>Videos ready</small><b>{items ? ready : '–'}</b></div>
        <div className="stat"><small>AI engine</small><b className="sm">{status ? (status.mode === 'live' ? 'Gemini' : 'Demo') : '–'}</b></div>
        <div className="stat"><small>Storage</small><b className="sm">{status ? (status.database === 'mongodb' ? 'MongoDB' : 'Local file') : '–'}</b></div>
      </div>

      <div className="section-head"><h2>Recent ads</h2>{items?.length > 3 && <Link to="/projects">View all</Link>}</div>
      {items === null && !err && <div className="empty"><span className="spinner" /></div>}
      {items?.length === 0 && (
        <div className="empty">
          <Icon name="film" size={34} />
          <h3>No ads yet</h3>
          <p className="muted">Tell us about your shop and get your first video in about two minutes.</p>
          <Link className="btn primary" to="/create">Create your first ad</Link>
        </div>
      )}
      <div className="grid">{items?.slice(0, 6).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
    </div>
  );
}
