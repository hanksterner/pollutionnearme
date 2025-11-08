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

const simplified = raw.map(row => {
  const fugitive = Number((row["FUGITIVE TOT REL"] || "").trim()) || 0;
  const stack = Number((row["STACK TOT REL"] || "").trim()) || 0;
  const air = Number((row["AIR TOTAL RELEASE"] || "").trim()) || 0;
  const water = Number((row["WATER TOTAL RELEASE"] || "").trim()) || 0;
  const land = Number((row["LAND TOTAL RELEASE"] || "").trim()) || 0;

  const totalRelease = fugitive + stack + air + water + land;

  return {
    facility: (row["FACILITY NAME"] || "").trim() || "Unknown Facility",
    chemical: (row["CHEMICAL"] || "").trim() || "Unknown Chemical",
    release_lbs: totalRelease,
    year: (row["YEAR"] || "").trim() || 2023
  };
});

fs.writeFileSync(outputFile, JSON.stringify(simplified, null, 2));
console.log(`✅ Simplified TRI data written to ${outputFile} (${simplified.length} records)`);
