const { check } = require("../lib/buyright");
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try { const b = body(req); res.status(200).json(await check(String(b.product_id || ""), b.profile || {}, { explain: b.explain !== false })); }
  catch (e) { console.error("check_error", e.message); res.status(500).json({ state: "error", error: "Something went wrong. No verdict was guessed." }); }
};
