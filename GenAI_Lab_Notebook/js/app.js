// Notebook shell: each experiment is a markdown cell + code cell. Run cell mounts the tool and bumps the In[] counter.
(function () {
  const $ = GL.$, esc = GL.esc;
  let execCount = 0;
  const counts = {};

  function build() {
    $('#toc').innerHTML = GL.EXPERIMENTS.map(e => `<a href="#exp-${e.id}"><span>${String(e.id).padStart(2, '0')}</span>${esc(e.title)}</a>`).join('');
    $('#cells').innerHTML = GL.EXPERIMENTS.map(e => `
      <section class="cell" id="exp-${e.id}">
        <div class="gutter"></div>
        <div class="md-body">
          <h2>${e.id}. ${esc(e.title)}</h2>
          <p>${esc(e.short)}</p>
          <details>
            <summary>Aim and objectives</summary>
            <p style="margin-top:8px">${esc(e.aim)}</p>
            <ul>${e.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
            <p class="note" style="margin-top:8px">${e.runtime === 'browser' ? 'Runs fully in the browser.' : 'Browser stand-in. Full model runs in the GPU notebook.'} Source: ${esc(e.pdf)}${e.notebooks.length ? ' | Notebook: ' + e.notebooks.map(esc).join(', ') : ''}</p>
          </details>
        </div>
      </section>
      <section class="code-cell" data-cell="${e.id}">
        <div class="gutter"><span class="in" data-in="${e.id}">In [ ]:</span></div>
        <div class="code-body">
          <div class="cell-bar"><span>${esc(e.tool)}.py &middot; ${e.runtime === 'browser' ? 'browser' : 'gpu + stand-in'}</span><button class="run" data-run="${e.id}">&#9654; Run cell</button></div>
          <div class="slot" id="slot-${e.id}"><p class="ph">Not run yet. Press Run cell to start the tool.</p></div>
        </div>
      </section>`).join('');
    GL.$$('[data-run]').forEach(b => b.addEventListener('click', () => runCell(+b.dataset.run)));
  }

  function runCell(id) {
    const e = GL.EXPERIMENTS.find(x => x.id === id);
    if (!e) return;
    execCount += 1; counts[id] = execCount;
    $(`[data-in="${id}"]`).textContent = `In [${execCount}]:`;
    const slot = $('#slot-' + id);
    slot.innerHTML = '';
    GL.tools[e.tool].mount(slot, e);
    const btn = $(`[data-run="${id}"]`);
    btn.innerHTML = '&#8635; Restart cell';
  }

  function setAll(open) { GL.$$('#cells details').forEach(d => d.open = open); }
  $('#expand').addEventListener('click', () => setAll(true));
  $('#collapse').addEventListener('click', () => setAll(false));

  build();
  const m = location.hash.match(/exp-(\d+)/);
  if (m) {
    setTimeout(() => { const el = document.getElementById('exp-' + m[1]); if (el) el.scrollIntoView({ behavior: 'smooth' }); runCell(+m[1]); }, 50);
  }
})();
