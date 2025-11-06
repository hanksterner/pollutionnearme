// === AQI Visualization ===
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
      out.textContent = 'Error loading AQI data: ' + err;
    }
  });


// === TRI Visualization ===
fetch('/data/tri.json')
  .then(res => res.json())
  .then(tri => {
    const triOut = document.getElementById('tri-output');
    if (triOut) {
      triOut.textContent = JSON.stringify(tri, null, 2);
    }

    const triBody = document.getElementById('tri-table-body');
    if (triBody) {
      triBody.innerHTML = tri.map(item => `
        <tr>
          <td>${item.facility}</td>
          <td>${item.chemical}</td>
          <td>${item.release_lbs}</td>
          <td>${item.year}</td>
        </tr>`).join('');
    }

    const triChart = document.getElementById('tri-chart');
    if (triChart) {
      tri.forEach(item => {
        const barWrapper = document.createElement('div');
        barWrapper.style.background = '#eee';
        barWrapper.style.margin = '0.25rem 0';
        barWrapper.style.height = '20px';

        const bar = document.createElement('div');
        const width = Math.min((item.release_lbs / 100000) * 100, 100); // scale
        bar.style.width = width + '%';
        bar.style.height = '100%';
        bar.style.background = 'var(--alert)';
        bar.style.color = '#fff';
        bar.style.fontSize = '0.8rem';
        bar.style.textAlign = 'right';
        bar.textContent = item.release_lbs + ' lbs';

        barWrapper.appendChild(bar);
        triChart.appendChild(barWrapper);
      });
    }
  })
  .catch(err => {
    const triOut = document.getElementById('tri-output');
    if (triOut) {
      triOut.textContent = 'Error loading TRI data: ' + err;
    }
  });


// === Violations Visualization ===
fetch('/data/violations.json')
  .then(res => res.json())
  .then(violations => {
    const vOut = document.getElementById('violations-output');
    if (vOut) {
      vOut.textContent = JSON.stringify(violations, null, 2);
    }

    const vBody = document.getElementById('violations-table-body');
    if (vBody) {
      vBody.innerHTML = violations.map(v => `
        <tr>
          <td>${v.facility}</td>
          <td>${v.type}</td>
          <td>${v.count}</td>
          <td>${v.penalty}</td>
        </tr>`).join('');
    }

    const leaderboard = document.getElementById('violations-leaderboard');
    if (leaderboard) {
      violations.forEach(v => {
        const row = document.createElement('div');
