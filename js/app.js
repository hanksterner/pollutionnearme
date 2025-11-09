/* =========================================================================
   PollutionNearMe - app.js (updated with Superfund snapshot + markers)
   ========================================================================= */

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

  // Superfund snapshot (replaces placeholder)
  fetch('/data/superfund.json')
    .then(r => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    })
    .then(sf => {
      if (!sf || typeof sf.national_count !== 'number') throw new Error('Superfund payload invalid');
      const el = document.querySelector('#snapshot-superfund .snapshot-value');
      if (el) el.textContent = sf.national_count.toLocaleString();
    })
    .catch(err => {
      console.warn('Superfund snapshot fetch failed', err);
      const el = document.querySelector('#snapshot-superfund .snapshot-value');
      if (el) el.textContent = 'data unavailable';
    });
}

// === Superfund Map Integration ===
function addSuperfundMarkers(map) {
  fetch('/data/superfund.json')
    .then(r => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.sites)) {
        throw new Error('Superfund sites array missing');
      }
      data.sites.forEach(site => {
        const lat = toNum(site.latitude);
        const lon = toNum(site.longitude);
        if (!isFinite(lat) || !isFinite(lon)) return;

        const marker = L.circleMarker([lat, lon], {
          radius: 5,
          color: 'blue',
          fillColor: 'blue',
          fillOpacity: 0.6
        });

        const name = escapeHtml(site.site_name ?? 'Superfund Site');
        const city = escapeHtml(site.city ?? '');
        const state = escapeHtml(site.state ?? '');
        const status = escapeHtml(site.npl_status ?? '');

        marker.bindPopup(
          `<strong>${name}</strong><br>` +
          `${city}${city && state ? ', ' : ''}${state}<br>` +
          (status ? `NPL Status: ${status}` : '')
        );

        marker.addTo(map);
      });
    })
    .catch(err => console.error('Error loading Superfund markers:', err));
}

// === Map initialization ===
let GLOBAL_MAP;

function initMap() {
  // If a map is already initialized, reuse it
  if (GLOBAL_MAP) return GLOBAL_MAP;

  // Basic Leaflet map setup (centered on US)
  GLOBAL_MAP = L.map('map', { zoomControl: true }).setView([37.8, -96], 4);

  // Basemap (adjust if you use a different tile provider in your project)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(GLOBAL_MAP);

  // Existing dataset markers (TRI, etc.) should be added here in your project
  // addTriMarkers(GLOBAL_MAP); // keep your existing call if present

  // Superfund markers
  addSuperfundMarkers(GLOBAL_MAP);

  return GLOBAL_MAP;
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

// === Bootstrap ===
// Call these from your page lifecycle (e.g., on DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  // Snapshots and map (from first part)
  loadSnapshots();
  initMap();

  // === Search wiring ===
  // Expects: #search-input (text), #search-button (button)
  function initSearch() {
    const input = document.querySelector('#search-input');
    const button = document.querySelector('#search-button');

    if (!input || !button) return;

    // Submit on button click
    button.addEventListener('click', () => {
      const q = String(input.value || '').trim();
      if (q.length) geocodeAndCenter(q);
    });

    // Submit on Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = String(input.value || '').trim();
        if (q.length) geocodeAndCenter(q);
      }
    });
  }

  // === Client-side geocoding (Nominatim) ===
  async function geocodeAndCenter(query) {
    try {
      // Nominatim public endpoint; returns array of matches
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '1'
      });
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          // Be polite to the service
          'Accept': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        notifySearchResult('No location found');
        return;
      }

      const top = results[0];
      const lat = toNum(top.lat);
      const lon = toNum(top.lon);
      if (!isFinite(lat) || !isFinite(lon)) {
        notifySearchResult('Invalid coordinates received');
        return;
      }

      // Recenter and place a temporary marker with a readable label
      const label = formatGeocodeLabel(top);
      centerMapOn(lat, lon, pickZoomForResult(top));
      placeTemporaryMarker(lat, lon, label);
      notifySearchResult(`Centered on ${label}`);
    } catch (err) {
      console.warn('Geocoding error:', err);
      notifySearchResult('Search error — try refining your query');
    }
  }

  // Choose a zoom based on result type (city vs address)
  function pickZoomForResult(item) {
    const cls = (item && item.class) || '';
    const type = (item && item.type) || '';
    // address/building gets closer; city/postcode a bit wider
    if (cls === 'place' && (type === 'city' || type === 'town' || type === 'village')) return 11;
    if (type === 'postcode') return 10;
    return 14; // street/address/building
  }

  // Format a readable popup label from Nominatim result
  function formatGeocodeLabel(item) {
    const disp = item && item.display_name ? String(item.display_name) : '';
    // Keep it concise: first 2–3 components
    const parts = disp.split(',').map(s => s.trim());
    const short = parts.slice(0, 3).join(', ');
    return short || 'Selected location';
  }

  // Snapshot feedback UI (optional; uses #search-status if present)
  function notifySearchResult(msg) {
    const el = document.querySelector('#search-status');
    if (!el) return;
    el.textContent = msg;
    el.setAttribute('aria-live', 'polite');
  }

  // === Hamburger menu / nav toggle ===
  // Expects: #menu-toggle (button), #site-nav (nav)
  function initMenu() {
    const toggle = document.querySelector('#menu-toggle');
    const nav = document.querySelector('#site-nav');
    if (!toggle || !nav) return;

    // Initialize ARIA
    toggle.setAttribute('aria-expanded', 'false');
    nav.setAttribute('aria-hidden', 'true');

    const open = () => {
      nav.classList.add('is-open');
      nav.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      // Trap focus: first focusable element inside nav
      const focusable = nav.querySelector('a, button, input, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
      document.addEventListener('keydown', escHandler);
    };

    const close = () => {
      nav.classList.remove('is-open');
      nav.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') close();
    };

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) close(); else open();
    });

    // Close when clicking a nav link (optional)
    nav.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.closest('a')) {
        close();
      }
    });
  }

  // === DOM bootstrap (continued) ===
  document.addEventListener('DOMContentLoaded', () => {
    // These calls complement the earlier block
    initSearch();
    initMenu();
  });

