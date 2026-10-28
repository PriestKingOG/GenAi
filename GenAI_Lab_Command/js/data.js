// Experiment 1 (dataset analysis) and Experiment 2 (tensor operations).
GL.csv = {};
GL.csv.parse = function (text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  const split = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
};
GL.stats = {};
GL.stats.quantile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
GL.stats.pearson = (a, b) => {
  const n = a.length; if (n < 2) return NaN;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / (Math.sqrt(da * db) || NaN);
};

const SAMPLE_CSV = `student_id,age,study_hours,sleep_hours,attendance,score,city
1,19,4.5,7.0,92,78,Pune
2,20,2.0,5.5,70,55,Mumbai
3,21,6.0,8.0,98,91,Pune
4,19,,6.5,85,72,Delhi
5,22,3.5,,78,63,Mumbai
6,20,7.5,7.5,95,94,Delhi
7,23,1.0,5.0,60,41,Pune
8,21,5.0,6.0,88,80,
9,19,4.0,7.5,90,76,Mumbai
10,22,8.0,8.0,99,96,Delhi
11,20,2.5,5.0,65,48,Pune
12,24,6.5,,93,88,Mumbai
13,21,3.0,6.0,74,59,Delhi
14,19,5.5,7.0,91,83,Pune
15,22,4.5,6.5,82,70,Mumbai
16,23,7.0,7.0,96,92,Delhi
17,20,1.5,4.5,58,39,Pune
18,21,6.0,7.5,89,85,Mumbai
19,22,,6.0,80,66,Delhi
20,19,3.5,5.5,72,61,Pune
21,20,4.0,7.0,86,74,Mumbai
22,24,5.0,6.5,84,79,Delhi
23,21,2.5,5.5,69,57,Pune
24,22,6.0,7.0,94,89,Mumbai
25,21,6.0,7.0,94,89,Mumbai`;

