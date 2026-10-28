// Deck shell: swipeable card row; each experiment opens in a full-screen stage with dots and arrow keys.
(function () {
  const $ = GL.$, esc = GL.esc;
  const COLORS = [
    { bg: '#ff7a59', fg: '#ffffff' }, { bg: '#ffc857', fg: '#1b1b1f' }, { bg: '#2ec4b6', fg: '#06302c' },
    { bg: '#7b6cf6', fg: '#ffffff' }, { bg: '#ff5e8a', fg: '#ffffff' }, { bg: '#4cc9f0', fg: '#062a36' }
  ];
  const colorOf = e => COLORS[(e.id - 1) % COLORS.length];
  const pad = n => String(n).padStart(2, '0');
  const track = $('#track');

  function renderHome() {
    track.innerHTML = GL.EXPERIMENTS.map(e => {
      const c = colorOf(e);
      return `<article class="dcard" data-open="${e.id}" style="background:${c.bg};color:${c.fg}">
        <div class="no">${pad(e.id)}</div>
        <div class="cat">${esc(e.category)}</div>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.short)}</p>
        <div class="foot"><span class="pill">${e.runtime === 'browser' ? 'Runs in browser' : 'GPU + stand-in'}</span><span class="go">Open</span></div>
      </article>`;
    }).join('');
    GL.$$('[data-open]', track).forEach(c => c.addEventListener('click', () => { location.hash = '#/exp/' + c.dataset.open; }));
  }

  function scrollCards(dir) {
    const card = track.querySelector('.dcard');
    if (!card) return;
    track.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' });
  }

  function renderStage(e) {
    const c = colorOf(e), idx = GL.EXPERIMENTS.indexOf(e);
    const prev = GL.EXPERIMENTS[idx - 1], next = GL.EXPERIMENTS[idx + 1];
    $('#stage-top').style.background = c.bg;
    $('#stage-top').style.color = c.fg;
    $('#stage-top').innerHTML = `
      <button class="back" id="back">&larr; All cards</button>
      <div style="font-size:.85rem;opacity:.9;letter-spacing:.08em;text-transform:uppercase">${esc(e.category)} &middot; Exp ${e.id} &middot; ${esc(e.level)}</div>
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.short)}</p>`;
    $('#back').addEventListener('click', () => { location.hash = '#/'; });
    $('#dots').innerHTML = GL.EXPERIMENTS.map(x => `<button data-dot="${x.id}" class="${x.id === e.id ? 'on' : ''}" aria-label="Experiment ${x.id}" title="Exp ${x.id}"></button>`).join('');
    GL.$$('[data-dot]', $('#dots')).forEach(b => b.addEventListener('click', () => { location.hash = '#/exp/' + b.dataset.dot; }));
    $('#s-prev').disabled = !prev; $('#s-next').disabled = !next;
    $('#s-prev').onclick = () => prev && (location.hash = '#/exp/' + prev.id);
    $('#s-next').onclick = () => next && (location.hash = '#/exp/' + next.id);
    const body = $('#stage-body');
    body.innerHTML = `<div class="runtime-note" style="margin-bottom:6px;font-size:.85rem;color:#6d6a64">${e.runtime === 'browser' ? 'Runs fully in your browser.' : 'Browser stand-in. The full model runs in the linked GPU notebook.'}${e.notebooks.length ? ' Notebook: ' + e.notebooks.map(esc).join(', ') + '.' : ''}</div><div id="tool-slot"></div>`;
    GL.tools[e.tool].mount($('#tool-slot'), e);
    window.scrollTo(0, 0);
  }

  function route() {
    const m = location.hash.match(/^#\/exp\/(\d+)$/);
    const e = m ? GL.EXPERIMENTS.find(x => x.id === +m[1]) : null;
    if (e) {
      $('#home').classList.add('hidden'); $('#stage').classList.remove('hidden');
      renderStage(e);
    } else {
      $('#stage').classList.add('hidden'); $('#home').classList.remove('hidden');
      window.scrollTo(0, 0);
    }
  }

  $('#prev-card').addEventListener('click', () => scrollCards(-1));
  $('#next-card').addEventListener('click', () => scrollCards(1));
  document.addEventListener('keydown', ev => {
    if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    const m = location.hash.match(/^#\/exp\/(\d+)$/);
    if (m) {
      const id = +m[1];
      if (ev.key === 'ArrowRight' && id < GL.EXPERIMENTS.length) location.hash = '#/exp/' + (id + 1);
      if (ev.key === 'ArrowLeft' && id > 1) location.hash = '#/exp/' + (id - 1);
      if (ev.key === 'Escape') location.hash = '#/';
    } else {
      if (ev.key === 'ArrowRight') scrollCards(1);
      if (ev.key === 'ArrowLeft') scrollCards(-1);
    }
  });
  window.addEventListener('hashchange', route);
  renderHome();
  route();
})();
