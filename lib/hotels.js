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
const hotelFit = require("../data/hotel-fit.json");

const ci = (s) => String(s == null ? "" : s).toLowerCase().trim();
const keyPart = (s) => ci(s).replace(/[^a-z0-9|]+/g, " ").trim();
const fitKey = (h) => [h.name, h.city, h.country].map(keyPart).join("|");
const fitFor = (h) => hotelFit[fitKey(h)] || null;

function firstPriorityBenefit(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text || /^["']?first priority["']?\b/i.test(text)) return text;
  if (/^room upgrade\b/i.test(text)) return `"First Priority" ${text}`;
  if (/^upgrade\b/i.test(text)) return `"First Priority" ${text}`;
  return text;
}

function normalizedBenefits(h) {
  return Array.isArray(h.vipUpgrades) ? h.vipUpgrades.map(firstPriorityBenefit) : h.vipUpgrades;
}

const INTENT_SCORE = {
  honeymoon: "honeymoon",
  family: "family",
  celebration: "celebration",
  business: "business",
  active: "active",
  expedition: "active",
  adventure: "active",
  uhnw: "uhnw",
  private: "uhnw",
  simple: "simpleVip",
  simplevip: "simpleVip",
  vip: "simpleVip",
};

function enriched(h) {
  const fit = fitFor(h);
  return {
    ...h,
    vipUpgrades: normalizedBenefits(h),
    ...(fit ? { fit } : {}),
  };
}

function ratingLevel(value) {
  if (value == null) return 0;
  const text = ci(value);
  if (Number(value) === 5 || text.includes("five") || text.includes("5")) return 5;
  if (Number(value) === 4 || text.includes("four") || text.includes("4")) return 4;
  return 0;
}

function ratingPriority(h) {
  const fit = fitFor(h) || {};
  return Math.max(ratingLevel(fit.forbesRating), ratingLevel(fit.aaaDiamondRating));
}

function ratingFirst(a, b) {
  return ratingPriority(b) - ratingPriority(a);
}

function overallFit(h) {
  const fit = fitFor(h) || {};
  return Number.isFinite(fit.overallFitScore) ? fit.overallFitScore : 0;
}

// Intent ranking blends the trip-type match score with the Forbes/AAA rating
// (+2 per star level, so a 5-star gets +10). Most of the inventory is unrated,
// and match scores carry ~25 points of real signal, so a clearly better-fit
// property can outrank a mismatched rated one while ratings still break the
// broad middle band.
function intentScore(h, scoreKey) {
  const fit = fitFor(h) || {};
  const match = (fit.matchScores && fit.matchScores[scoreKey]) || 0;
  return match + ratingPriority(h) * 2;
}

// Connector words dropped from free-text `q` so phrases like "Aman in Japan"
// match on the meaningful tokens rather than failing on "in".
const Q_STOPWORDS = new Set([
  "in", "the", "of", "at", "on", "a", "an", "and", "to", "for", "near", "or", "by",
  "hotel", "hotels", "resort", "resorts", "property", "properties", "stay", "stays",
  "luxury", "luxurious", "vip", "virtuoso",
]);

// --- filtering -------------------------------------------------------------
// All params optional and combinable (SPEC §4). Returns the full unpaginated
// match set; pagination is applied separately in query().
function filterHotels(params = {}) {
  const { q, brand, program, category, country, region, bbox, ids, intent } = params;
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
    // Token-AND: every meaningful word must match name/brand/city/country.
    // This lets a phrase like "Aman Japan" match (brand + country) instead of
    // failing as one literal substring. Common connector words are dropped so
    // "Aman in Japan" still works. Single-word queries behave as before.
    const tokens = ci(q).split(/\s+/).filter((t) => t && !Q_STOPWORDS.has(t));
    if (tokens.length) {
      list = list.filter((h) => {
        const fit = fitFor(h) || {};
        const hay = [
          h.name, h.brand, h.city, h.country, h.adminRegion, h.program,
          h.category, fit.bestFit, ...(fit.intentTags || []), fit.serviceStyle,
          fit.evaluationNotes, fit.description, fit.forbesRating,
          fit.aaaDiamondRating ? `AAA ${fit.aaaDiamondRating} Diamond` : null,
          ...(fit.ratingBadges || []).map((r) => r && r.label),
          ...(fit.searchKeywords || []), ...(Array.isArray(h.tags) ? h.tags : []),
        ].map(ci).join(" ");
        return tokens.every((t) => hay.includes(t));
      });
    }
  }
  const scoreKey = INTENT_SCORE[ci(intent).replace(/[^a-z]/g, "")];
  if (scoreKey) {
    list = [...list].sort((a, b) =>
      intentScore(b, scoreKey) - intentScore(a, scoreKey) ||
      ratingFirst(a, b) ||
      overallFit(b) - overallFit(a));
  } else {
    // No intent: ratings lead, then overall fit so equal-rating hotels are
    // ordered by evaluated quality instead of source-file (alphabetical) order.
    list = [...list].sort((a, b) => ratingFirst(a, b) || overallFit(b) - overallFit(a));
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
  const keys = ["region", "brand", "program", "category", "country", "ids", "q", "intent"];
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
  const h = hotels.find((h) => h.id === id) || null;
  return h ? enriched(h) : null;
}

// --- region aggregate (SPEC §4) --------------------------------------------
// Per marquee region: record count + bounding box, so the Living Atlas can show
// "Japan · 39 stays" at its resting state without loading any records.
// bbox order is [minLng, minLat, maxLng, maxLat] to match the `bbox` query param.
function regions() {
  const groups = new Map();
  let unmapped = 0;

  for (const h of hotels) {
    if (h.region == null) { unmapped++; continue; }
    let g = groups.get(h.region);
    if (!g) {
      g = { region: h.region, count: 0, minLng: Infinity, minLat: Infinity, maxLng: -Infinity,
            maxLat: -Infinity, sumSin: 0, sumCos: 0, sumLat: 0 };
      groups.set(h.region, g);
    }
    g.count++;
    if (h.lng < g.minLng) g.minLng = h.lng;
    if (h.lng > g.maxLng) g.maxLng = h.lng;
    if (h.lat < g.minLat) g.minLat = h.lat;
    if (h.lat > g.maxLat) g.maxLat = h.lat;
    // accumulate a circular mean for longitude so regions that straddle the
    // antimeridian (e.g. polynesia, Fiji ~179 and Tahiti ~-149) get a center in
    // the Pacific, not averaged to ~0 off Africa.
    const rad = (h.lng * Math.PI) / 180;
    g.sumSin += Math.sin(rad);
    g.sumCos += Math.cos(rad);
    g.sumLat += h.lat;
  }

  const r6 = (n) => Math.round(n * 1e6) / 1e6;
  const out = [...groups.values()]
    .map((g) => {
      const meanLng = (Math.atan2(g.sumSin / g.count, g.sumCos / g.count) * 180) / Math.PI;
      return {
        region: g.region,
        count: g.count,
        bbox: [g.minLng, g.minLat, g.maxLng, g.maxLat],
        center: [r6(meanLng), r6(g.sumLat / g.count)], // circular-mean lng, mean lat
        deepLink: buildDeepLink({ region: g.region }),
      };
    })
    .sort((a, b) => b.count - a.count);

  const total = out.reduce((n, r) => n + r.count, 0);
  return { total, count: out.length, unmapped, regions: out };
}

// --- full query: filter + paginate + deepLink ------------------------------
function query(params = {}) {
  const matched = filterHotels(params);
  const total = matched.length; // unpaginated match count (SPEC §4)
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);
  const results = matched.slice(offset, offset + limit).map(enriched);
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
  regions,
  ATLAS_URL,
};
