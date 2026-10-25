import { Link } from 'react-router-dom';
import { assetUrl } from '../api.js';
import Icon from './Icon.jsx';

const LABEL = { draft: 'Draft', generating: 'Generating', ready: 'Ready', failed: 'Failed' };
export const StatusBadge = ({ status }) => <span className={`badge ${status}`}>{status === 'generating' && <span className="spinner sm" />}{LABEL[status] || status}</span>;

export default function ProjectCard({ p, onDelete }) {
  const thumb = p.status === 'ready' && p.assets?.images?.[0];
  return (
    <article className="pcard">
      <Link to={`/projects/${p.id}`} className={`thumb ${p.input?.format === 'Landscape Video' ? 'wide' : ''}`} aria-label={`Open ${p.name}`}>
        {thumb ? <img src={assetUrl(p.id, thumb)} alt="" loading="lazy" /> : <div className="thumb-empty"><Icon name="film" size={28} /></div>}
      </Link>
      <div className="pcard-body">
        <div className="row between">
          <h3>{p.name}</h3>
          <StatusBadge status={p.status} />
        </div>
        <p className="muted">{p.input?.productName}</p>
        <div className="row between">
          <small className="muted">{new Date(p.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {p.input?.language}</small>
          {onDelete && <button className="icon-btn danger" aria-label={`Delete ${p.name}`} onClick={() => onDelete(p)}><Icon name="trash" size={17} /></button>}
        </div>
      </div>
    </article>
  );
}
