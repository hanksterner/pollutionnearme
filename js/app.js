// Phase 2: Fetch placeholder JSON and render to #data-output
fetch('/data/placeholder.json')
  .then(res => res.json())
  .then(data => {
    const out = document.getElementById('data-output');
    if (out) {
      out.textContent = JSON.stringify(data, null, 2);
    }
  })
  .catch(err => {
    const out = document.getElementById('data-output');
    if (out) {
      out.textContent = 'Error loading data';
    }
  });
