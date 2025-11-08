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

// --- Transform into simplified schema ---
const simplified = raw.map(row => {
  const n = normalizeRow(row);

  const fugitive = parseFloat(n["FUGITIVE TOT REL"]) || 0;
  const stack = parseFloat(n["STACK TOT REL"]) || 0;
  const air = parseFloat(n["AIR TOTAL RELEASE"]) || 0;
  const water = parseFloat(n["WATER TOTAL RELEASE"]) || 0;
  const land = parseFloat(n["LAND TOTAL RELEASE"]) || 0;

  const totalRelease = fugitive + stack + air + water + land;

  return {
    facility: n["FACILITY NAME"] || "Unknown Facility",
    chemical: n["CHEMICAL"] || "Unknown Chemical",
    release_lbs: totalRelease,
    year: n["YEAR"] || 2023
  };
});

fs.writeFileSync(outputFile, JSON.stringify(simplified, null, 2));
console.log(`✅ Simplified TRI data written to ${outputFile} (${simplified.length} records)`);
