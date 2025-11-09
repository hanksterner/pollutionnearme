const fs = require('fs');

// Load raw GeoJSON
const raw = JSON.parse(fs.readFileSync('data/superfund_raw.json', 'utf8'));

// Map features into simplified structure
const sites = raw.features.map(f => ({
  site_name: f.properties.SITE_NAME,
  city: f.properties.CITY_NAME,
  state: f.properties.STATE_CODE,
  latitude: f.properties.LATITUDE_DECIMAL_VAL,
  longitude: f.properties.LONGITUDE_DECIMAL_VAL,
  npl_status: f.properties.NPL_STATUS_CODE
}));

// Build final JSON
const output = {
  national_count: sites.length,
  sites
};

// Write to /data/superfund.json
fs.writeFileSync('superfund.json', JSON.stringify(output, null, 2));
console.log(`Wrote ${sites.length} sites to superfund.json`);
