import { useCallback, useRef, useState } from 'react';
export function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef();
  const show = useCallback((m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(''), 2200); }, []);
  const node = <div className={`toast ${msg ? 'on' : ''}`} role="status" aria-live="polite">{msg}</div>;
  return [show, node];
}
