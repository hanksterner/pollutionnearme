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

let raw;
try {
  raw = JSON.parse(rawText);
} catch (err) {
  console.error(`❌ Failed to parse ${inputFile}:`, err.message);
  process.exit(1);
}

// --- Transform into simplified schema ---
const simplified = raw.map(record => {
  // Aggregate release totals across major channels
  const fugitive = Number(record.fugitive_tot_rel) || 0;
  const stack = Number(record.stack_tot_rel) || 0;
  const air = Number(record.air_total_release) || 0;
  const water = Number(record.water_total_release) || 0;
  const land = Number(record.land_total_release) || 0;

  const totalRelease = fugitive + stack + air + water + land;

  return {
    facility: record.facility_name || record.potw_name_1 || record.off_site_loc_name_1 || "Unknown Facility",
    chemical: record.chemical || "Unknown Chemical",
    release_lbs: totalRelease,
    year: record.reporting_year || 2023
  };
});

// --- Write simplified file ---
fs.writeFileSync(outputFile, JSON.stringify(simplified, null, 2));
console.log(`✅ Simplified TRI data written to ${outputFile} (${simplified.length} records)`);
