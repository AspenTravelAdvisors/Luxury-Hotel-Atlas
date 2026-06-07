// GET /api/luxury-hotels/:id — Base Camp T2
// Returns one full normalized record, or 404. SPEC §4.

const { getById } = require("../../lib/hotels");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let id = (req.query && req.query.id) || "";
  if (Array.isArray(id)) id = id[0];
  id = String(id);

  const rec = getById(id);
  if (!rec) {
    res.status(404).json({ error: "Not found", id });
    return;
  }
  res.status(200).json(rec);
};
