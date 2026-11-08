const { load } = require("./_boot");
module.exports = async (req, res) => {
  try {
    const { catalog, reviewsFor } = await load("buyright.js");
    res.setHeader("Cache-Control", "public, max-age=300");
    if (req.query && req.query.reviews) return res.status(200).json({ reviews: reviewsFor(String(req.query.reviews)) });
    res.status(200).json(catalog());
  } catch (e) { res.status(500).json({ error: e.message }); }
};
