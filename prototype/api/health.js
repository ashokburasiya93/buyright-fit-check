const { PROVIDERS } = require("../lib/llm");
const { REF } = require("../lib/engine");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, as_of: REF.as_of, synthetic: true, models: PROVIDERS.map((p, i) => ({ role: i === 0 ? "primary" : "fallback", provider: p.name, model: p.model, configured: !!p.key() })) });
};
