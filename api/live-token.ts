import type { IncomingMessage, ServerResponse } from "http";
import { mintLiveVoiceToken } from "../shared/resumeAssistant";

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function readBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}") as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
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
      voice: body.voice,
      lang: body.lang,
    });
    sendJson(res, 200, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create voice token.";
    sendJson(res, 500, { error: message });
  }
}
