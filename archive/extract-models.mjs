/**
 * Extract models from dashboard.html → seed-data.json
 * Run: node models/extract-models.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("models/dashboard.html", "utf-8");
const start = html.indexOf("const MODELS = [");
const slice = html.slice(start + 17);

// Find matching ];
let depth = 1, end = 0;
for (let i = 0; i < slice.length && depth > 0; i++) {
  if (slice[i] === "[") depth++;
  if (slice[i] === "]") depth--;
  if (depth === 0) { end = i; break; }
}

const models = eval("[" + slice.slice(0, end) + "]");
const seed = models.map((m) => ({
  id: m.id,
  provider: m.provider,
  displayName: m.displayName,
  type: m.type,
  pricing: m.pricing,
  scores: m.scores,
  multimodal: m.multimodal,
  specs: m.specs,
  isActive: m.type !== "deprecated",
  priority: m.priority || 0,
  releaseDate: m.releaseDate || "",
  notes: m.notes || "",
  verified: m.verified !== false,
}));

writeFileSync("models/seed-data.json", JSON.stringify(seed, null, 2));
console.log(`Done. ${seed.length} models → models/seed-data.json`);
