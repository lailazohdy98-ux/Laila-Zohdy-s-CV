export const handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
    }),
  };
};
