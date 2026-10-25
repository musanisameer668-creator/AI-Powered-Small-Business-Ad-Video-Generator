import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Shell from './components/Shell.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateProject from './pages/CreateProject.jsx';
import ProjectView from './pages/ProjectView.jsx';
import Projects from './pages/Projects.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="boot"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/create" element={<Protected><CreateProject /></Protected>} />
      <Route path="/projects" element={<Protected><Projects /></Protected>} />
      <Route path="/projects/:id" element={<Protected><ProjectView /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
