// Phase 2: Fetch placeholder JSON and render raw
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

    // Chart
    const ctx = document.getElementById('aqiChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [data.city],
        datasets: [{
          label: 'Air Quality Index',
          data: [data.aqi],
          backgroundColor: data.aqi <= 50 ? 'var(--accent)' : 'var(--alert)'
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  })
  .catch(err => {
    const out = document.getElementById('data-output');
    if (out) {
      out.textContent = 'Error loading data';
    }
  });
