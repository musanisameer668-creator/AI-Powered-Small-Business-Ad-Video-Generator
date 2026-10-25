import fs from 'node:fs';
import { env } from './config/env.js';
import { initRepository, getRepo } from './repositories/index.js';
import { createApp } from './app.js';

const { warning } = await initRepository();
fs.mkdirSync(env.STORAGE_DIR, { recursive: true });
const stale = await getRepo().projects.failStaleJobs('Generation was interrupted when the server restarted. Please generate again.');

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log('');
  console.log(`  AdMitra is running:  http://localhost:${env.PORT}`);
  console.log(`  Database:            ${getRepo().kind === 'mongodb' ? 'MongoDB' : 'local file (backend/data/db.json)'}`);
  console.log(`  Gemini:              ${env.GEMINI_API_KEY ? 'API key found' : 'no server key (demo mode until you add one in Settings or .env)'}`);
  if (warning) console.log(`  Warning:             ${warning}`);
  if (stale) console.log(`  Cleaned up ${stale} interrupted job(s).`);
  console.log('');
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${env.PORT} is already in use. Close the other app or set PORT in backend/.env.` : e);
  process.exit(1);
});
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
