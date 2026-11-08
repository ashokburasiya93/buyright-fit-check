const { ask } = require("../lib/buyright");
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try { const b = body(req); res.status(200).json(await ask(String(b.product_id || ""), b.profile || {}, b.question)); }
  catch (e) { console.error("ask_error", e.message, e.details || ""); res.status(503).json({ state: "error", answer: "The AI models are unavailable right now. Please try again in a minute. No answer was guessed." }); }
};
