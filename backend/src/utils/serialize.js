export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, hasOwnKey: !!u.geminiKey });
export const publicProject = (p) => ({
  id: p.id, name: p.name, status: p.status, input: p.input, content: p.content, progress: p.progress,
  assets: p.assets || {}, notes: p.notes || [], error: p.error || '', mode: p.mode || '',
  createdAt: p.createdAt, updatedAt: p.updatedAt,
});
