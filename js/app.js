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
  loadSnapshots();
});

// === UI (hamburger + search) ===
function initUI() {
  // Hamburger toggle
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
      const isOpen = nav.classList.contains('open');
      nav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      hamburger.setAttribute('aria-expanded', isOpen.toString());
    });

    // Escape closes menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        nav.setAttribute('aria-hidden', 'true');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.focus();
      }
    });
  }

  // Search form
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
    el.style.color = ok ? '#2e7d32' : '#c62828';
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

// === TRI markers ===
// (unchanged, loads /data/tri-2023.json and adds markers)

// === Superfund markers ===
// (unchanged, loads /data/superfund.json and adds markers)

// === Violations & Penalties markers ===
// (unchanged, loads /data/violations.json and adds markers)

// === Snapshot Tiles ===
// (unchanged, loads snapshots for TRI, Superfund, Violations)

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

// === Legend Toggle Wiring ===
// Must be placed at the bottom of app.js, after map and layers are initialized.
document.addEventListener('DOMContentLoaded', () => {
  if (GLOBAL_MAP) {
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
});
