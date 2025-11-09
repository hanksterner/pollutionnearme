// === Boot & Helpers ===
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initMap();
  loadSnapshots();
});

// === UI Initialization (hamburger, search) ===
function initUI() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
      const isOpen = nav.classList.contains('open');
      nav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      hamburger.setAttribute('aria-expanded', isOpen.toString());
    });
  }

  const searchForm = document.getElementById('search');
  if (searchForm) {
    searchForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = searchForm.querySelector('input[name="q"]');
      const query = input?.value?.trim();
      if (!query) return;
      console.log('Search submitted:', query);
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // TODO: wire to geocoding / ZIP lookup and center map
    });
  }
}

// === Map Initialization ===
function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  const map = L.map('map', { fullscreenControl: true }).setView([39.8, -98.6], 4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const clusters = L.markerClusterGroup();
  map.addLayer(clusters);

  // Load sealed national dataset
  fetch('/data/tri-2023.json')
    .then(r => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    })
    .then(tri => {
      if (!Array.isArray(tri)) throw new Error('TRI payload not array');
      tri.forEach(item => {
        const lat = toNum(item.latitude ?? item.lat);
        const lon = toNum(item.longitude ?? item.lng ?? item.lon);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const release = Math.max(0, toNum(item.release_lbs ?? item.release ?? 0));
        const radius = Math.max(3, Math.log(release + 1) || 3);
        const color = release > 1_000_000 ? '#c62828' : release > 100_000 ? '#ef6c00' : '#2e7d32';

        const marker = L.circleMarker([lat, lon], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.6,
          weight: 1
        });

        const facility = escapeHtml(item.facility ?? item.name ?? 'Facility');
        const chemical = escapeHtml(item.chemical ?? item.cas ?? 'Chemical');
        const city = escapeHtml(item.city ?? '');
        const county = escapeHtml(item.county ?? '');
        const releaseStr = release ? release.toLocaleString() : '0';

        const popupHtml = `
          <div class="popup">
            <strong>${facility}</strong><br/>
            ${chemical}<br/>
            ${releaseStr} lbs released<br/>
            ${city}${city && county ? ', ' : ''}${county}
          </div>
        `;
        marker.bindPopup(popupHtml);
        clusters.addLayer(marker);
      });
    })
    .catch(err => {
      console.warn('TRI markers load failed', err);
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.classList.add('data-error');
    });
}

// === Snapshot Data Loaders ===
function loadSnapshots() {
  // Pollution by Factories (national TRI 2023)
  fetch('/data/tri-2023.json')
    .then(r => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    })
    .then(tri => {
      if (!Array.isArray(tri)) throw new Error('TRI payload not array');
      const valid = tri.filter(item =>
        isFinite(toNum(item.latitude ?? item.lat)) &&
        isFinite(toNum(item.longitude ?? item.lng ?? item.lon))
      );
      const facilityCount = valid.length;
      const total = valid.reduce((sum, item) => sum + Math.max(0, toNum(item.release_lbs ?? item.release ?? 0)), 0);
      const billions = total / 1_000_000_000;
      const billionsStr = billions >= 0.1 ? billions.toFixed(1) : billions.toPrecision(1);
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = `${facilityCount} facilities, ${billionsStr} billion lbs reported`;
    })
    .catch(err => {
      console.warn('TRI snapshot fetch failed', err);
      const el = document.querySelector('#snapshot-releases .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Violations & penalties
  fetch('/data/violations.json')
    .then(r => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    })
    .then(vs => {
      if (!Array.isArray(vs)) throw new Error('Violations payload not array');
      const totalViolations = vs.reduce((s, v) => s + toNum(v.count), 0);
      const totalPenalty = vs.reduce((s, v) => s + toNum(v.penalty), 0);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = `${totalViolations} violations, $${totalPenalty.toLocaleString()}`;
    })
    .catch(err => {
      console.warn('Violations snapshot fetch failed', err);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Superfund placeholder
  const sfEl = document.querySelector('#snapshot-superfund .snapshot-value');
  if (sfEl) sfEl.textContent = 'Data source pending';
}

// === Utilities ===
function toNum(v) {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/[^0-9.\-eE+]/g, ''));
  return isNaN(n) ? NaN : n;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
