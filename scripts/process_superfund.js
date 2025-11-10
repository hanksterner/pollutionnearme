// scripts/process_superfund.js
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../data/superfund_raw.json');
const OUTPUT = path.join(__dirname, '../data/superfund.json');

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const sites = [];

(raw.features || []).forEach(f => {
  const props = f.properties || {};
  const coords = f.geometry?.coordinates || [];
  const lon = parseFloat(coords[0]);
  const lat = parseFloat(coords[1]);
  if (!isFinite(lat) || !isFinite(lon)) return;

  const site = {
    site_name: props.SITE_NAME || 'Superfund site',
    city: props.CITY_NAME || '',
    state: props.STATE_CODE || '',
    npl_status: props.NPL_STATUS_CODE || 'Unknown',
    lat,
    lon,
    // Enriched fields
    contaminants: props.CONTAMINANTS ? props.CONTAMINANTS.split(';').map(s => s.trim()) : [],
    remedy: props.REMEDY || '',
    estimated_cleanup_cost: props.CLEANUP_COST ? Number(props.CLEANUP_COST) : null,
    url: props.URL_ALIAS_TXT || '',
    photo: props.FEATURE_INFO_URL || ''
  };

  sites.push(site);
});

const output = {
  national_count: sites.length,
  as_of: new Date().toISOString().slice(0, 10),
  sites
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Wrote ${sites.length} sites to ${OUTPUT}`);
