import type { IncomingMessage, ServerResponse } from "http";

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse & { status?: (code: number) => typeof res; json?: (data: unknown) => void }
) {
  const payload = JSON.stringify({
    ok: true,
    configured: Boolean(process.env.GEMINI_API_KEY),
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}
