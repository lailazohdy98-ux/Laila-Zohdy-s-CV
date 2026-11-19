import { mintLiveVoiceToken } from "../../shared/resumeAssistant.mjs";

export const handler = async (event) => {
  const headers = { "Content-Type": "application/json; charset=utf-8" };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "GEMINI_API_KEY is not configured in Netlify Environment Variables.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const result = await mintLiveVoiceToken({
      apiKey,
      voice: body?.voice,
      lang: body?.lang,
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create voice token.";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: message }),
    };
  }
};
