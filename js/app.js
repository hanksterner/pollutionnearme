// === AQI Visualization ===
fetch('/data/placeholder.json')
  .then(res => res.json())
  .then(data => {
    const tileAqi = document.getElementById('tile-aqi');
    if (tileAqi) {
      tileAqi.innerHTML = `🌤 <strong>Air Quality Today</strong><br>${data.aqi} ${data.status}`;
    }
    const snapAqi = document.getElementById('snapshot-aqi');
    if (snapAqi) {
      snapAqi.textContent = `Air Quality: ${data.aqi} ${data.status}`;
    }
  });

// === TRI Visualization (National 2023) ===
fetch('/data/tri-2023.json')
  .then(res => res.json())
  .then(tri => {
    const total = tri.reduce((sum, item) => sum + item.release_lbs, 0);

    const tileReleases = document.getElementById('tile-releases');
    if (tileReleases) {
      tileReleases.innerHTML = `🏭 <strong>Pollution Releases</strong><br>${total.toLocaleString()} lbs`;
    }
    const snapReleases = document.getElementById('snapshot-releases');
    if (snapReleases) {
      snapReleases.textContent = `Pollution Releases: ${total.toLocaleString()} lbs`;
    }

    // Map with clustering
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      const map = L.map('map').setView([39.8, -98.6], 4); // Center US
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const markers = L.markerClusterGroup();

      tri.forEach(item => {
        if (!item.latitude || !item.longitude) return;

        const marker = L.circleMarker([item.latitude, item.longitude], {
          radius: Math.max(3, Math.log(item.release_lbs + 1)),
          color: item.release_lbs > 1000 ? 'red' : item.release_lbs > 100 ? 'orange' : 'green',
          fillOpacity: 0.6
        });

        marker.bindPopup(`
          <strong>${item.facility}</strong><br/>
          ${item.chemical}<br/>
          ${item.release_lbs} lbs released<br/>
          ${item.city}, ${item.county}
        `);

        markers.addLayer(marker);
      });

      map.addLayer(markers);
    }
  });

// === Violations Visualization ===
fetch('/data/violations.json')
  .then(res => res.json())
  .then(violations => {
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);

    const tileViolations = document.getElementById('tile-violations');
    if (tileViolations) {
      tileViolations.innerHTML = `⚖️ <strong>Violations & Penalties</strong><br>${totalViolations} violations, $${totalPenalty.toLocaleString()}`;
    }
    const snapViolations = document.getElementById('snapshot-violations');
    if (snapViolations) {
      snapViolations.textContent = `Violations: ${totalViolations} ($${totalPenalty.toLocaleString()} penalties)`;
    }

    // Superfund placeholder
    const tileSuperfund = document.getElementById('tile-superfund');
    if (tileSuperfund) {
      tileSuperfund.innerHTML = `🧪 <strong>Superfund Sites</strong><br>Data source pending`;
    }
    const snapSuperfund = document.getElementById('snapshot-superfund');
    if (snapSuperfund) {
      snapSuperfund.textContent = `Superfund Sites: data source pending`;
    }
  });
