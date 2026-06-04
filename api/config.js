// Vercel serverless function — serves the Google Maps key from an env var.
// The key lives in Vercel Project Settings → Environment Variables
// (GOOGLE_MAPS_API_KEY). It is never committed to git.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
};
