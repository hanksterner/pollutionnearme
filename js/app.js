// === Boot & Helpers ===
let GLOBAL_MAP;
let GLOBAL_CLUSTER_LAYER;
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
    searchForm.addEventListener('submit', async e => {
      e.preventDefault();
      const input = searchForm.querySelector('input[name="q"]');
      const query = input?.value?.trim();
      if (!query) return;
      indicateSearchStart(true);
      try {
        const loc = await geocode(query);
        if (!loc) {
          indicateSearchResult(false, 'No results for "' + query + '"');
          recordLedgerLine(`Search "${query}" — NO RESULT — ${new Date().toISOString()}`);
          return;
        }
        indicateSearchResult(true, `${loc.display_name}`);
        centerMapOn(loc.lat, loc.lon);
        placeTemporaryMarker(loc.lat, loc.lon, loc.display_name);
        recordLedgerLine(`Search "${query}" → ${loc.lat},${loc.lon} — ${new Date().toISOString()}`);
      } catch (err) {
        console.warn('Search error', err);
        indicateSearchResult(false, 'Search failed');
        recordLedgerLine(`Search "${query}" — ERROR — ${new Date().toISOString()} — ${String(err)}`);
      } finally {
        indicateSearchStart(false);
      }
    });
  }
}

function indicateSearchStart(isStarting) {
  const searchForm = document.getElementById('search');
  if (!searchForm) return;
  const btn = searchForm.querySelector('button[type="submit"]');
  if (!btn) return;
  if (isStarting) {
    btn.disabled = true;
    btn.textContent = 'Searching…';
  } else {
    btn.disabled = false;
    btn.textContent = 'Search';
  }
}

function indicateSearchResult(ok, msg) {
  // transient feedback under the banner for operational proof
  let el = document.getElementById('search-feedback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'search-feedback';
    el.style.textAlign = 'center';
    el.style.marginTop = '0.5rem';
    el.style.fontWeight = '600';
    el.style.color = ok ? '#2e7d32' : '#c62828';
    const banner = document.querySelector('.banner');
    banner.parentNode.insertBefore(el, banner.nextSibling);
  }
  el.textContent = msg;
  el.style.color = ok ? '#2e7d32' : '#c62828';
  // auto-clear after 6s
  clearTimeout(el._clearTimer);
  el._clearTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

function recordLedgerLine(line) {
  // Convenience: prints a single-line ledger text to console for copy/paste into logs/PNM-Ledger.txt
  // Example ledger line format: Entry 24 — 2025-11-09T10:35:00Z: Search "17361" → 39.79,-76.73
  console.log('[LEDGER-CANDIDATE] ' + line);
}

// === Geocoding ===
async function geocode(q) {
  // Try US-biased search first
  let url = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=us&q='
    + encodeURIComponent(q)
    + '&addressdetails=1&accept-language=en';
  try {
    let res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Geocode network response not ok');
    let payload = await res.json();

    // If no US results, broaden to global search
    if (!Array.isArray(payload) || payload.length === 0) {
      url = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&q='
        + encodeURIComponent(q)
        + '&addressdetails=1&accept-language=en';
      res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('Fallback geocode network response not ok');
      payload = await res.json();
    }

    if (!Array.isArray(payload) || payload.length === 0) return null;

    // Prefer results that include a postcode
    const candidate = payload.find(p => p.type === 'postcode') || payload[0];
    const lat = Number(candidate.lat);
    const lon = Number(candidate.lon);
    if (!isFinite(lat) || !isFinite(lon)) return null;

    return { lat, lon, display_name: candidate.display_name };
  } catch (err) {
    throw err;
  }
}

// === Map Initialization ===
function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  const map = L.map('map', { fullscreenControl: true }).setView([39.8, -98.6], 4);
  GLOBAL_MAP = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const clusters = L.markerClusterGroup();
  GLOBAL_CLUSTER_LAYER = clusters;
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

// === Map helper: recenter and temporary marker ===
function centerMapOn(lat, lon, zoom = 12) {
  if (!GLOBAL_MAP) return;
  GLOBAL_MAP.setView([lat, lon], zoom, { animate: true });
}

let _tempMarker;
function placeTemporaryMarker(lat, lon, label) {
  if (!GLOBAL_MAP) return;
  if (_tempMarker) {
    GLOBAL_MAP.removeLayer(_tempMarker);
  }
  _tempMarker = L.circleMarker([lat, lon], {
    radius: 8,
    color: '#1C2A39',
    fillColor: '#fff',
    fillOpacity: 1,
    weight: 2,
    dashArray: '2,2'
  }).addTo(GLOBAL_MAP);
  _tempMarker.bindPopup(`<strong>${escapeHtml(label || 'Location')}</strong>`).openPopup();
  // remove after 10s
  setTimeout(() => {
    if (_tempMarker && GLOBAL_MAP) {
      GLOBAL_MAP.removeLayer(_tempMarker);
      _tempMarker = null;
    }
  }, 10000);
}
