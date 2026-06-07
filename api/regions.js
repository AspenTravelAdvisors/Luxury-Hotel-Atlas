// GET /api/regions — Base Camp T3
// Per-marquee-region count + bbox for the Living Atlas resting state. The map
// calls this on load to show "Japan · 39 stays" without fetching records.
// SPEC §4. Response: { total, count, unmapped, regions: [ { region, count,
// bbox, center, deepLink } ] }, sorted by count desc.

const { regions } = require("../lib/hotels");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.status(200).json(regions());
};
