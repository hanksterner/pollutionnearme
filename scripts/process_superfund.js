// scripts/process_superfund.js
// Generate enriched Superfund dataset for PollutionNearMe

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Input source (adjust to your EPA CSV export or SEMS data)
const INPUT = path.join(__dirname, '../data/superfund_raw.json');
const OUTPUT = path.join(__dirname, '../data/superfund.json');

const sites = [];
let count = 0;

fs.createReadStream(INPUT)
  .pipe(csv())
  .on('data', row => {
    try {
      const lat = parseFloat(row.LATITUDE || row.lat || '');
      const lon = parseFloat(row.LONGITUDE || row.lon || '');
      if (!isFinite(lat) || !isFinite(lon)) return;

      const site = {
        site_name: row.SITE_NAME || row.name || 'Superfund site',
        city: row.CITY || '',
        state: row.STATE || '',
        npl_status: row.NPL_STATUS || row.status || 'Unknown',
        lat,
        lon,
        // Enriched fields
        contaminants: row.CONTAMINANTS ? row.CONTAMINANTS.split(';').map(s => s.trim()) : [],
        remedy: row.REMEDY || '',
        estimated_cleanup_cost: row.CLEANUP_COST ? Number(row.CLEANUP_COST) : null
      };

      sites.push(site);
      count++;
    } catch (err) {
      console.warn('Row parse error', err);
    }
  })
  .on('end', () => {
    const output = {
      national_count: count,
      as_of: new Date().toISOString().slice(0, 10),
      sites
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
    console.log(`Wrote ${count} sites to ${OUTPUT}`);
  });
