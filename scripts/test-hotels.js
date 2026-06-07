// scripts/test-hotels.js — Base Camp T2 tests
// No framework. Run: node scripts/test-hotels.js
// Cross-checks the in-memory query layer against the raw data, then exercises
// the actual serverless handlers with mock req/res.

const assert = require("node:assert/strict");
const {
  hotels,
  filterHotels,
  clampLimit,
  query,
  buildDeepLink,
  getById,
  regions,
  ATLAS_URL,
} = require("../lib/hotels");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

const ci = (s) => String(s == null ? "" : s).toLowerCase();
const countRaw = (pred) => hotels.filter(pred).length;

// --- dataset sanity --------------------------------------------------------
test("dataset loaded (2500, unique ids)", () => {
  assert.equal(hotels.length, 2500);
  assert.equal(new Set(hotels.map((h) => h.id)).size, 2500);
});

// --- pagination ------------------------------------------------------------
test("no params: total=2500, default limit 50", () => {
  const r = query({});
  assert.equal(r.total, 2500);
  assert.equal(r.count, 50);
  assert.equal(r.results.length, 50);
});

test("limit hard cap at 200", () => {
  assert.equal(clampLimit(500), 200);
  assert.equal(clampLimit(0), 50);
  assert.equal(clampLimit("abc"), 50);
  assert.equal(query({ limit: 9999 }).results.length, 200);
});

test("offset paginates without overlap", () => {
  const a = query({ limit: 10, offset: 0 }).results.map((h) => h.id);
  const b = query({ limit: 10, offset: 10 }).results.map((h) => h.id);
  assert.equal(new Set([...a, ...b]).size, 20);
  // total stays unpaginated
  assert.equal(query({ limit: 10, offset: 10 }).total, 2500);
});

// --- single-axis filters (cross-checked against raw counts) ----------------
test("country=Japan", () => {
  const expect = countRaw((h) => ci(h.country) === "japan");
  const r = query({ country: "Japan", limit: 200 });
  assert.equal(r.total, expect);
  assert.ok(r.results.every((h) => h.country === "Japan"));
});

test("region=japan (marquee key)", () => {
  const expect = countRaw((h) => h.region === "japan");
  const r = query({ region: "japan", limit: 200 });
  assert.equal(r.total, expect);
  assert.ok(r.results.every((h) => h.region === "japan"));
});

test("brand=aman is case-insensitive", () => {
  const expect = countRaw((h) => ci(h.brand) === "aman");
  const r = query({ brand: "aman", limit: 200 });
  assert.equal(r.total, expect);
  assert.ok(expect > 0);
  assert.ok(r.results.every((h) => h.brand === "Aman"));
});

test("program=Virtuoso", () => {
  const expect = countRaw((h) => ci(h.program) === "virtuoso");
  assert.equal(query({ program: "Virtuoso" }).total, expect);
});

test('category="City Hotel"', () => {
  const expect = countRaw((h) => h.category === "City Hotel");
  assert.equal(query({ category: "City Hotel" }).total, expect);
});

test("q free-text matches name/brand/city/country", () => {
  const r = query({ q: "aman", limit: 200 });
  assert.ok(r.total > 0);
  assert.ok(
    r.results.every(
      (h) =>
        ci(h.name).includes("aman") ||
        ci(h.brand).includes("aman") ||
        ci(h.city).includes("aman") ||
        ci(h.country).includes("aman")
    )
  );
});

test("q multi-word is token-AND with stopwords dropped", () => {
  // single token unchanged
  assert.ok(query({ q: "aman" }).total > 0);
  // phrase: every meaningful token must match some field
  const phrase = query({ q: "Aman Japan", limit: 200 });
  assert.ok(phrase.total > 0);
  assert.ok(phrase.results.every((h) => ci(h.brand).includes("aman") && ci(h.country).includes("japan")));
  // connector word "in" must not break it
  assert.equal(query({ q: "Aman in Japan" }).total, phrase.total);
  // a token that matches nothing yields nothing
  assert.equal(query({ q: "Aman Narnia" }).total, 0);
});

test("bbox returns only in-box records", () => {
  const box = "139,35,140,36"; // Tokyo-ish
  const r = query({ bbox: box, limit: 200 });
  assert.ok(
    r.results.every((h) => h.lng >= 139 && h.lng <= 140 && h.lat >= 35 && h.lat <= 36)
  );
  // matches a raw recompute
  const expect = countRaw(
    (h) => h.lng >= 139 && h.lng <= 140 && h.lat >= 35 && h.lat <= 36
  );
  assert.equal(r.total, expect);
});

