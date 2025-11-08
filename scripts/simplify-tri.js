// scripts/simplify-tri.js
// Preprocess raw EPA TRI data into simplified schema for visualization

const fs = require('fs');

const inputFile = process.argv[2] || 'data/tri-pa_raw.json';
const outputFile = process.argv[3] || 'data/tri.json';

console.log(`📂 Reading from ${inputFile}`);
console.log(`📄 Will write simplified output to ${outputFile}`);

let rawText = fs.readFileSync(inputFile, 'utf8');
if (rawText.charCodeAt(0) === 0xFEFF) rawText = rawText.slice(1);
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

// --- Normalize keys: strip numeric prefixes, trim, uppercase ---
function normalizeRow(row) {
  const normalized = {};
  for (const k of Object.keys(row)) {
    const cleanKey = k.replace(/^\d+\.\s*/, '').trim().toUpperCase();
    const val = (row[k] || "").toString().trim();
    normalized[cleanKey] = val;
  }
  return normalized;
}

function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// --- Transform into simplified schema ---
const simplified = raw.map(row => {
  const n = normalizeRow(row);

  // Use actual EPA headers
  const fugitive = toNum(n["5.1 - FUGITIVE AIR"]);
  const stack = toNum(n["5.2 - STACK AIR"]);
  const water = toNum(n["5.3 - WATER"]);
  const land = toNum(n["5.4 - UNDERGROUND"]) +
    toNum(n["5.5.1 - LANDFILLS"]) +
    toNum(n["5.5.2 - LAND TREATMENT"]) +
    toNum(n["5.5.3 - SURFACE IMPNDMNT"]) +
    toNum(n["5.5.4 - OTHER DISPOSAL"]);

  // Prefer ON-SITE RELEASE TOTAL if present
  const onsiteTotal = toNum(n["ON-SITE RELEASE TOTAL"]);
  const offsiteTotal = toNum(n["OFF-SITE RELEASE TOTAL"]);

  const totalRelease = onsiteTotal || (fugitive + stack + water + land) + offsiteTotal;

  return {
    facility: n["FACILITY NAME"] || "Unknown Facility",
    chemical: n["CHEMICAL"] || "Unknown Chemical",
    release_lbs: totalRelease,
    year: n["YEAR"] || 2023
  };
});

fs.writeFileSync(outputFile, JSON.stringify(simplified, null, 2));
console.log(`✅ Simplified TRI data written to ${outputFile} (${simplified.length} records)`);
