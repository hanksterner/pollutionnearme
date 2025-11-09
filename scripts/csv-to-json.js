// scripts/csv-to-json.js
// Convert EPA TRI CSV into JSON array

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser'); // install with: npm install csv-parser

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error("Usage: node scripts/csv-to-json.js <input.csv> <output.json>");
  process.exit(1);
}

const results = [];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on('data', (row) => {
    results.push(row);
  })
  .on('end', () => {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`✅ Converted ${results.length} rows from ${path.basename(inputFile)} to ${outputFile}`);
  });
