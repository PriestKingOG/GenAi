// Atlas shell: sidebar navigation, overview table, experiment workspace with info rail.
(function () {
  const $ = GL.$, esc = GL.esc;
  let query = '';
  let activeId = null;
  const runtimeTag = e => `<span class="tag ${e.runtime === 'browser' ? 'ok' : 'warn'}">${e.runtime === 'browser' ? 'In browser' : 'GPU + stand-in'}</span>`;

  function renderNav(activeId) {
    const q = query.trim().toLowerCase();
    const cats = [...new Set(GL.EXPERIMENTS.map(e => e.category))];
    $('#nav').innerHTML = `
      <a class="nav-home ${activeId == null ? 'active' : ''}" href="#/">Overview <span>${GL.EXPERIMENTS.length}</span></a>
      ${cats.map(c => {
        const items = GL.EXPERIMENTS.filter(e => e.category === c && (!q || (e.title + ' ' + c).toLowerCase().includes(q)));
        if (!items.length) return '';
        return `<div class="nav-group"><h5>${esc(c)}</h5>${items.map(e =>
          `<a class="nav-item ${e.id === activeId ? 'active' : ''}" href="#/exp/${e.id}"><i>${String(e.id).padStart(2, '0')}</i>${esc(e.title)}</a>`).join('')}</div>`;
      }).join('')}`;
  }

  function renderOverview() {
    const browser = GL.EXPERIMENTS.filter(e => e.runtime === 'browser').length;
    $('#main').innerHTML = `
      <div class="page-head"><h1>Experiments</h1>
      <p>Each experiment is a working tool. Pick one to enter inputs, run it and export the outputs. Heavy models run in your GPU notebooks; here you get the same settings, a browser stand-in and runnable code.</p></div>
      <div class="stats">
        <div class="glass stat"><b>${GL.EXPERIMENTS.length}</b><span>Experiments</span></div>
        <div class="glass stat"><b>${browser}</b><span>Run in browser</span></div>
        <div class="glass stat"><b>${GL.NOTEBOOKS.length}</b><span>Linked notebooks</span></div>
      </div>
      <div class="glass table-wrap"><table class="list">
        <thead><tr><th>No.</th><th>Experiment</th><th>Category</th><th>Level</th><th>Runtime</th></tr></thead>
        <tbody>${GL.EXPERIMENTS.map(e => `
          <tr class="row-link" data-go="${e.id}">
            <td>${String(e.id).padStart(2, '0')}</td>
            <td><strong>${esc(e.title)}</strong><div style="color:#64748b;font-size:.84rem;margin-top:3px">${esc(e.short)}</div></td>
            <td><span class="tag cat">${esc(e.category)}</span></td>
            <td>${esc(e.level)}</td>
            <td>${runtimeTag(e)}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="glass panel"><h4>Notebook library</h4><ul class="nblist" style="margin-top:12px">${GL.NOTEBOOKS.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
    GL.$$('[data-go]').forEach(r => r.addEventListener('click', () => { location.hash = '#/exp/' + r.dataset.go; }));
  }

  function renderExperiment(id) {
    const e = GL.EXPERIMENTS.find(x => x.id === id);
    if (!e) { location.hash = '#/'; return; }
    const idx = GL.EXPERIMENTS.indexOf(e), prev = GL.EXPERIMENTS[idx - 1], next = GL.EXPERIMENTS[idx + 1];
    $('#main').innerHTML = `
      <div class="page-head">
        <div class="crumb"><a href="#/">Experiments</a> &nbsp;/&nbsp; ${esc(e.category)} &nbsp;/&nbsp; Exp ${e.id}</div>
        <h1>${esc(e.title)}</h1>
        <p>${esc(e.short)}</p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${runtimeTag(e)} <span class="tag cat">${esc(e.level)}</span></div>
      </div>
      <div class="workspace">
        <div class="tool" id="tool"></div>
        <aside class="rail glass">
          <h4>Aim</h4><p style="margin:0">${esc(e.aim)}</p>
          <h4>Objectives</h4><ul>${e.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          <h4>Source</h4><p style="margin:0">${esc(e.pdf)}</p>
          <h4>Notebook</h4><p style="margin:0">${e.notebooks.length ? e.notebooks.map(esc).join('<br>') : 'None (PDF only)'}</p>
          <div class="prev-next">
            ${prev ? `<a class="btn ghost small" href="#/exp/${prev.id}">&larr; Exp ${prev.id}</a>` : ''}
            ${next ? `<a class="btn ghost small" href="#/exp/${next.id}">Exp ${next.id} &rarr;</a>` : ''}
          </div>
        </aside>
      </div>`;
    GL.tools[e.tool].mount($('#tool'), e);
  }

  function route() {
    const m = location.hash.match(/^#\/exp\/(\d+)$/);
    const id = m ? +m[1] : null;
    activeId = id;
    renderNav(id);
    if (id) renderExperiment(id); else renderOverview();
    window.scrollTo(0, 0);
  }

  $('#q').addEventListener('input', e => { query = e.target.value; renderNav(activeId); });
  window.addEventListener('hashchange', route);
  route();
})();
