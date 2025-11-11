// === Boot & Globals ===
let GLOBAL_MAP;
let _tempMarker;

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
  // transient feedback under banner; guard against missing banner
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
      // Fallback: append to body if banner missing
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

  // Independent layer groups (no clustering)
  const triLayer = L.layerGroup();
  const superfundLayer = L.layerGroup();
  const violationsLayer = L.layerGroup();

  GLOBAL_TRI_LAYER = triLayer;
  GLOBAL_SUPERFUND_LAYER = superfundLayer;
  GLOBAL_VIOLATIONS_LAYER = violationsLayer;

  // Add all layers to map by default
  map.addLayer(triLayer);
  map.addLayer(superfundLayer);
  map.addLayer(violationsLayer);

  // Add toggle control
  const overlays = {
    "Pollution by Factories (TRI)": triLayer,
    "Superfund Sites": superfundLayer,
    "Violations & Penalties": violationsLayer
  };
  L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  // Violations & Penalties legend
  const violationsLegend = L.control({ position: 'bottomright' });
  violationsLegend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
    <h4>Penalties</h4>
    <i style="background: green; width: 12px; height: 12px; display:inline-block; margin-right:4px;"></i> ≤ $100,000<br/>
    <i style="background: orange; width: 12px; height: 12px; display:inline-block; margin-right:4px;"></i> $100,001 – $1,000,000<br/>
    <i style="background: red; width: 12px; height: 12px; display:inline-block; margin-right:4px;"></i> > $1,000,000<br/>
    <small>Marker size scales with penalty amount</small>
  `;
    return div;
  };
  violationsLegend.addTo(map);
}

// TRI markers (national facilities and releases)
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
      const radius = Math.min(20, Math.max(3, Math.log10(release + 1)));
      const color = release > 1_000_000 ? '#c62828'
        : release > 100_000 ? '#ef6c00'
          : '#2e7d32';

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

      if (GLOBAL_TRI_LAYER.addLayer) {
        GLOBAL_TRI_LAYER.addLayer(marker);
      } else {
        marker.addTo(GLOBAL_TRI_LAYER);
      }
    });
  })
  .catch(err => {
    console.warn('TRI markers load failed', err);
    const md = document.getElementById('map');
    if (md) md.classList.add('data-error');
  });

// Superfund markers
fetch('/data/superfund.json')
  .then(r => {
    if (!r.ok) throw new Error('Network response not ok');
    return r.json();
  })
  .then(sf => {
    const sites = Array.isArray(sf.sites) ? sf.sites : [];

    const activeSites = sites.filter(site => {
      const status = (site.npl_status || site.status || '').trim();
      const listingDate = (site.listing_date || '').trim();
      const deletion = (site.deletion_date || '').trim();
      const deletionNotice = (site.deletion_notice || '').trim();
      return status === 'NPL Site' && listingDate && !deletion && !deletionNotice;
    });

    activeSites.forEach(site => {
      const lat = toNum(site.lat ?? site.latitude);
      const lon = toNum(site.lon ?? site.lng ?? site.longitude);
      if (!isFinite(lat) || !isFinite(lon)) return;

      const status = escapeHtml(site.npl_status ?? site.status ?? 'NPL');
      const name = escapeHtml(site.site_name ?? site.name ?? 'Superfund site');
      const city = escapeHtml(site.city ?? '');
      const state = escapeHtml(site.state ?? '');

      const marker = L.circleMarker([lat, lon], {
        radius: 6,
        color: '#1e88e5',
        fillColor: '#1e88e5',
        fillOpacity: 0.5,
        weight: 1
      });

      const popupHtml = `
        <div class="popup">
          <strong>${name}</strong><br/>
          ${city}${city && state ? ', ' : ''}${state}<br/>
          Status: ${status}
        </div>
      `;
      marker.bindPopup(popupHtml);

      GLOBAL_SUPERFUND_LAYER.addLayer(marker);
    });
  })
  .catch(err => {
    console.warn('Superfund markers load failed', err);
  });

// Violations & Penalties markers
fetch('/data/violations.json')
  .then(r => r.json())
  .then(vs => {
    vs.forEach(v => {
      const lat = Number(v.lat);
      const lon = Number(v.lon);
      if (!isFinite(lat) || !isFinite(lon)) return;

      const radius = Math.max(4, Math.log(v.penalty + 1));
      const color = v.penalty > 1000000 ? 'red' :
        v.penalty > 100000 ? 'orange' : 'green';

      const marker = L.circleMarker([lat, lon], {
        radius,
        color,
        fillOpacity: 0.6,
        weight: 1
      });

      marker.bindPopup(`
        <strong>${escapeHtml(v.facility)}</strong><br/>
        ${escapeHtml(v.city)}, ${escapeHtml(v.state)}<br/>
        ${escapeHtml(v.violation)}<br/>
        ${v.count} violations<br/>
        $${v.penalty.toLocaleString()} penalties
      `);

      GLOBAL_VIOLATIONS_LAYER.addLayer(marker);
    });
  })
  .catch(err => console.warn('Violations markers load failed', err));

// === Snapshot Tiles ===
function loadSnapshots() {
  // TRI snapshot
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
}

// Superfund snapshot (MVP: active sites only)
fetch('/data/superfund.json')
  .then(r => {
    if (!r.ok) throw new Error('Network response not ok');
    return r.json();
  })
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
      if (activeSites.length > 0) {
        el.textContent = `${activeSites.length} active sites`;
      } else {
        el.textContent = 'data unavailable';
      }
    }
  })
  .catch(err => {
    console.warn('Superfund snapshot fetch failed', err);
    const el = document.querySelector('#snapshot-superfund .snapshot-value');
    if (el) el.textContent = 'data unavailable';
  });

// Violations & Penalties snapshot
fetch('/data/violations.json')
  .then(r => {
    if (!r.ok) throw new Error('Network response not ok');
    return r.json();
  })
  .then(vs => {
    if (!Array.isArray(vs)) throw new Error('Violations payload not array');

    // Sum violation counts and penalties
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