GL.tools.eda = {
  mount(root) {
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>CSV file</label><input type="file" id="eda-file" accept=".csv,.txt"></div>
        <div class="actions"><button class="btn ghost small" id="eda-sample">Use sample student dataset</button></div>
        <div class="field"><label>Histogram column</label><select id="eda-col"></select></div>
        <div class="field"><label>Histogram bins <output id="eda-bins-o">12</output></label><input type="range" id="eda-bins" min="4" max="30" value="12"></div>
        <div class="field"><label>Missing numeric values</label>
          <select id="eda-fill"><option value="mean">Fill with column mean</option><option value="median">Fill with column median</option><option value="drop">Drop rows with any missing value</option><option value="keep">Keep as is</option></select></div>
        <div class="field"><label><span>Drop duplicate rows</span><input type="checkbox" id="eda-dup" checked></label></div>
        <div class="actions"><button class="btn" id="eda-run">Analyse dataset</button><button class="btn ghost" id="eda-export">Export cleaned CSV</button></div>
        <p class="note">Mirrors the notebook workflow: load with pandas, inspect, impute and deduplicate, then plot distributions and correlations.</p>
      </section>
      <section class="glass panel" id="eda-out-wrap"><h4>Outputs</h4><div id="eda-out"><p class="note">Load a file or the sample dataset, then press Analyse.</p></div></section>`;
    let raw = null, cleaned = null, info = null;
    const $ = s => GL.$(s, root);

    const numericOf = (rows, j) => rows.map(r => r[j]).filter(v => v !== '' && !isNaN(+v)).map(Number);
    const isNumeric = (rows, j) => { const vals = rows.map(r => r[j]).filter(v => v !== ''); return vals.length > 0 && vals.every(v => !isNaN(+v)); };

    const prepare = (parsed, fill, dup) => {
      let rows = parsed.rows.map(r => parsed.headers.map((_, j) => r[j] ?? ''));
      const numIdx = parsed.headers.map((_, j) => j).filter(j => isNumeric(rows, j));
      const removedDup = dup ? rows.length - new Set(rows.map(r => r.join('\u0001'))).size : 0;
      if (dup) { const seen = new Set(); rows = rows.filter(r => { const k = r.join('\u0001'); if (seen.has(k)) return false; seen.add(k); return true; }); }
      const fills = {};
      numIdx.forEach(j => { const v = numericOf(rows, j).sort((a, b) => a - b); fills[j] = fill === 'median' ? GL.stats.quantile(v, 0.5) : v.reduce((s, x) => s + x, 0) / (v.length || 1); });
      let filled = 0;
      if (fill === 'drop') rows = rows.filter(r => r.every(v => v !== ''));
      else if (fill === 'mean' || fill === 'median') rows = rows.map(r => r.map((v, j) => { if (v === '' && numIdx.includes(j)) { filled++; return String(+fills[j].toFixed(3)); } return v; }));
      return { headers: parsed.headers, rows, numIdx, removedDup, filled, fills };
    };

    const analyse = () => {
      if (!raw) { GL.$('#eda-out', root).innerHTML = '<p class="msg">Load a file or the sample dataset first.</p>'; return; }
      info = prepare(raw, $('#eda-fill').value, $('#eda-dup').checked);
      cleaned = info;
      const { headers, rows, numIdx } = info;
      const missingTotal = rows.reduce((s, r) => s + r.filter(v => v === '').length, 0);
      const origMissing = raw.rows.reduce((s, r) => s + headers.reduce((t, _, j) => t + ((r[j] ?? '') === '' ? 1 : 0), 0), 0);
      const colInfo = headers.map((h, j) => {
        const vals = rows.map(r => r[j]);
        const miss = vals.filter(v => v === '').length;
        const uniq = new Set(vals.filter(v => v !== '')).size;
        const isNum = numIdx.includes(j);
        const nums = isNum ? numericOf(rows, j) : [];
        return { h, j, type: isNum ? 'numeric' : 'text', miss, uniq, n: vals.length, nums };
      });
      const dfNums = colInfo.filter(c => c.type === 'numeric');
      const describeRows = dfNums.map(c => {
        const s = [...c.nums].sort((a, b) => a - b), n = s.length;
        const mean = s.reduce((a, b) => a + b, 0) / (n || 1);
        const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
        return { h: c.h, count: n, mean, sd, min: s[0], q1: GL.stats.quantile(s, 0.25), med: GL.stats.quantile(s, 0.5), q3: GL.stats.quantile(s, 0.75), max: s[n - 1] };
      });
      const sel = $('#eda-col');
      const prev = sel.value;
      sel.innerHTML = dfNums.map(c => `<option value="${c.j}">${GL.esc(c.h)}</option>`).join('');
      if (prev && dfNums.some(c => String(c.j) === prev)) sel.value = prev;

      const corrCols = dfNums;
      const corr = corrCols.map(a => corrCols.map(b => GL.stats.pearson(
        rows.filter(r => r[a.j] !== '' && r[b.j] !== '').map(r => +r[a.j]),
        rows.filter(r => r[a.j] !== '' && r[b.j] !== '').map(r => +r[b.j]))));
      const cell = v => { if (!isFinite(v)) return 'rgba(255,255,255,.04)'; const a = Math.abs(v); return v >= 0 ? `rgba(0,225,196,${0.1 + a * 0.6})` : `rgba(255,95,162,${0.1 + a * 0.6})`; };

      GL.$('#eda-out', root).innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${rows.length}</b><span>Rows after cleaning</span></div>
          <div class="kpi"><b>${headers.length}</b><span>Columns</span></div>
          <div class="kpi"><b>${origMissing}</b><span>Missing cells (raw)</span></div>
          <div class="kpi"><b>${info.filled}</b><span>Values imputed</span></div>
          <div class="kpi"><b>${info.removedDup}</b><span>Duplicates removed</span></div>
          <div class="kpi"><b>${missingTotal}</b><span>Missing (cleaned)</span></div>
        </div>
        <h4 style="margin:8px 0">Column profile</h4>
        <div class="scroll"><table class="data"><thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th></tr></thead><tbody>
          ${colInfo.map(c => `<tr><td>${GL.esc(c.h)}</td><td>${c.type}</td><td>${c.miss}</td><td>${c.uniq}</td></tr>`).join('')}
        </tbody></table></div>
        <h4 style="margin:8px 0">Numeric summary (describe)</h4>
        <div class="scroll"><table class="data"><thead><tr><th>Column</th><th>count</th><th>mean</th><th>std</th><th>min</th><th>25%</th><th>50%</th><th>75%</th><th>max</th></tr></thead><tbody>
          ${describeRows.map(d => `<tr><td>${GL.esc(d.h)}</td><td>${d.count}</td><td>${GL.fmt(d.mean, 2)}</td><td>${GL.fmt(d.sd, 2)}</td><td>${GL.fmt(d.min, 2)}</td><td>${GL.fmt(d.q1, 2)}</td><td>${GL.fmt(d.med, 2)}</td><td>${GL.fmt(d.q3, 2)}</td><td>${GL.fmt(d.max, 2)}</td></tr>`).join('') || '<tr><td>No numeric columns</td></tr>'}
        </tbody></table></div>
        <h4 style="margin:8px 0">Histogram</h4>
        <canvas id="eda-hist" width="640" height="260" style="width:100%"></canvas>
        <h4 style="margin:14px 0 8px">Correlation matrix (Pearson r)</h4>
        <div class="scroll"><table class="data heat"><thead><tr><th></th>${corrCols.map(c => `<th>${GL.esc(c.h)}</th>`).join('')}</tr></thead><tbody>
          ${corrCols.map((a, i) => `<tr><td>${GL.esc(a.h)}</td>${corr[i].map(v => `<td style="background:${cell(v)};text-align:center">${isFinite(v) ? v.toFixed(2) : '-'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <div class="actions"><button class="btn ghost small" id="eda-dl-report">Download summary (.json)</button></div>`;

      drawHist();
      GL.$('#eda-dl-report', root).addEventListener('click', () => GL.download(JSON.stringify({ rows: rows.length, columns: headers, describe: describeRows }, null, 2), 'eda_summary.json', 'application/json'));
    };

    const drawHist = () => {
      const cv = GL.$('#eda-hist', root); if (!cv || !info) return;
      const j = +$('#eda-col').value, bins = +$('#eda-bins').value;
      const nums = numericOf(info.rows, j);
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      if (!nums.length) return;
      const lo = Math.min(...nums), hi = Math.max(...nums), w = (hi - lo) / bins || 1;
      const counts = new Array(bins).fill(0);
      nums.forEach(v => counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++);
      const maxC = Math.max(...counts);
      const pad = 36, bw = (W - pad * 2) / bins;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#00e1c4'); g.addColorStop(1, '#7c5cff');
      counts.forEach((c, i) => {
        const h = (c / maxC) * (H - pad * 2);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(pad + i * bw + 3, H - pad - h, bw - 6, h, 6); ctx.fill();
        ctx.fillStyle = 'rgba(242,239,255,.7)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        if (c) ctx.fillText(c, pad + i * bw + bw / 2, H - pad - h - 5);
      });
      ctx.fillStyle = 'rgba(242,239,255,.6)'; ctx.font = '12px sans-serif';
      ctx.fillText(lo.toFixed(1), pad, H - 12); ctx.fillText(hi.toFixed(1), W - pad, H - 12);
      ctx.fillText(`${info.headers[j]} (n=${nums.length})`, W / 2, 16);
    };

    $('#eda-run').addEventListener('click', analyse);
    $('#eda-col').addEventListener('change', drawHist);
    $('#eda-bins').addEventListener('input', e => { $('#eda-bins-o').textContent = e.target.value; drawHist(); });
    $('#eda-sample').addEventListener('click', () => { raw = GL.csv.parse(SAMPLE_CSV); GL.toast('Sample dataset loaded'); analyse(); });
    $('#eda-file').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      raw = GL.csv.parse(await f.text()); GL.toast(`Loaded ${f.name}`); analyse();
    });
    $('#eda-export').addEventListener('click', () => {
      if (!cleaned) { GL.toast('Analyse a dataset first'); return; }
      const esc = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      const csv = [cleaned.headers.join(','), ...cleaned.rows.map(r => r.map(esc).join(','))].join('\n');
      GL.download(csv, 'cleaned_dataset.csv', 'text/csv');
    });
    raw = GL.csv.parse(SAMPLE_CSV);
    analyse();
  }
};

