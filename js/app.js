// === Boot & Helpers ===
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSnapshots();
});

// === Map Initialization (visible by default, fullscreen control in corner) ===
function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  const map = L.map('map', { fullscreenControl: true })
    .setView([39.8, -98.6], 4); // Center US

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const clusters = L.markerClusterGroup();

  // Load TRI markers (optional visual proof even if snapshots fail)
  fetch('/data/tri.json')
    .then(r => r.json())
    .then(tri => {
      tri.forEach(item => {
        const lat = item.latitude ?? item.lat;
        const lon = item.longitude ?? item.lng ?? item.lon;
        if (lat == null || lon == null) return;

        const release = Number(item.release_lbs ?? item.release ?? 0);
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

      map.addLayer(clusters);
    })
    .catch(() => {
      // Map still works even if TRI fails; no hard failure
    });
}

// === Snapshot Data Loaders ===
function loadSnapshots() {
  // TRI totals
  fetch('/data/tri.json')
    .then(r => r.json())
    .then(tri => {
      const total = tri.reduce((sum, item) => sum + Number(item.release_lbs ?? item.release ?? 0), 0);
      const billions = (total / 1_000_000_000).toFixed(1);
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = `${billions} billion lbs reported`;
    })
    .catch(() => {
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Violations & penalties
  fetch('/data/violations.json')
    .then(r => r.json())
    .then(vs => {
      const totalViolations = vs.reduce((s, v) => s + Number(v.count ?? 0), 0);
      const totalPenalty = vs.reduce((s, v) => s + Number(v.penalty ?? 0), 0);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = `${totalViolations} violations, $${totalPenalty.toLocaleString()} penalties`;
    })
    .catch(() => {
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Superfund placeholder
  const sfEl = document.querySelector('#snapshot-superfund .snapshot-value');
  if (sfEl) sfEl.textContent = 'Data source pending';
}
