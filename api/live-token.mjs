import { mintLiveVoiceToken } from "../shared/resumeAssistant.mjs";

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: "GEMINI_API_KEY is not configured in Vercel Environment Variables.",
    });
    return;
  }

  try {
    const body = await readBody(req);
    const result = await mintLiveVoiceToken({
      apiKey,
      voice: body?.voice,
      lang: body?.lang,
    });
    sendJson(res, 200, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create voice token.";
    sendJson(res, 500, { error: message });
  }
}
