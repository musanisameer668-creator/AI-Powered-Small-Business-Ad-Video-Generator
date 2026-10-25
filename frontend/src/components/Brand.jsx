import { Link } from 'react-router-dom';
export default function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="AdMitra home">
      <img src="/favicon.svg" alt="" width="32" height="32" />
      <span>AdMitra</span>
    </Link>
  );
}
