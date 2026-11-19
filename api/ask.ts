import type { IncomingMessage, ServerResponse } from "http";
import { generateResumeAnswer } from "../shared/resumeAssistant";

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
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      sendJson(res, 400, { error: "Please enter a question to ask." });
      return;
    }

    const answer = await generateResumeAnswer({
      apiKey,
      question,
      history: Array.isArray(body.history) ? body.history : [],
      language: typeof body.language === "string" ? body.language : "en",
    });

    sendJson(res, 200, { answer });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to generate answer.";
    const friendly =
      raw.includes("503") || raw.includes("UNAVAILABLE")
        ? "The text Q&A service is experiencing a temporary spike in demand. Please try again in a moment, or start a live voice interview."
        : raw;
    sendJson(res, 500, { error: friendly });
  }
}
