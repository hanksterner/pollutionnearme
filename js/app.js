// === Boot & Globals ===
let GLOBAL_MAP;
let _tempMarker;
let GLOBAL_TRI_LAYER;
let GLOBAL_SUPERFUND_LAYER;
let GLOBAL_VIOLATIONS_LAYER;

// Wire up once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initMap();
  loadTRIMarkers();
  loadSuperfundMarkers();
  loadViolationMarkers();
  loadSnapshots();
});

// === UI (hamburger + search) ===
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        nav.setAttribute('aria-hidden', 'true');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.focus();
      }
    });
  }

  const searchForm = document.getElementById('search');
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = searchForm.querySelector('input[name="q"]');
      const query = input?.value?.trim();
      if (!query) return;

      indicateSearchStart(true);
      try {
        const loc = await geocode(query);
        if (!loc) {
          indicateSearchResult(false, `No results for "${query}"`);
          recordLedgerLine(`Search "${query}" — NO RESULT — ${new Date().toISOString()}`);
          return;
        }
        indicateSearchResult(true, loc.display_name);
        centerMapOn(loc.lat, loc.lon, 12);
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
  btn.disabled = !!isStarting;
  btn.textContent = isStarting ? 'Searching…' : 'Search';
}

function indicateSearchResult(ok, msg) {
  let el = document.getElementById('search-feedback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'search-feedback';
    el.style.textAlign = 'center';
    el.style.marginTop = '0.5rem';
    el.style.fontWeight = '600';
    const banner = document.querySelector('.banner');
    if (banner && banner.parentNode) {
      banner.parentNode.insertBefore(el, banner.nextSibling);
    } else {
      document.body.appendChild(el);
    }
  }
  el.textContent = msg;
  el.style.color = ok ? '#2e7d32' : '#c62828';
  clearTimeout(el._clearTimer);
  el._clearTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

function recordLedgerLine(line) {
  console.log('[LEDGER-CANDIDATE] ' + line);
}

// === Geocoding ===
async function geocode(q) {
  const common = '&addressdetails=1&accept-language=en';
  let url = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=us&q='
    + encodeURIComponent(q) + common;

  let payload = await fetchJson(url);
  if (!Array.isArray(payload) || payload.length === 0) {
    url = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&q='
      + encodeURIComponent(q) + common;
    payload = await fetchJson(url);
  }
  if (!Array.isArray(payload) || payload.length === 0) return null;

  const candidate = payload.find(p => p.type === 'postcode') || payload[0];
  const lat = Number(candidate.lat);
  const lon = Number(candidate.lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;

  return { lat, lon, display_name: candidate.display_name };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Network response not ok: ' + res.status);
  return res.json();
}

// === Map Initialization with Layer Toggle ===
function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  const map = L.map('map', { fullscreenControl: true }).setView([39.8, -98.6], 4);
  GLOBAL_MAP = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const triLayer = L.layerGroup();
  const superfundLayer = L.layerGroup();
  const violationsLayer = L.layerGroup();

  GLOBAL_TRI_LAYER = triLayer;
  GLOBAL_SUPERFUND_LAYER = superfundLayer;
  GLOBAL_VIOLATIONS_LAYER = violationsLayer;

  map.addLayer(triLayer);
  map.addLayer(superfundLayer);
  map.addLayer(violationsLayer);

  const overlays = {
    "Pollution by Factories (TRI)": triLayer,
    "Superfund Sites": superfundLayer,
    "Violations & Penalties": violationsLayer
  };
  L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  // === Legend Toggle Wiring ===
  GLOBAL_MAP.on('overlayadd', function (e) {
    if (e.name === 'Pollution by Factories (TRI)') {
      document.getElementById('legend-pollution').style.display = 'block';
    }
    if (e.name === 'Violations & Penalties') {
      document.getElementById('legend-penalties').style.display = 'block';
    }
    if (e.name === 'Superfund Sites') {
      document.getElementById('legend-superfund').style.display = 'block';
    }
  });

  GLOBAL_MAP.on('overlayremove', function (e) {
    if (e.name === 'Pollution by Factories (TRI)') {
      document.getElementById('legend-pollution').style.display = 'none';
    }
    if (e.name === 'Violations & Penalties') {
      document.getElementById('legend-penalties').style.display = 'none';
    }
    if (e.name === 'Superfund Sites') {
      document.getElementById('legend-superfund').style.display = 'none';
    }
  });
}

// === Utility to dump all fields into popup ===
function buildPopupContent(obj) {
  let html = '<div class="popup-data">';
  for (const [key, value] of Object.entries(obj)) {
    html += `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`;
  }
  html += '</div>';
  return html;
}

// === TRI markers ===
function loadTRIMarkers() {
  fetch('/data/tri-2023.json')
    .then(r => r.json())
    .then(tri => {
      tri.forEach(item => {
        const lat = toNum(item.latitude ?? item.lat);
        const lon = toNum(item.longitude ?? item.lng ?? item.lon);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const release = toNum(item.release_lbs ?? item.release ?? 0);
        let color = '#a6cee3';
        if (release > 100000) color = '#1f78b4';
        if (release > 500000) color = '#33a02c';
        if (release > 1000000) color = '#006d2c';

        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          fillColor: color,
          color: '#333',
          weight: 1,
          fillOpacity: 0.8
        }).bindPopup(buildPopupContent(item));

        GLOBAL_TRI_LAYER.addLayer(marker);
      });
    })
    .catch(err => console.warn('TRI markers failed', err));
}

