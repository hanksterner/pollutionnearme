// === TRI Visualization (National 2023) ===
fetch('/data/tri-2023.json')
  .then(res => res.json())
  .then(tri => {
    const total = tri.reduce((sum, item) => sum + item.release_lbs, 0);

    const snapReleases = document.getElementById('snapshot-releases');
    if (snapReleases) {
      // Format in billions for readability
      const formatted = (total / 1_000_000_000).toFixed(1);
      snapReleases.querySelector('.snapshot-value').textContent =
        `${formatted} billion lbs reported`;
    }

    // === Map Initialization ===
    const map = L.map('map', {
      fullscreenControl: true
    }).setView([39.8, -98.6], 4); // Center US

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

    // === Expand Map Button Control ===
    const expandBtn = document.getElementById('expand-map');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        map.toggleFullscreen();
      });
    }
  }
  });

// === Violations Visualization ===
fetch('/data/violations.json')
  .then(res => res.json())
  .then(violations => {
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);

    const snapViolations = document.getElementById('snapshot-violations');
    if (snapViolations) {
      snapViolations.querySelector('.snapshot-value').textContent =
        `${totalViolations} violations, $${totalPenalty.toLocaleString()} penalties`;
    }

    const snapSuperfund = document.getElementById('snapshot-superfund');
    if (snapSuperfund) {
      snapSuperfund.querySelector('.snapshot-value').textContent =
        `Data source pending`;
    }
  });