// ---------- Experiment 2: Tensor lab ----------
GL.nd = {};
GL.nd.parse = s => JSON.parse(s.trim() || '0');
GL.nd.shape = a => { const s = []; let c = a; while (Array.isArray(c)) { s.push(c.length); c = c[0]; } return s; };
GL.nd.flat = a => Array.isArray(a) ? a.flatMap(GL.nd.flat) : [a];
GL.nd.build = (flat, shape) => {
  if (shape.length === 0) return flat[0];
  const size = shape.slice(1).reduce((x, y) => x * y, 1);
  const out = []; for (let i = 0; i < shape[0]; i++) out.push(GL.nd.build(flat.slice(i * size, (i + 1) * size), shape.slice(1)));
  return out;
};
GL.nd.checkRect = (a, shape, d = 0) => {
  if (!Array.isArray(a)) { if (d !== shape.length) throw new Error('Ragged tensor: depth mismatch'); return; }
  if (a.length !== shape[d]) throw new Error('Ragged tensor: uneven lengths');
  a.forEach(x => GL.nd.checkRect(x, shape, d + 1));
};
GL.nd.bshape = (a, b) => {
  const n = Math.max(a.length, b.length), out = [];
  for (let i = 0; i < n; i++) {
    const da = a[i - (n - a.length)] ?? 1, db = b[i - (n - b.length)] ?? 1;
    if (da !== db && da !== 1 && db !== 1) throw new Error(`Shapes [${a}] and [${b}] are not broadcastable`);
    out.push(da === 1 ? db : da);
  }
  return out;
};
// elementwise op with numpy-style broadcasting, on flat data
GL.nd.zip = (A, B, f) => {
  const sa = A.shape, sb = B.shape, so = GL.nd.bshape(sa, sb);
  const total = so.reduce((x, y) => x * y, 1), n = so.length;
  const stride = s => { const st = new Array(s.length); let p = 1; for (let i = s.length - 1; i >= 0; i--) { st[i] = s[i] === 1 ? 0 : p; p *= s[i]; } return st; };
  const stA = stride(sa), stB = stride(sb);
  const out = new Array(total);
  for (let k = 0; k < total; k++) {
    let rem = k, ia = 0, ib = 0;
    for (let d = n - 1; d >= 0; d--) {
      const idx = rem % so[d]; rem = Math.floor(rem / so[d]);
      const da = d - (n - sa.length), db = d - (n - sb.length);
      if (da >= 0) ia += idx * stA[da];
      if (db >= 0) ib += idx * stB[db];
    }
    out[k] = f(A.data[ia], B.data[ib]);
  }
  return { data: out, shape: so };
};

