import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Local JSON-file storage. Used when MONGODB_URI is empty, so the app runs with zero setup. */
export function createFileRepository(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'db.json');
  let db = { users: [], projects: [] };
  try {
    if (fs.existsSync(file)) db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch { /* corrupt file: start clean, the old one is overwritten on next save */ }

  let pending = Promise.resolve();
  const save = () => {
    pending = pending.then(() => {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, file);
    }).catch(() => {});
    return pending;
  };
  const id = () => crypto.randomBytes(12).toString('hex');
  const now = () => new Date().toISOString();
  const clone = (o) => (o ? structuredClone(o) : null);

  return {
    kind: 'file',
    async connect() {},
    async flush() { await pending; },
    users: {
      async create(data) {
        const u = { id: id(), createdAt: now(), ...data };
        db.users.push(u); await save(); return clone(u);
      },
      async findByEmail(email) { return clone(db.users.find((u) => u.email === email)); },
      async findById(uid) { return clone(db.users.find((u) => u.id === uid)); },
      async update(uid, patch) {
        const u = db.users.find((x) => x.id === uid); if (!u) return null;
        Object.assign(u, patch); await save(); return clone(u);
      },
    },
    projects: {
      async create(data) {
        const p = { id: id(), createdAt: now(), updatedAt: now(), ...data };
        db.projects.push(p); await save(); return clone(p);
      },
      async listByUser(userId) {
        return db.projects.filter((p) => p.userId === userId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
      },
      async get(pid) { return clone(db.projects.find((p) => p.id === pid)); },
      async update(pid, patch) {
        const p = db.projects.find((x) => x.id === pid); if (!p) return null;
        Object.assign(p, patch, { updatedAt: now() }); await save(); return clone(p);
      },
      async remove(pid) {
        const i = db.projects.findIndex((p) => p.id === pid); if (i < 0) return false;
        db.projects.splice(i, 1); await save(); return true;
      },
      async failStaleJobs(message) {
        let n = 0;
        for (const p of db.projects) if (p.status === 'generating') { p.status = 'failed'; p.error = message; n++; }
        if (n) await save();
        return n;
      },
    },
  };
}
