// === AQI Visualization ===
fetch('/data/placeholder.json')
  .then(res => res.json())
  .then(data => {
    const out = document.getElementById('data-output');
    if (out) out.textContent = JSON.stringify(data, null, 2);

    const tableBody = document.getElementById('data-table-body');
    if (tableBody) {
      let rowClass = '';
      if (data.aqi <= 50) rowClass = 'aqi-good';
      else if (data.aqi <= 100) rowClass = 'aqi-moderate';
      else rowClass = 'aqi-unhealthy';

      tableBody.innerHTML = `
        <tr class="${rowClass}">
          <td>${data.city}</td>
          <td>${data.aqi}</td>
          <td>${data.status}</td>
          <td>${data.last_updated}</td>
        </tr>`;
    }

    // Bar visualization with direct label
    const chartContainer = document.getElementById('charts');
    if (chartContainer) {
      const maxAQI = 500;
      const barWidth = (data.aqi / maxAQI) * 100;

      const barWrapper = document.createElement('div');
      barWrapper.style.background = '#eee';
      barWrapper.style.border = '1px solid var(--secondary)';
      barWrapper.style.height = '40px';
      barWrapper.style.width = '100%';
      barWrapper.style.marginTop = '1rem';
      barWrapper.style.position = 'relative';

      const bar = document.createElement('div');
      bar.style.height = '100%';
      bar.style.width = barWidth + '%';
      bar.style.background = data.aqi <= 50 ? 'var(--accent)' : 'var(--alert)';

      const label = document.createElement('span');
      label.style.position = 'absolute';
      label.style.left = '50%';
      label.style.top = '50%';
      label.style.transform = 'translate(-50%, -50%)';
      label.style.color = '#fff';
      label.style.fontWeight = 'bold';
      label.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';

      if (data.aqi <= 50) label.textContent = `${data.aqi} Good ✅`;
      else if (data.aqi <= 100) label.textContent = `${data.aqi} Moderate ⚠️`;
      else label.textContent = `${data.aqi} Unhealthy ❌`;

      barWrapper.appendChild(bar);
      barWrapper.appendChild(label);
      chartContainer.appendChild(barWrapper);
    }

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
      triBody.innerHTML = tri.map(item => {
        let rowClass = '';
        if (item.release_lbs < 1000) rowClass = 'pollution-low';
        else if (item.release_lbs < 10000) rowClass = 'pollution-medium';
        else rowClass = 'pollution-high';

        return `
          <tr class="${rowClass}">
            <td>${item.facility}</td>
            <td>${item.chemical}</td>
            <td>${item.release_lbs}</td>
            <td>${item.year}</td>
          </tr>`;
      }).join('');
    }

    const triChart = document.getElementById('tri-chart');
    if (triChart) {
      tri.forEach(item => {
        const barWrapper = document.createElement('div');
        barWrapper.style.background = '#eee';
        barWrapper.style.margin = '0.25rem 0';
        barWrapper.style.height = '25px';
        barWrapper.style.position = 'relative';

        const bar = document.createElement('div');
        const width = Math.min((item.release_lbs / 100000) * 100, 100);
        bar.style.width = width + '%';
        bar.style.height = '100%';
        bar.style.background = 'var(--alert)';

        const label = document.createElement('span');
        label.style.position = 'absolute';
        label.style.left = '50%';
        label.style.top = '50%';
        label.style.transform = 'translate(-50%, -50%)';
        label.style.color = '#fff';
        label.style.fontSize = '0.8rem';
        label.style.fontWeight = 'bold';
        label.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';

        if (item.release_lbs < 1000) label.textContent = `${item.release_lbs} lbs Low 🟦`;
        else if (item.release_lbs < 10000) label.textContent = `${item.release_lbs} lbs Medium 🟨`;
        else label.textContent = `${item.release_lbs} lbs High 🟥`;

        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        triChart.appendChild(barWrapper);
      });
    }

    const triSummary = document.getElementById('tri-summary');
    if (triSummary && tri.length > 0) {
      const total = tri.reduce((sum, item) => sum + item.release_lbs, 0);
      triSummary.textContent = `Local facilities released ${total.toLocaleString()} lbs of toxic chemicals in ${tri[0].year}.`;
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
      vBody.innerHTML = violations.map(v => {
        let rowClass = '';
        if (v.penalty < 50000) rowClass = 'penalty-small';
        else if (v.penalty < 200000) rowClass = 'penalty-medium';
        else rowClass = 'penalty-large';

        return `
          <tr class="${rowClass}">
            <td>${v.facility}</td>
            <td>${v.type}</td>
            <td>${v.count}</td>
            <td>$${v.penalty.toLocaleString()}</td>
          </tr>`;
      }).join('');
    }

    const leaderboard = document.getElementById('violations-leaderboard');
    if (leaderboard) {
      violations.forEach(v => {
        let icon = '';
        if (v.penalty < 50000) icon = '💵 Small';
        else if (v.penalty < 200000) icon = '💰 Medium';
        else icon = '🏦 Large';

        const row = document.createElement('div');
        row.textContent = `${v.facility} – ${v.count} violations (${icon})`;
        leaderboard.appendChild(row);
      });
    }

    const vSummary = document.getElementById('violations-summary');
    if (vSummary && violations.length > 0) {
      const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
      const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);
      vSummary.textContent = `Facilities committed ${totalViolations} violations, with penalties totaling $${totalPenalty.toLocaleString()}.`;
    }
  })
  .catch(err => {
    const vOut = document.getElementById('violations-output');
    if (vOut) vOut.textContent = 'Error loading violations data: ' + err;
  });
