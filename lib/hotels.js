// lib/hotels.js — Base Camp T2
// Shared in-memory query layer over data/luxury-hotels.json. Consumed by the
// serverless functions in api/. Pure functions, no I/O beyond the one-time
// JSON load, so it is unit-testable without an HTTP server.
//
// Lives outside api/ on purpose: anything under api/ becomes a Vercel route.
//
// The static require inlines the JSON into each function bundle at build time,
// which keeps a filtered query well under the 300ms budget (SPEC §8) with no
// cold filesystem read. Clean seam for a later Supabase swap: replace the
// `hotels` source and keep these signatures intact.

const hotels = require("../data/luxury-hotels.json");

const ci = (s) => String(s == null ? "" : s).toLowerCase().trim();

// --- filtering -------------------------------------------------------------
// All params optional and combinable (SPEC §4). Returns the full unpaginated
// match set; pagination is applied separately in query().
function filterHotels(params = {}) {
  const { q, brand, program, category, country, region, bbox, ids } = params;
  let list = hotels;

  if (ids != null && String(ids).trim() !== "") {
    const set = new Set(String(ids).split(",").map((s) => s.trim()).filter(Boolean));
    list = list.filter((h) => set.has(h.id));
  }
  if (brand)    { const v = ci(brand);    list = list.filter((h) => ci(h.brand) === v); }
  if (program)  { const v = ci(program);  list = list.filter((h) => ci(h.program) === v); }
  if (category) { const v = ci(category); list = list.filter((h) => ci(h.category) === v); }
  if (country)  { const v = ci(country);  list = list.filter((h) => ci(h.country) === v); }
  if (region)   { const v = ci(region);   list = list.filter((h) => ci(h.region) === v); }

  if (bbox != null && String(bbox).trim() !== "") {
    const p = String(bbox).split(",").map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) {
      const [minLng, minLat, maxLng, maxLat] = p;
      list = list.filter(
        (h) => h.lng >= minLng && h.lng <= maxLng && h.lat >= minLat && h.lat <= maxLat
      );
    }
  }
  if (q != null && String(q).trim() !== "") {
    const v = ci(q);
    list = list.filter(
      (h) =>
        ci(h.name).includes(v) ||
        ci(h.brand).includes(v) ||
        ci(h.city).includes(v) ||
        ci(h.country).includes(v)
    );
  }
  return list;
}

// --- pagination bounds (SPEC §4: limit default 50, hard cap 200) -----------
function clampLimit(raw) {
  let n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) n = 50;
  if (n > 200) n = 200;
  return n;
}
function clampOffset(raw) {
  let n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) n = 0;
  return n;
}

// --- deep link (SPEC §4 + §7) ----------------------------------------------
// Prebuilt chat-to-atlas handoff. Only the params the atlases parse on load
// are forwarded; pagination/bbox are intentionally omitted.
const ATLAS_URL =
  process.env.ATLAS_HOTEL_URL || "https://luxury-hotel-atlas-two.vercel.app";

function buildDeepLink(params = {}) {
  const keys = ["region", "brand", "program", "category", "country", "ids", "q"];
  const usp = new URLSearchParams();
  for (const k of keys) {
    const val = params[k];
    if (val != null && String(val).trim() !== "") usp.set(k, String(val).trim());
  }
  const qs = usp.toString();
  return qs ? `${ATLAS_URL}?${qs}` : ATLAS_URL;
}

// --- single record ---------------------------------------------------------
function getById(id) {
  return hotels.find((h) => h.id === id) || null;
}

// --- full query: filter + paginate + deepLink ------------------------------
function query(params = {}) {
  const matched = filterHotels(params);
  const total = matched.length; // unpaginated match count (SPEC §4)
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);
  const results = matched.slice(offset, offset + limit);
  return { total, count: results.length, results, deepLink: buildDeepLink(params) };
}

module.exports = {
  hotels,
  filterHotels,
  clampLimit,
  clampOffset,
  buildDeepLink,
  getById,
  query,
  ATLAS_URL,
};
