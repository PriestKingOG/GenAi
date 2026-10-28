// Command shell: a terminal log where you type commands; experiments mount inline; Ctrl+K palette.
(function () {
  const $ = GL.$, esc = GL.esc;
  const log = $('#log'), input = $('#cmd'), ctx = $('#ctx');
  const pad = n => String(n).padStart(2, '0');
  const history = []; let hIdx = 0; let last = null;

  const HELP = `<span class="h">Commands</span>
  ls [text]      list experiments, optionally filtered
  open N         run experiment N (or just type the number)
  next / prev    move to the next or previous experiment
  search TEXT    find experiments
  notebooks      show the notebook library
  clear          clear the screen
  <span class="d">Ctrl+K opens the palette. Up/Down recalls history.</span>`;

  function append(html, cmd) {
    const b = document.createElement('div');
    b.className = 'blk';
    b.innerHTML = (cmd ? `<div class="cmd">${esc(cmd)}</div>` : '') + `<div class="out">${html}</div>`;
    log.appendChild(b); log.scrollTop = log.scrollHeight;
  }

  function mountTool(e) {
    const b = document.createElement('div');
    b.className = 'blk';
    b.innerHTML = '<div class="tool-host"></div>';
    log.appendChild(b);
    GL.tools[e.tool].mount(b.querySelector('.tool-host'), e);
    log.scrollTop = log.scrollHeight;
  }

  function lsLine(e) {
    return `<span class="h">${pad(e.id)}</span>  ${esc(e.title)}  <span class="d">[${esc(e.category)} | ${e.runtime === 'browser' ? 'browser' : 'gpu'}]</span>`;
  }
  function filtered(text) {
    const q = (text || '').trim().toLowerCase();
    return GL.EXPERIMENTS.filter(e => !q || (e.title + ' ' + e.category + ' ' + e.short).toLowerCase().includes(q));
  }

  function openExp(id, raw) {
    const e = GL.EXPERIMENTS.find(x => x.id === id);
    if (!e) return append(`<span class="e">no experiment "${esc(String(id))}". Try ls.</span>`, raw);
    last = e; ctx.textContent = `exp-${pad(e.id)}`;
    append(`<span class="h">Exp ${e.id}: ${esc(e.title)}</span>
${esc(e.short)}
<span class="d">category: ${esc(e.category)}   level: ${esc(e.level)}   runtime: ${e.runtime === 'browser' ? 'browser' : 'GPU notebook + stand-in'}
notebook: ${e.notebooks.length ? e.notebooks.map(esc).join(', ') : 'none (PDF only)'}
source: ${esc(e.pdf)}</span>`, raw);
    mountTool(e);
  }

  function run(line) {
    const raw = line.trim();
    if (!raw) return;
    history.push(raw); hIdx = history.length;
    const parts = raw.split(/\s+/), cmd = parts[0].toLowerCase(), arg = parts.slice(1).join(' ');
    if (/^\d+$/.test(cmd)) return openExp(+cmd, raw);
    switch (cmd) {
      case 'help': return append(HELP, raw);
      case 'ls': return append(filtered(arg).map(lsLine).join('\n') || 'no matches', raw);
      case 'search': return append(filtered(arg).map(lsLine).join('\n') || 'no matches', raw);
      case 'open': case 'cd': return openExp(parseInt(arg, 10), raw);
      case 'next': return openExp(last ? last.id + 1 : 1, raw);
      case 'prev': return openExp(last ? last.id - 1 : 10, raw);
      case 'notebooks': return append(GL.NOTEBOOKS.map(n => '  ' + esc(n)).join('\n'), raw);
      case 'clear': log.innerHTML = ''; return;
      default: return append(`<span class="e">command not found: ${esc(cmd)}</span>. Type <b>help</b>.`, raw);
    }
  }

  // ---- input line ----
  $('#form').addEventListener('submit', e => { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx] || ''; e.preventDefault(); }
    if (e.key === 'ArrowDown') { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; e.preventDefault(); }
  });

  // ---- palette ----
  const pal = $('#pal'), palq = $('#palq'), pallist = $('#pallist');
  let sel = 0, shown = [];
  function renderPal() {
    shown = filtered(palq.value).slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    pallist.innerHTML = shown.map((e, i) => `<li data-i="${i}" class="${i === sel ? 'sel' : ''}"><span class="n">${pad(e.id)}</span>${esc(e.title)}<span class="t">${esc(e.category)}</span></li>`).join('') || '<li>no matches</li>';
    GL.$$('#pallist li[data-i]').forEach(li => li.addEventListener('click', () => choose(+li.dataset.i)));
  }
  function openPal() { pal.classList.remove('hidden'); palq.value = ''; sel = 0; renderPal(); palq.focus(); }
  function closePal() { pal.classList.add('hidden'); input.focus(); }
  function choose(i) { const e = shown[i]; closePal(); if (e) run('open ' + e.id); }
  palq.addEventListener('input', () => { sel = 0; renderPal(); });
  palq.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); renderPal(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderPal(); e.preventDefault(); }
    if (e.key === 'Enter') { choose(sel); e.preventDefault(); }
  });
  pal.addEventListener('click', e => { if (e.target === pal) closePal(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('hidden') ? openPal() : closePal(); }
    if (e.key === 'Escape' && !pal.classList.contains('hidden')) closePal();
  });

  // boot
  append(`Welcome to the GenAI Lab terminal. Type <b>ls</b> to list experiments, <b>open 5</b> to run one, or press <b>Ctrl+K</b>.`);
  const m = location.hash.match(/(\d+)$/);
  if (m) run('open ' + m[1]);
  input.focus();
})();
