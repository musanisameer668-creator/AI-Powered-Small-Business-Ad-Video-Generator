const KEY = 'admitra_token';
export const getToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

export class ApiFail extends Error {
  constructor(message, status = 0, code = '', details) { super(message); this.status = status; this.code = code; this.details = details; }
}

/** fetch wrapper: always has a time limit and always throws a readable message. */
async function request(method, url, { body, form, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method, signal: ctrl.signal,
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new ApiFail(e.name === 'AbortError'
      ? 'The server took too long to answer. Please try again.'
      : 'Cannot reach the AdMitra server. Make sure it is running, then try again.');
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) throw new ApiFail(data?.error?.message || `Request failed (${res.status}).`, res.status, data?.error?.code, data?.error?.details);
  return data;
}

export const api = {
  register: (b) => request('POST', '/auth/register', { body: b }),
  login: (b) => request('POST', '/auth/login', { body: b }),
  me: () => request('GET', '/auth/me'),
  projects: () => request('GET', '/projects'),
  project: (id) => request('GET', `/projects/${id}`),
  createProject: (input, generate = true) => request('POST', '/projects', { body: { input, generate } }),
  updateProject: (id, body) => request('PATCH', `/projects/${id}`, { body }),
  generate: (id, demo = false) => request('POST', `/projects/${id}/generate`, { body: { demo } }),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),
  uploadLogo: (id, file) => { const f = new FormData(); f.append('logo', file); return request('POST', `/projects/${id}/logo`, { form: f, timeout: 30000 }); },
  uploadPhotos: (id, files) => { const f = new FormData(); files.forEach((x) => f.append('photos', x)); return request('POST', `/projects/${id}/photos`, { form: f, timeout: 60000 }); },
  removePhotos: (id) => request('DELETE', `/projects/${id}/photos`),
  settings: () => request('GET', '/settings/status'),
  saveKey: (key) => request('PUT', '/settings/key', { body: { key } }),
  testImages: () => request('POST', '/settings/test-images', { timeout: 90000 }),
  testKey: () => request('POST', '/settings/test', { timeout: 30000 }),
};

export const assetUrl = (id, name, download = false) => `/api/projects/${id}/assets/${name}?token=${encodeURIComponent(getToken())}${download ? '&download=1' : ''}`;
