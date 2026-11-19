# Laila Zohdy: Interactive Voice Resume

An interactive executive resume website powered by a real-time **female voice agent** (`gemini-3.8-live`) in English, French, and Arabic, plus a text Q&A assistant (`gemini-4-hydrogen`), grounded in Laila Zohdy's CV.

## Features

- **Real-Time Voice Interview (`gemini-3.8-live`)**: Recruiters can speak directly with Laila's career representative using a composed female voice (`Kore` or `Zephyr`), with barge-in interruption support and live speech transcription.
- **Written Q&A Mode (`gemini-4-hydrogen`)**: Recruiters can click suggested prompts, click *"Ask assistant about this role"* on any career entry, or type questions directly.
- **Editorial CV Presentation**: Clean pastel porcelain palette, `Cormorant Garamond` + `Plus Jakarta Sans` typography, role filtering, and direct PDF CV download.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example` and add your Gemini API key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```
3. Start the full-stack dev server (Express + WebSocket + Vite):
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Laila Zohdy interactive voice resume"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> Make sure `.env` is listed in `.gitignore` (already configured) so your `GEMINI_API_KEY` is never committed.

## Deployment Notes (GitHub -> Cloud Hosting)

Because real-time voice streaming uses a persistent **WebSocket server (`/live`)** inside `server.ts` (so your `GEMINI_API_KEY` stays strictly server-side), choose a host that supports persistent Node.js processes and WebSockets:

- **Recommended (Native WebSocket + Node Support)**: **Render**, **Railway**, **Fly.io**, or **Google Cloud Run**.
  - Connect your GitHub repository.
  - Build Command: `npm run build`
  - Start Command: `npm start` (runs `node server.ts` with `NODE_ENV=production`)
  - Environment Variables: set `GEMINI_API_KEY` and `NODE_ENV=production`.
- **Important note on Netlify / Vercel**: Standard Netlify and Vercel deployments use stateless serverless functions and static CDN hosting, which **do not support persistent long-lived WebSocket servers** required by the Gemini Live API audio bridge. If you host the frontend on Vercel or Netlify, deploy `server.ts` on Render/Railway/Cloud Run and point the WebSocket/API URLs to that backend.
