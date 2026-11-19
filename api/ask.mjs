import { generateResumeAnswer } from "../shared/resumeAssistant.mjs";

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
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      sendJson(res, 400, { error: "Please enter a question to ask." });
      return;
    }

    const answer = await generateResumeAnswer({
      apiKey,
      question,
      history: Array.isArray(body?.history) ? body.history : [],
      language: typeof body?.language === "string" ? body.language : "en",
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
