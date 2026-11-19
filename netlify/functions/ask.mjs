import { generateResumeAnswer } from "../../shared/resumeAssistant.mjs";

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
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Please enter a question to ask." }),
      };
    }

    const answer = await generateResumeAnswer({
      apiKey,
      question,
      history: Array.isArray(body?.history) ? body.history : [],
      language: typeof body?.language === "string" ? body.language : "en",
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to generate answer.";
    const friendly =
      raw.includes("503") || raw.includes("UNAVAILABLE")
        ? "The text Q&A service is experiencing a temporary spike in demand. Please try again in a moment, or start a live voice interview."
        : raw;
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: friendly }),
    };
  }
};
