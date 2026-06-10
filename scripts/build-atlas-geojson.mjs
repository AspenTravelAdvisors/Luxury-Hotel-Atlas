#!/usr/bin/env node
// build-atlas-geojson.mjs — Base Camp T1
// Re-runnable transform: lib/hotels (data/luxury-hotels.json + hotel-fit.json)
// -> atlas.geojson, the single static payload the Luxury Hotel Atlas frontend
// loads on boot. One CDN-cached request replaces the paginated /api crawl the
// client previously did (13 sequential round trips at the 200-record cap).
//
//   node scripts/build-atlas-geojson.mjs
//
// Run after any change to data/luxury-hotels.json or data/hotel-fit.json and
// commit the output. Idempotent: same inputs always yield byte-identical
// output (stable source ordering, no timestamps).
//
// Feature properties mirror toFeature() in index.html — the shape the atlas UI
// expects — with `fit` trimmed to the fields the UI actually renders, keeping
// the wire size down. hotels.geojson (the raw source dataset) is untouched and
// remains the client's last-resort fallback.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "atlas.geojson");

const require = createRequire(import.meta.url);
const { hotels, getById } = require(resolve(REPO, "lib", "hotels.js"));

// Only the fit fields index.html reads (openDetail + search). Drops the bulky
// authoring-side fields (matchScores, evaluationNotes, searchKeywords, ...).
const FIT_KEYS = [
  "description", "bestFit", "serviceStyle",
  "forbesRating", "aaaDiamondRating", "intentTags",
];

function slimFit(fit) {
  if (!fit) return null;
  const out = {};
  for (const k of FIT_KEYS) if (fit[k] != null) out[k] = fit[k];
  return Object.keys(out).length ? out : null;
}

function toFeature(h) {
  const fit = slimFit(h.fit);
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [h.lng, h.lat] },
    properties: {
      id: h.id, name: h.name, brand: h.brand, program: h.program,
      category: h.category, country: h.country, city: h.city,
      region: h.adminRegion, marqueeRegion: h.region,
      address: h.address, upgrades: h.vipUpgrades,
      bookUrl: h.bookUrl, password: h.bookPassword,
      ...(fit ? { fit } : {}),
    },
  };
}

function main() {
  // getById returns the enriched record (normalized benefits + fit), the same
  // shape /api/luxury-hotels serves, in stable source order.
  const features = hotels.map((h) => toFeature(getById(h.id)));
  const fc = { type: "FeatureCollection", features };
  writeFileSync(OUT, JSON.stringify(fc) + "\n");

  const withFit = features.filter((f) => f.properties.fit).length;
  console.log(`build-atlas-geojson: ${features.length} features -> ${OUT}`);
  console.log(`  with fit data: ${withFit}`);
  console.log(`  without fit:   ${features.length - withFit}`);
}

main();
