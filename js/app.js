// === Boot & Helpers ===
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSnapshots();
});

// === Map Initialization ===
function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  const map = L.map('map', { fullscreenControl: true })
    .setView([39.8, -98.6], 4); // US center

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const clusters = L.markerClusterGroup();
  map.addLayer(clusters);

  // Use sealed national dataset
  fetch('/data/tri-2023.json')
    .then(r => r.json())
    .then(tri => {
      tri.forEach(item => {
        const lat = toNum(item.latitude ?? item.lat);
        const lon = toNum(item.longitude ?? item.lng ?? item.lon);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const release = toNum(item.release_lbs ?? item.release);
        const radius = Math.max(3, Math.log(release + 1));
        const color = release > 1_000_000 ? 'red' : release > 100_000 ? 'orange' : 'green';

        const marker = L.circleMarker([lat, lon], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.6,
          weight: 1
        });

        const facility = item.facility ?? item.name ?? 'Facility';
        const chemical = item.chemical ?? item.cas ?? 'Chemical';
        const city = item.city ?? '';
        const county = item.county ?? '';

        marker.bindPopup(`
          <strong>${facility}</strong><br/>
          ${chemical}<br/>
          ${release.toLocaleString()} lbs released<br/>
          ${city}${city && county ? ', ' : ''}${county}
        `);

        clusters.addLayer(marker);
      });
    })
    .catch(err => {
      console.warn("TRI markers load failed", err);
    });
}

function toNum(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// === Snapshot Data Loaders ===
function loadSnapshots() {
  // Pollution by Factories (national TRI 2023)
  fetch('/data/tri-2023.json')
    .then(r => r.json())
    .then(tri => {
      const valid = tri.filter(item =>
        isFinite(toNum(item.latitude ?? item.lat)) &&
        isFinite(toNum(item.longitude ?? item.lng ?? item.lon))
      );
      const facilityCount = valid.length;
      const total = valid.reduce((sum, item) =>
        sum + toNum(item.release_lbs ?? item.release), 0
      );
      const billions = (total / 1_000_000_000).toFixed(1);
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = `${facilityCount} facilities, ${billions} billion lbs reported`;
    })
    .catch(err => {
      console.warn("TRI snapshot fetch failed", err);
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Violations & penalties
  fetch('/data/violations.json')
    .then(r => r.json())
    .then(vs => {
      const totalViolations = vs.reduce((s, v) => s + toNum(v.count), 0);
      const totalPenalty = vs.reduce((s, v) => s + toNum(v.penalty), 0);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = `${totalViolations} violations, $${totalPenalty.toLocaleString()} penalties`;
    })
    .catch(err => {
      console.warn("Violations snapshot fetch failed", err);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Superfund placeholder
  const sfEl = document.querySelector('#snapshot-superfund .snapshot-value');
  if (sfEl) sfEl.textContent = 'Data source pending';
}
