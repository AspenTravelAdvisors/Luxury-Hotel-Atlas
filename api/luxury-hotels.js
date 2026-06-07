// GET /api/luxury-hotels — Base Camp T2
// Filter, search, paginate over the normalized hotel inventory. Returns
// { total, count, results, deepLink } per SPEC §4. Inventory lives behind /api,
// never bundled into a client (SPEC architecture rule).

const { query } = require("../lib/hotels");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Vercel pre-parses the query string. Collapse any repeated params to scalars.
  const raw = req.query || {};
  const params = {};
  for (const k of Object.keys(raw)) {
    params[k] = Array.isArray(raw[k]) ? raw[k][0] : raw[k];
  }

  res.status(200).json(query(params));
};