GL.tools.tensor = {
  mount(root) {
    const OPS = {
      add: ['Add (A + B)', 'tf.add(a, b)'], sub: ['Subtract (A - B)', 'tf.subtract(a, b)'], mul: ['Multiply (A * B)', 'tf.multiply(a, b)'], div: ['Divide (A / B)', 'tf.divide(a, b)'],
      matmul: ['Matrix multiply (A @ B)', 'tf.matmul(a, b)'], transpose: ['Transpose A', 'tf.transpose(a)'], reshape: ['Reshape A to target shape', 'tf.reshape(a, [...])'],
      sum: ['Sum of A', 'tf.reduce_sum(a, axis=...)'], mean: ['Mean of A', 'tf.reduce_mean(a, axis=...)'], max: ['Max of A', 'tf.reduce_max(a, axis=...)'],
      relu: ['ReLU(A)', 'tf.nn.relu(a)'], sigmoid: ['Sigmoid(A)', 'tf.sigmoid(a)'], softmax: ['Softmax(A) over last axis', 'tf.nn.softmax(a)']
    };
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Tensor A (JSON nested list)</label><textarea id="t-a">[[1, 2, 3],\n [4, 5, 6]]</textarea></div>
        <div class="field"><label>Tensor B (JSON; a scalar like 2 also works)</label><textarea id="t-b" style="min-height:70px">[[1, 0, 1],\n [0, 1, 1], [1, 1, 0]]</textarea></div>
        <div class="field"><label>Operation</label><select id="t-op">${Object.keys(OPS).map(k => `<option value="${k}">${OPS[k][0]}</option>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label>Reshape target</label><input type="text" id="t-shape" value="3, 2"></div>
          <div class="field"><label>Reduce axis</label><select id="t-axis"><option value="">none (all)</option><option value="0">0</option><option value="1">1</option></select></div>
        </div>
        <div class="actions"><button class="btn" id="t-run">Compute</button></div>
        <p class="note">Shape, rank and dtype are reported for each tensor, like tf.shape / tf.rank. Broadcasting follows NumPy rules.</p>
      </section>
      <section class="glass panel"><h4>Outputs</h4><div id="t-out"></div></section>`;
    const $ = s => GL.$(s, root);
    const show = a => {
      const sh = GL.nd.shape(a);
      return { sh, rank: sh.length, size: sh.reduce((x, y) => x * y, 1) };
    };
    const pretty = a => JSON.stringify(a).replace(/\],\[/g, '],\n [').replace(/^\[\[/, '[[').replace(/^\[(?!\[)/, '[');
    const run = () => {
      const op = $('#t-op').value;
      try {
        const aRaw = GL.nd.parse($('#t-a').value);
        const bRaw = GL.nd.parse($('#t-b').value);
        const sa = GL.nd.shape(aRaw); GL.nd.checkRect(aRaw, sa);
        const A = { data: GL.nd.flat(aRaw), shape: sa };
        const bIsArr = Array.isArray(bRaw);
        const sbv = bIsArr ? GL.nd.shape(bRaw) : [];
        if (bIsArr) GL.nd.checkRect(bRaw, sbv);
        const B = { data: bIsArr ? GL.nd.flat(bRaw) : [bRaw], shape: sbv };
        let res, resShape, extra = '';
        const mm = (X, Y) => {
          if (X.shape.length !== 2 || Y.shape.length !== 2) throw new Error('matmul needs two 2-D tensors');
          const [m, k] = X.shape, [k2, n] = Y.shape;
          if (k !== k2) throw new Error(`Inner dimensions differ: ${k} vs ${k2}`);
          const out = [];
          for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { let s = 0; for (let t = 0; t < k; t++) s += X.data[i * k + t] * Y.data[t * n + j]; out.push(s); }
          return { data: out, shape: [m, n] };
        };
        const reduce = (X, f, init) => {
          const axisV = $('#t-axis').value;
          if (axisV === '') return { data: [X.data.reduce(f.fn, init)], shape: [] };
          if (X.shape.length !== 2) throw new Error('Axis reduction is shown for 2-D tensors');
          const [m, n] = X.shape; const ax = +axisV; const outs = [];
          if (ax === 0) for (let j = 0; j < n; j++) { const col = []; for (let i = 0; i < m; i++) col.push(X.data[i * n + j]); outs.push(col.reduce(f.fn, init)); return { data: outs, shape: [n] }; }
          for (let i = 0; i < m; i++) { const row = X.data.slice(i * n, i * n + n); outs.push(row.reduce(f.fn, init)); }
          return { data: outs, shape: [m] };
        };
        const finish = (r) => r;
        switch (op) {
          case 'add': case 'sub': case 'mul': case 'div': {
            const f = { add: (x, y) => x + y, sub: (x, y) => x - y, mul: (x, y) => x * y, div: (x, y) => x / y }[op];
            res = GL.nd.zip(A, B, f); break;
          }
          case 'matmul': res = mm(A, B); break;
          case 'transpose': {
            if (A.shape.length !== 2) throw new Error('transpose here handles 2-D tensors');
            const [m, n] = A.shape, out = [];
            for (let j = 0; j < n; j++) for (let i = 0; i < m; i++) out.push(A.data[i * n + j]);
            res = { data: out, shape: [n, m] }; break;
          }
          case 'reshape': {
            const target = $('#t-shape').value.split(',').map(s => s.trim()).filter(Boolean).map(Number);
            const size = A.data.length;
            const known = target.filter(x => x !== -1).reduce((x, y) => x * y, 1);
            const t2 = target.map(x => x === -1 ? size / known : x);
            if (t2.reduce((x, y) => x * y, 1) !== size) throw new Error(`Cannot reshape ${size} values into [${target}]`);
            res = { data: A.data, shape: t2 }; break;
          }
          case 'sum': res = reduce(A, { fn: (x, y) => x + y }, 0); break;
          case 'mean': { const s = reduce(A, { fn: (x, y) => x + y }, 0); const div = $('#t-axis').value === '' ? A.data.length : (A.shape[+$('#t-axis').value === 0 ? 0 : 1]); res = { data: s.data.map(v => v / div), shape: s.shape }; break; }
          case 'max': res = reduce(A, { fn: (x, y) => Math.max(x, y) }, -Infinity); break;
          case 'relu': res = { data: A.data.map(v => Math.max(0, v)), shape: A.shape }; break;
          case 'sigmoid': res = { data: A.data.map(v => 1 / (1 + Math.exp(-v))), shape: A.shape }; break;
          case 'softmax': {
            const n = A.shape[A.shape.length - 1] || A.data.length, out = [];
            for (let s = 0; s < A.data.length; s += n) {
              const row = A.data.slice(s, s + n), mx = Math.max(...row), ex = row.map(v => Math.exp(v - mx)), tot = ex.reduce((x, y) => x + y, 0);
              ex.forEach(v => out.push(v / tot));
            }
            res = { data: out, shape: A.shape }; break;
          }
        }
        resShape = res.shape;
        const resTensor = resShape.length ? GL.nd.build(res.data, resShape) : res.data[0];
        const ia = show(aRaw), ib = bIsArr ? show(bRaw) : { sh: [], rank: 0, size: 1 };
        const ir = { sh: resShape, rank: resShape.length, size: res.data.length };
        const codeA = `a = tf.constant(${JSON.stringify(aRaw)})`;
        const codeB = `b = tf.constant(${JSON.stringify(bRaw)})`;
        const opCode = OPS[op][1].replace('[...]', `[${$('#t-shape').value}]`).replace('axis=...', `axis=${$('#t-axis').value || 'None'}`);
        $('#t-out').innerHTML = `
          <div class="kpis">
            <div class="kpi"><b>[${ir.sh.join(', ')}]</b><span>Result shape</span></div>
            <div class="kpi"><b>${ir.rank}</b><span>Result rank</span></div>
            <div class="kpi"><b>${ir.size}</b><span>Elements</span></div>
            <div class="kpi"><b>float32</b><span>dtype (TF default)</span></div>
          </div>
          <div class="scroll"><table class="data"><thead><tr><th>Tensor</th><th>Shape</th><th>Rank</th><th>Size</th></tr></thead><tbody>
            <tr><td>A</td><td>[${ia.sh.join(', ')}]</td><td>${ia.rank}</td><td>${ia.size}</td></tr>
            <tr><td>B</td><td>[${ib.sh.join(', ')}]</td><td>${ib.rank}</td><td>${ib.size}</td></tr>
            <tr><td>Result</td><td>[${ir.sh.join(', ')}]</td><td>${ir.rank}</td><td>${ir.size}</td></tr>
          </tbody></table></div>
          <h4 style="margin:8px 0">Result</h4>
          <pre class="out">${GL.esc(pretty(resTensor))}</pre>
          <h4 style="margin:8px 0">Equivalent TensorFlow code</h4>
          <pre class="code">import tensorflow as tf\n\n${codeA}\n${codeB}\nresult = ${opCode}\nprint(result.shape, result.dtype)   # ${ir.sh.length ? '(' + ir.sh.join(', ') + ')' : '()'}, float32</pre>
          <div class="actions"><button class="btn ghost small" id="t-dl">Download result (.json)</button></div>`;
        GL.$('#t-dl', root).addEventListener('click', () => GL.download(JSON.stringify(resTensor, null, 2), 'tensor_result.json', 'application/json'));
      } catch (err) {
        $('#t-out').innerHTML = `<p class="msg">Error: ${GL.esc(err.message)}</p>`;
      }
    };
    $('#t-run').addEventListener('click', run);
    $('#t-op').addEventListener('change', run);
    run();
  }
};
