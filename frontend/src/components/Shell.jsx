import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Brand from './Brand.jsx';
import Icon from './Icon.jsx';

const NAV = [
  ['/dashboard', 'Dashboard', 'home'],
  ['/create', 'New ad', 'plus'],
  ['/projects', 'My ads', 'folder'],
  ['/settings', 'Settings', 'gear'],
];

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="shell">
      <aside className="side">
        <Brand to="/dashboard" />
        <nav aria-label="Main">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon name={icon} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <span className="avatar">{initials}</span>
          <div className="who"><b>{user?.name}</b><small>{user?.email}</small></div>
          <button className="icon-btn" title="Log out" aria-label="Log out" onClick={() => { logout(); nav('/'); }}><Icon name="out" size={18} /></button>
        </div>
      </aside>
      <main className="main">
        <header className="mobile-bar">
          <Brand to="/dashboard" />
          <button className="icon-btn" aria-label="Log out" onClick={() => { logout(); nav('/'); }}><Icon name="out" size={18} /></button>
        </header>
        {children}
      </main>
    </div>
  );
}
