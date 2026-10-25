import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProjectCard from '../components/ProjectCard.jsx';
import Icon from '../components/Icon.jsx';

export default function Projects() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.projects().then((r) => setItems(r.projects)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function del(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try { await api.deleteProject(p.id); setItems((l) => l.filter((x) => x.id !== p.id)); } catch (e) { setErr(e.message); }
  }
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>My ads</h1><p className="muted">Every ad you have made, newest first.</p></div>
        <Link className="btn primary" to="/create"><Icon name="plus" size={18} /> New ad</Link>
      </div>
      {err && <div className="alert error"><Icon name="alert" size={18} />{err}</div>}
      {items === null && !err && <div className="empty"><span className="spinner" /></div>}
      {items?.length === 0 && <div className="empty"><Icon name="folder" size={34} /><h3>Nothing here yet</h3><p className="muted">Your finished ads will show up here.</p></div>}
      <div className="grid">{items?.map((p) => <ProjectCard key={p.id} p={p} onDelete={del} />)}</div>
    </div>
  );
}
