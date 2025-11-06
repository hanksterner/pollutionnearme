// === AQI Visualization ===
fetch('/data/placeholder.json')
  .then(res => res.json())
  .then(data => {
    const out = document.getElementById('data-output');
    if (out) out.textContent = JSON.stringify(data, null, 2);

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

    const chartContainer = document.getElementById('charts');
    if (chartContainer) {
      const maxAQI = 500;
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

    // === AQI Summary ===
    const aqiSummary = document.getElementById('aqi-summary');
    if (aqiSummary) {
      let statusText;
      if (data.aqi <= 50) statusText = "Air quality is Good — safe to breathe outdoors.";
      else if (data.aqi <= 100) statusText = "Air quality is Moderate — sensitive groups should be cautious.";
      else statusText = "Air quality is Unhealthy — limit outdoor activity.";
      aqiSummary.textContent = statusText;
    }
  })
  .catch(err => {
    const out = document.getElementById('data-output');
    if (out) out.textContent = 'Error loading AQI data: ' + err;
  });


// === TRI Visualization ===
fetch('/data/tri.json')
  .then(res => res.json())
  .then(tri => {
    const triOut = document.getElementById('tri-output');
    if (triOut) triOut.textContent = JSON.stringify(tri, null, 2);

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
        const width = Math.min((item.release_lbs / 100000) * 100, 100);
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

    // === TRI Summary with Contextual Comparison ===
    const triSummary = document.getElementById('tri-summary');
    if (triSummary && tri.length > 0) {
      const total = tri.reduce((sum, item) => sum + item.release_lbs, 0);
      let comparison;
      if (total < 100) comparison = "≈ the weight of a car tire.";
      else if (total < 1000) comparison = "≈ the weight of a motorcycle.";
      else if (total < 10000) comparison = "≈ the weight of a pickup truck.";
      else if (total < 50000) comparison = "≈ the weight of a school bus.";
      else comparison = "≈ multiple semi‑trucks full of waste.";
      triSummary.textContent = `Local facilities released ${total.toLocaleString()} lbs of toxic chemicals in ${tri[0].year}, ${comparison}`;
    }
  })
  .catch(err => {
    const triOut = document.getElementById('tri-output');
    if (triOut) triOut.textContent = 'Error loading TRI data: ' + err;
  });


// === Violations Visualization ===
fetch('/data/violations.json')
  .then(res => res.json())
  .then(violations => {
    const vOut = document.getElementById('violations-output');
    if (vOut) vOut.textContent = JSON.stringify(violations, null, 2);

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
        row.textContent = `${v.facility} – ${v.count} violations`;
        leaderboard.appendChild(row);
      });
    }

    // === Violations Summary with Contextual Comparison ===
    const vSummary = document.getElementById('violations-summary');
    if (vSummary && violations.length > 0) {
      const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
      const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);

      let penaltyComparison;
      if (totalPenalty < 50000) penaltyComparison = "≈ cost of a new car.";
      else if (totalPenalty < 200000) penaltyComparison = "≈ cost of a house down payment.";
      else if (totalPenalty < 1000000) penaltyComparison = "≈ cost of a small apartment building.";
      else penaltyComparison = "≈ millions in damages — enough to fund a school or hospital.";

      vSummary.textContent = `Facilities committed ${totalViolations} violations, with penalties totaling $${totalPenalty.toLocaleString()}, ${penaltyComparison}`;
    }
  })
  .catch(err => {
    const vOut = document.getElementById('violations-output');
    if (vOut) vOut.textContent = 'Error loading violations data: ' + err;
  });
