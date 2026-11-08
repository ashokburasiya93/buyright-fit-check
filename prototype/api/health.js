const { load } = require("./_boot");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { PROVIDERS } = await load("llm.js"); const { REF } = await load("engine.js");
    res.status(200).json({ ok: true, as_of: REF.as_of, synthetic: true, models: PROVIDERS.map((p, i) => ({ role: i === 0 ? "primary" : "fallback", provider: p.name, model: p.model, configured: !!p.key() })) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};
