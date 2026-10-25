import { env } from '../config/env.js';
import { createFileRepository } from './fileRepository.js';
import { createMongoRepository } from './mongoRepository.js';

let repo = null;
export const getRepo = () => {
  if (!repo) throw new Error('Database not ready');
  return repo;
};
export const setRepo = (r) => { repo = r; };

/** MongoDB when MONGODB_URI is set (falls back to local file if it cannot connect), otherwise local file. */
export async function initRepository() {
  if (env.MONGODB_URI) {
    try {
      const m = createMongoRepository(env.MONGODB_URI);
      await m.connect();
      repo = m;
      return { repo, warning: '' };
    } catch (e) {
      repo = createFileRepository(env.DATA_DIR);
      return { repo, warning: `MongoDB connection failed (${e.message}). Using local file storage instead.` };
    }
  }
  repo = createFileRepository(env.DATA_DIR);
  return { repo, warning: '' };
}