test("ids returns exactly the requested shortlist", () => {
  const ids = `${hotels[10].id},${hotels[1000].id}`;
  const r = query({ ids });
  assert.equal(r.total, 2);
  assert.deepEqual(new Set(r.results.map((h) => h.id)), new Set(ids.split(",")));
});

// --- combined filters ------------------------------------------------------
test("country + category + region combine (AND)", () => {
  const expect = countRaw(
    (h) =>
      ci(h.country) === "italy" &&
      h.category === "City Hotel" &&
      h.region === "mediterranean"
  );
  const r = query({
    country: "Italy",
    category: "City Hotel",
    region: "mediterranean",
    limit: 200,
  });
  assert.equal(r.total, expect);
  assert.ok(
    r.results.every(
      (h) =>
        h.country === "Italy" &&
        h.category === "City Hotel" &&
        h.region === "mediterranean"
    )
  );
});

test("filter with no matches returns empty, total 0", () => {
  const r = query({ country: "Atlantis" });
  assert.equal(r.total, 0);
  assert.equal(r.count, 0);
  assert.deepEqual(r.results, []);
});

// --- deep link -------------------------------------------------------------
test("deepLink forwards atlas params, drops pagination/bbox", () => {
  const dl = buildDeepLink({
    region: "japan",
    brand: "Aman",
    limit: 50,
    offset: 10,
    bbox: "1,2,3,4",
  });
  assert.ok(dl.startsWith(ATLAS_URL + "?"));
  assert.ok(dl.includes("region=japan"));
  assert.ok(dl.includes("brand=Aman"));
  assert.ok(!dl.includes("limit"));
  assert.ok(!dl.includes("bbox"));
  assert.equal(buildDeepLink({}), ATLAS_URL);
});

test("query() embeds a deepLink", () => {
  assert.equal(query({ region: "japan" }).deepLink, `${ATLAS_URL}?region=japan`);
});

// --- single record ---------------------------------------------------------
test("getById valid + invalid", () => {
  assert.equal(getById("h_00001").id, "h_00001");
  assert.equal(getById("nope_id"), null);
});

// --- region aggregate ------------------------------------------------------
test("regions(): counts reconcile with per-record region tally", () => {
  const agg = regions();
  const mapped = countRaw((h) => h.region != null);
  assert.equal(agg.total, mapped);
  assert.equal(agg.unmapped, hotels.length - mapped);
  assert.equal(agg.total + agg.unmapped, 2500);
  // each region's count matches a raw recount, and bbox bounds every member
  for (const r of agg.regions) {
    const members = hotels.filter((h) => h.region === r.region);
    assert.equal(r.count, members.length);
    const [minLng, minLat, maxLng, maxLat] = r.bbox;
    assert.ok(
      members.every(
        (h) => h.lng >= minLng && h.lng <= maxLng && h.lat >= minLat && h.lat <= maxLat
      ),
      `bbox bounds all ${r.region} members`
    );
    assert.ok(r.deepLink.includes(`region=${r.region}`));
  }
  // sorted by count desc
  for (let i = 1; i < agg.regions.length; i++) {
    assert.ok(agg.regions[i - 1].count >= agg.regions[i].count);
  }
});

// --- handler-level smoke (mock req/res) ------------------------------------
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

test("handler GET /api/luxury-hotels (country=Japan)", () => {
  const handler = require("../api/luxury-hotels.js");
  const res = mockRes();
  handler({ method: "GET", query: { country: "Japan", limit: "5" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/json");
  assert.equal(res.body.results.length, 5);
  assert.ok(res.body.total >= 5);
  assert.ok(res.body.deepLink.includes("country=Japan"));
});

test("handler rejects non-GET with 405", () => {
  const handler = require("../api/luxury-hotels.js");
  const res = mockRes();
  handler({ method: "POST", query: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("handler GET /api/luxury-hotels/:id valid + 404", () => {
  const handler = require("../api/luxury-hotels/[id].js");
  const ok = mockRes();
  handler({ method: "GET", query: { id: "h_00001" } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.id, "h_00001");

  const miss = mockRes();
  handler({ method: "GET", query: { id: "nope" } }, miss);
  assert.equal(miss.statusCode, 404);
});

test("handler GET /api/regions", () => {
  const handler = require("../api/regions.js");
  const res = mockRes();
  handler({ method: "GET", query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.regions));
  assert.ok(res.body.regions.length > 0);
  assert.ok(res.body.regions[0].bbox.length === 4);
});

console.log(`\n${passed} tests passed`);
