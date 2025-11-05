// Fetch placeholder JSON and render outputs
fetch('/data/placeholder.json')
  .then(res => res.json())
  .then(data => {
    // Raw JSON
    const out = document.getElementById('data-output');
    if (out) {
      out.textContent = JSON.stringify(data, null, 2);
    }

    // Table
    const tableBody = document.getElementById('data-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td>${data.city}</td>
          <td>${data.aqi}</td>
          <td>${data.status}</td>
          <td>${data.last_updated}</td>
        </tr>`;
    }

    // Simple bar visualization (CSP‑safe)
    const chartContainer = document.getElementById('charts');
    if (chartContainer) {
      const maxAQI = 500; // AQI scale max
      const barWidth = (data.aqi / maxAQI) * 100;

      const barWrapper = document.createElement('div');
      barWrapper.style.background = '#eee';
      barWrapper.style.border = '1px solid var(--secondary)';
      barWrapper.style.height = '30px';
      barWrapper.style.width = '100%';
      barWrapper.style.marginTop = '1rem';

      const bar = document.createElement('div');
      bar.style.height = '100%';
      bar.style.width = barWidth + '%';
      bar.style.background = data.aqi <= 50 ? 'var(--accent)' : 'var(--alert)';
      bar.style.textAlign = 'right';
      bar.style.color = '#fff';
      bar.style.paddingRight = '0.5rem';
      bar.style.fontWeight = 'bold';
      bar.textContent = data.aqi;

      barWrapper.appendChild(bar);
      chartContainer.appendChild(barWrapper);
    }
  })
  .catch(err => {
    const out = document.getElementById('data-output');
    if (out) {
      out.textContent = 'Error loading data: ' + err;
    }
  });