// === Superfund markers ===
function loadSuperfundMarkers() {
  fetch('/data/superfund.json')
    .then(r => r.json())
    .then(sf => {
      const list = Array.isArray(sf.sites) ? sf.sites : [];
      list.forEach(site => {
        const lat = toNum(site.lat ?? site.latitude);
        const lon = toNum(site.lon ?? site.longitude);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const marker = L.circleMarker([lat, lon], {
          radius: 7,
          fillColor: '#3182bd',
          color: '#0d47a1',
          weight: 2,
          fillOpacity: 0.9
        }).bindPopup(buildPopupContent(site));

        GLOBAL_SUPERFUND_LAYER.addLayer(marker);
      });
    })
    .catch(err => console.warn('Superfund markers failed', err));
}

// === Violations & Penalties markers ===
function loadViolationMarkers() {
  fetch('/data/violations.json')
    .then(r => r.json())
    .then(vs => {
      vs.forEach(v => {
        const lat = toNum(v.lat ?? v.latitude);
        const lon = toNum(v.lon ?? v.longitude);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const penalty = Number(v.penalty) || 0;
        let color = '#fdae6b';
        if (penalty > 100000) color = '#e6550d';
        if (penalty > 1000000) color = '#bd0026';
        if (penalty > 10000000) color = '#6e016b';

        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          fillColor: color,
          color: '#333',
          weight: 1,
          fillOpacity: 0.8
        }).bindPopup(buildPopupContent(v));

        GLOBAL_VIOLATIONS_LAYER.addLayer(marker);
      });
    })
    .catch(err => console.warn('Violations markers failed', err));
}

// === Snapshot Tiles ===
function loadSnapshots() {
  // TRI snapshot
  fetch('/data/tri-2023.json')
    .then(r => r.json())
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

  // Superfund snapshot
  fetch('/data/superfund.json')
    .then(r => r.json())
    .then(sf => {
      const el = document.querySelector('#snapshot-superfund .snapshot-value');
      const list = Array.isArray(sf.sites) ? sf.sites : [];
      const activeSites = list.filter(site => {
        const status = (site.npl_status || site.status || '').trim();
        const listingDate = (site.listing_date || '').trim();
        const deletion = (site.deletion_date || '').trim();
        const deletionNotice = (site.deletion_notice || '').trim();
        return status === 'NPL Site' && listingDate && !deletion && !deletionNotice;
      });
      if (el) {
        el.textContent = activeSites.length > 0 ? `${activeSites.length} active sites` : 'data unavailable';
      }
    })
    .catch(err => {
      console.warn('Superfund snapshot fetch failed', err);
      const el = document.querySelector('#snapshot-superfund .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });

  // Violations snapshot
  fetch('/data/violations.json')
    .then(r => r.json())
    .then(vs => {
      if (!Array.isArray(vs)) throw new Error('Violations payload not array');
      const totalViolations = vs.reduce((sum, v) => sum + (Number(v.count) || 0), 0);
      const totalPenalty = vs.reduce((sum, v) => sum + (Number(v.penalty) || 0), 0);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) {
        el.textContent = `${totalViolations} violations, $${totalPenalty.toLocaleString()} penalties`;
      }
    })
    .catch(err => {
      console.warn('Violations snapshot fetch failed', err);
      const el = document.querySelector('#snapshot-violations .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });
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

// === Map helpers ===
function centerMapOn(lat, lon, zoom = 12) {
  if (!GLOBAL_MAP) return;
  GLOBAL_MAP.setView([lat, lon], zoom, { animate: true });
}

function placeTemporaryMarker(lat, lon, label) {
  if (!GLOBAL_MAP) return;
  if (_tempMarker) {
    GLOBAL_MAP.removeLayer(_tempMarker);
    _tempMarker = null;
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

  setTimeout(() => {
    if (_tempMarker && GLOBAL_MAP) {
      GLOBAL_MAP.removeLayer(_tempMarker);
      _tempMarker = null;
    }
  }, 10000);
}
