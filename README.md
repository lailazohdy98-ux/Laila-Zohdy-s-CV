# Laila Zohdy: Interactive Voice Resume

An interactive executive resume website powered by a real-time **female voice agent** (`gemini-3.8-live`) in English, French, and Arabic, plus a text Q&A assistant (`gemini-4-hydrogen`), grounded in Laila Zohdy's CV.

## Features

- **Real-Time Voice Interview (`gemini-3.8-live`)**: Recruiters can speak directly with Laila's career representative using a composed female voice (`Kore` or `Zephyr`), with barge-in interruption support and live speech transcription in English, French, and Arabic.
- **Written Q&A Mode (`gemini-4-hydrogen`)**: Recruiters can click suggested prompts, click *"Ask assistant about this role"* on any career entry, or type questions directly.
- **Serverless & Full-Stack Ready**: Uses short-lived single-use ephemeral tokens (`/api/live-token`) so your `GEMINI_API_KEY` stays strictly server-side on **Vercel**, **Netlify**, and Node.js servers.
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
3. Start the full-stack dev server:
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

## Deploying to Vercel (GitHub -> Vercel)

This repository includes `vercel.json` and serverless API routes under `/api/*` (`/api/live-token`, `/api/ask`, `/api/health`).

1. Import your GitHub repository in **Vercel** (`Add New... -> Project`).
2. Leave the Build & Output settings as auto-detected from `vercel.json` (`npm run build`, output directory `dist`).
3. Under **Environment Variables**, add:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
4. Click **Deploy** (and redeploy if you add `GEMINI_API_KEY` after the first build).

## Deploying to Netlify (GitHub -> Netlify)

This repository includes `netlify.toml` and serverless functions under `/netlify/functions/*` mapped automatically from `/api/*`.

1. Import your GitHub repository in **Netlify** (`Add new site -> Import an existing project`).
2. Netlify will automatically read `netlify.toml` (`npm run build`, publish `dist`, functions in `netlify/functions`).
3. Go to **Site configuration -> Environment variables** and add:
   - Key: `GEMINI_API_KEY`
   - Value: your Gemini API key
4. Trigger a deploy (**Deploys -> Trigger deploy -> Deploy site**).

## Troubleshooting Deployment

- Make sure `GEMINI_API_KEY` is added in your **Vercel** or **Netlify** project's Environment Variables and that you triggered a fresh deploy after setting it.
- You can verify server configuration by visiting `https://<your-deployed-domain>/api/health` in a browser. It should return `{"ok":true,"configured":true}`.
- Real-time voice requires microphone permission in your browser over HTTPS (both Vercel and Netlify provide HTTPS by default).
