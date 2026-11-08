const { catalog, reviewsFor } = require("../lib/buyright");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query && req.query.reviews) return res.status(200).json({ reviews: reviewsFor(String(req.query.reviews)) });
  res.status(200).json(catalog());
};
