// scripts/simplify-tri.js
// Preprocess raw EPA TRI data into simplified schema for visualization

const fs = require('fs');

// --- Resolve input/output paths ---
const inputFile = process.argv[2] || 'data/tri-pa_raw.json';
const outputFile = process.argv[3] || 'data/tri.json';

console.log(`📂 Reading from ${inputFile}`);
console.log(`📄 Will write simplified output to ${outputFile}`);

// --- Load raw file safely ---
let rawText = fs.readFileSync(inputFile, 'utf8');

// Strip BOM if present
if (rawText.charCodeAt(0) === 0xFEFF) {
  rawText = rawText.slice(1);
}

// Remove any leading non‑JSON characters (e.g. BOM artifacts like ��)
while (rawText.length > 0 && rawText[0] !== '[' && rawText[0] !== '{') {
  rawText = rawText.slice(1);
}

let raw;
try {
  raw = JSON.parse(rawText);
} catch (err) {
  console.error(`❌ Failed to parse ${inputFile}:`, err.message);
  process.exit(1);
}

// --- Flatten helper ---
function flattenRecord(record) {
  const flat = {};
  for (const key of Object.keys(record)) {
    const inner = record[key];
    if (inner && typeof inner === 'object') {
      const innerKeyRaw = Object.keys(inner)[0];
      const innerKey = innerKeyRaw.trim(); // trim spaces around the key
      flat[innerKey] = inner[innerKeyRaw];
    }
  }
  return flat;
}

// --- Transform into simplified schema ---
const simplified = raw.map(record => {
  const flat = flattenRecord(record);

  const fugitive = Number(flat["FUGITIVE TOT REL"]) || 0;
  const stack = Number(flat["STACK TOT REL"]) || 0;
  const air = Number(flat["AIR TOTAL RELEASE"]) || 0;
  const water = Number(flat["WATER TOTAL RELEASE"]) || 0;
  const land = Number(flat["LAND TOTAL RELEASE"]) || 0;

  const totalRelease = fugitive + stack + air + water + land;

  return {
    facility: flat["FACILITY NAME"] || "Unknown Facility",
    chemical: flat["CHEMICAL"] || "Unknown Chemical",
    release_lbs: totalRelease,
    year: flat["YEAR"] || 2023
  };
});

// --- Write simplified file ---
fs.writeFileSync(outputFile, JSON.stringify(simplified, null, 2));
console.log(`✅ Simplified TRI data written to ${outputFile} (${simplified.length} records)`);
