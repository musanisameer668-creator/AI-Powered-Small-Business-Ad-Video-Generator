# AdMitra

AI video ads for small businesses. Type your shop details in Hindi, English or Hinglish and AdMitra writes the ad copy, plans three scenes, makes promo pictures, records a voiceover and builds a short MP4 for Instagram Reels and WhatsApp Status.

Stack: **React (Vite) · Node.js + Express · MongoDB (optional, local file fallback) · Google Gemini** for text, images and speech · **ffmpeg** for video.

---

## Run it (Windows)

You need **Node.js 18.17 or newer** (https://nodejs.org). Check with `node -v`.

1. Extract the zip. Open the extracted folder so you can see `package.json`, `backend` and `frontend` right inside it.
2. Open PowerShell in that folder and run:

```powershell
npm run setup
copy backend\.env.example backend\.env
npm start
```

3. Open **http://localhost:5000**, create an account and press **New ad**.

Shortcut: double-click `start-windows.bat`. It does the same steps and opens the browser.

The website is already built (`frontend/dist`), so you do not need to build anything.

## Add your free Gemini key

Without a key the app runs in **demo mode** (built-in text and colour slides, so you can still see the whole flow).

1. Go to https://aistudio.google.com/apikey and create a key.
2. In the app open **Settings**, paste it, press **Save key**, then **Test connection**.
   (Or put it in `backend/.env` as `GEMINI_API_KEY=...` and restart.)

## Use MongoDB Atlas (optional)

By default data is saved in `backend/data/db.json`, so nothing needs installing. To use MongoDB:

1. Create a free cluster at https://www.mongodb.com/atlas, add a database user, and under Network Access allow your IP.
2. Copy the connection string into `backend/.env`:
   `MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/admitra`
3. Restart. The terminal shows `Database: MongoDB`. If it cannot connect, it tells you why and falls back to the local file.

## What the video looks like

A dark, cinematic brand ad made on your computer: a headline that slides in line by line, three scenes with a slow camera move, an offer slide with a large number and a self-drawing ring, and a closing card with your name, call-to-action button and city. It has a progress line, soft film grain, smooth cross-fades, the voiceover and a gentle background beat (`MUSIC=off` in `backend/.env` turns the music off). The colour theme follows the tone you pick (Premium gold, Professional blue, Festive amber, Friendly coral, Funny green).

**Product photos** (up to 3, on the first step of the form): 3 photos is best, and all 3 become scenes. With 1 or 2, your photos are used once each and Gemini creates the remaining pictures. With none, Gemini creates 4 pictures (3 scenes plus an opening shot); if some fail they are retried, then free sources are tried (Pollinations AI pictures, then real stock photos), then reused mirrored so the ad never looks empty. If image generation is unavailable for your key, a free backup source is tried, then clean text scenes.

## Why it no longer "just loads"

- Generation runs in the background; the page only polls for progress, so no request can hang.
- Every Gemini call has a hard time limit and no hidden retries. A hung call fails in under a minute with a plain message.
- Pictures: your own photos if you add them, otherwise Gemini image models, then a free keyless source, then clean text-only scenes, so the video is always finished. The reason is listed under **Details > Messages**, and **Settings > Test pictures** shows what works.
- The voiceover tries Gemini, then a backup voice, then continues silently.
- If generation fails you get **Try again** and **Use demo mode instead** buttons.
- A job that was interrupted by a server restart is marked failed on the next start.

## Project layout

```
backend/
  src/
    config/        env loading
    controllers/   auth, projects, settings
    routes/        /api routes
    models/        Mongoose models (User, Project)
    repositories/  MongoDB and local-file storage behind one interface
    middleware/    auth (JWT), validation (zod), upload (multer), rate limit, errors
    validators/    request schemas
    services/
      ai/          Gemini calls, error classification, demo content
      prompt/      prompt builder and output cleanup
      media/       canvas frames, voiceover, ffmpeg video
      generation/  background job and progress
  tests/           automated tests (fake Gemini server)
frontend/
  src/pages        Landing, Login/Register, Dashboard, Create (4 steps), Project, My ads, Settings
dist is the production build served by the backend
```

## Tests

```powershell
npm test
```

18 tests cover registration, login errors, validation, draft saving, generation to a playable MP4, editing, regeneration, access control (403), upload rejection, and Gemini failure cases (never answers, quota, images unavailable). They use a built-in fake Gemini server, so they need no key and no internet.

## Developing the frontend

```powershell
npm --prefix frontend install
npm run dev:api     # terminal 1, API on :5000
npm run dev:web     # terminal 2, site on :5173
npm run build       # rebuild frontend/dist
```
The frontend dev server needs Node 20.19+ or 22+.

## Troubleshooting

| You see | Do this |
|---|---|
| `Port 5000 is already in use` | Set `PORT=5001` in `backend/.env` and restart |
| `Gemini rejected the API key` | Check the key in Settings, then Test connection |
| `free Gemini limit has been reached` | Wait a minute, or use another key |
| `Cannot reach the AdMitra server` | The terminal running `npm start` was closed. Start it again |
| Video has no voice | See Details > Messages. The ad still works |
