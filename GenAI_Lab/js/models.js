// Experiments 5 (VAE), 6 (DCGAN), 7 (StyleGAN).

GL.tools.vae = {
  mount(root) {
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Encoder mean mu1 <output id="v-m1o">0.8</output></label><input type="range" id="v-m1" min="-3" max="3" step="0.05" value="0.8"></div>
        <div class="field"><label>Encoder mean mu2 <output id="v-m2o">-0.5</output></label><input type="range" id="v-m2" min="-3" max="3" step="0.05" value="-0.5"></div>
        <div class="field"><label>log variance logvar1 <output id="v-l1o">-1.2</output></label><input type="range" id="v-l1" min="-4" max="2" step="0.05" value="-1.2"></div>
        <div class="field"><label>log variance logvar2 <output id="v-l2o">-0.4</output></label><input type="range" id="v-l2" min="-4" max="2" step="0.05" value="-0.4"></div>
        <div class="field"><label>KL weight beta <output id="v-bo">1</output></label><input type="range" id="v-b" min="0" max="4" step="0.1" value="1"></div>
        <div class="field"><label>Samples to draw <output id="v-no">300</output></label><input type="range" id="v-n" min="50" max="1000" step="50" value="300"></div>
        <div class="field"><label>Seed</label><input type="number" id="v-seed" value="42"></div>
        <div class="field"><label>Input pixels x (values 0-1, comma separated)</label><input type="text" id="v-x" value="0,0.9,0.8,0.1,0.0,0.7,0.95,0.2"></div>
        <div class="field"><label>Reconstruction x_hat (0-1)</label><input type="text" id="v-xh" value="0.05,0.85,0.7,0.2,0.1,0.6,0.9,0.3"></div>
        <div class="actions"><button class="btn" id="v-run">Compute & sample</button><button class="btn ghost" id="v-redraw">Re-sample</button></div>
        <p class="note">The 2-D latent space matches Experiment 5 (784-pixel MNIST input, latent dimension 2). The decoder that turns z into digits needs the trained weights from the notebook.</p>
      </section>
      <section class="glass panel"><h4>Outputs</h4><div id="v-out"></div></section>`;
    const $ = s => GL.$(s, root);
    const bindOut = (id, oid, d = 2) => $(id).addEventListener('input', e => { $(oid).textContent = (+e.target.value).toFixed(d); calc(); });
    bindOut('#v-m1', '#v-m1o'); bindOut('#v-m2', '#v-m2o'); bindOut('#v-l1', '#v-l1o'); bindOut('#v-l2', '#v-l2o'); bindOut('#v-b', '#v-bo', 1);
    $('#v-n').addEventListener('input', e => { $('#v-no').textContent = e.target.value; calc(); });
    const parseVec = s => s.split(',').map(x => x.trim()).filter(Boolean).map(Number);
    const bce = (x, xh) => { let s = 0; for (let i = 0; i < x.length; i++) { const p = Math.min(Math.max(xh[i], 1e-7), 1 - 1e-7); s += -(x[i] * Math.log(p) + (1 - x[i]) * Math.log(1 - p)); } return s; };

    const calc = () => {
      const m = [+$('#v-m1').value, +$('#v-m2').value], lv = [+$('#v-l1').value, +$('#v-l2').value];
      const beta = +$('#v-b').value, N = +$('#v-n').value, seed = $('#v-seed').value;
      let x, xh, recon = NaN;
      try { x = parseVec($('#v-x').value); xh = parseVec($('#v-xh').value); if (x.length === xh.length && x.length) recon = bce(x, xh); } catch (e) {}
      const kl = [0, 1].map(i => -0.5 * (1 + lv[i] - m[i] * m[i] - Math.exp(lv[i])));
      const klTot = kl[0] + kl[1];
      const total = (isFinite(recon) ? recon : 0) + beta * klTot;
      const sd = lv.map(l => Math.exp(0.5 * l));
      const rand = GL.rng(seed + '-vae');
      const pts = [];
      for (let s = 0; s < N; s++) { const e1 = GL.gauss(rand), e2 = GL.gauss(rand); pts.push([m[0] + sd[0] * e1, m[1] + sd[1] * e2]); }
      const prior = []; const rp = GL.rng(seed + '-prior');
      for (let s = 0; s < 5; s++) prior.push([GL.gauss(rp), GL.gauss(rp)]);
      $('#v-out').innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${isFinite(recon) ? GL.fmt(recon, 3) : 'n/a'}</b><span>Reconstruction BCE</span></div>
          <div class="kpi"><b>${GL.fmt(klTot, 3)}</b><span>KL divergence</span></div>
          <div class="kpi"><b>${GL.fmt(total, 3)}</b><span>Total loss (recon + beta*KL)</span></div>
          <div class="kpi"><b>${sd.map(v => v.toFixed(2)).join(', ')}</b><span>Posterior std sigma</span></div>
        </div>
        <div class="scroll"><table class="data"><thead><tr><th>Latent dim</th><th>mu</th><th>sigma</th><th>KL term</th></tr></thead><tbody>
          ${[0, 1].map(i => `<tr><td>z${i + 1}</td><td>${m[i].toFixed(2)}</td><td>${sd[i].toFixed(3)}</td><td>${kl[i].toFixed(3)}</td></tr>`).join('')}
        </tbody></table></div>
        <h4 style="margin:8px 0">Reparameterisation samples: z = mu + sigma * eps</h4>
        <canvas id="v-plot" width="560" height="420" style="width:100%"></canvas>
        <h4 style="margin:12px 0 8px">Random latent vectors from the prior N(0, I)</h4>
        <pre class="out">${prior.map((p, i) => `z${i + 1} = [${p[0].toFixed(3)}, ${p[1].toFixed(3)}]`).join('\n')}</pre>
        <p class="note">Recon BCE: -sum(x log x_hat + (1-x) log(1-x_hat)). KL: -0.5 * sum(1 + logvar - mu^2 - exp(logvar)). Loss = recon + beta * KL.</p>
        <div class="actions"><button class="btn ghost small" id="v-dl">Download latent samples (.csv)</button></div>`;
      const cv = $('#v-plot'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, sc = 60;
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      [1, 2, 3].forEach(r => { ctx.strokeStyle = 'rgba(0,225,196,' + (0.5 - r * 0.12) + ')'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); });
      pts.forEach(([a, b]) => { ctx.fillStyle = 'rgba(255,95,162,.55)'; ctx.beginPath(); ctx.arc(cx + a * sc, cy - b * sc, 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#00e1c4'; ctx.beginPath(); ctx.arc(cx + m[0] * sc, cy - m[1] * sc, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(242,239,255,.7)'; ctx.font = '12px sans-serif';
      ctx.fillText('z1', W - 24, cy - 6); ctx.fillText('z2', cx + 6, 14); ctx.fillText('mu (teal) | samples (pink) | dashed = 1,2,3 sigma of N(0,I)', 12, H - 10);
      $('#v-dl').addEventListener('click', () => GL.download('z1,z2\n' + pts.map(p => p.map(v => v.toFixed(5)).join(',')).join('\n'), 'vae_latent_samples.csv', 'text/csv'));
    };
    $('#v-run').addEventListener('click', calc);
    $('#v-redraw').addEventListener('click', () => { $('#v-seed').value = Math.floor(Math.random() * 9999); calc(); });
    ['#v-x', '#v-xh', '#v-seed'].forEach(s => $(s).addEventListener('change', calc));
    calc();
  }
};

GL.tools.dcgan = {
  mount(root) {
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="row">
          <div class="field"><label>Latent size nz</label><input type="number" id="d-nz" value="100" min="8" max="512"></div>
          <div class="field"><label>Generator base ngf</label><input type="number" id="d-ngf" value="64" min="8" max="256"></div>
          <div class="field"><label>Discriminator base ndf</label><input type="number" id="d-ndf" value="64" min="8" max="256"></div>
        </div>
        <div class="row">
          <div class="field"><label>Image channels nc</label><select id="d-nc"><option value="3">3 (RGB)</option><option value="1">1 (gray)</option></select></div>
          <div class="field"><label>Image size</label><select id="d-size"><option value="64">64 x 64</option><option value="128">128 x 128</option></select></div>
        </div>
        <div class="row">
          <div class="field"><label>Dataset size</label><input type="number" id="d-data" value="202599"></div>
          <div class="field"><label>Batch size</label><input type="number" id="d-bs" value="128"></div>
          <div class="field"><label>Epochs</label><input type="number" id="d-ep" value="5"></div>
        </div>
        <div class="row">
          <div class="field"><label>Learning rate</label><input type="number" id="d-lr" value="0.0002" step="0.0001"></div>
          <div class="field"><label>Adam beta1</label><input type="number" id="d-b1" value="0.5" step="0.1"></div>
        </div>
        <h4 style="margin-top:14px">Loss calculator</h4>
        <div class="field"><label>D(x) on a real image <output id="d-dxo">0.90</output></label><input type="range" id="d-dx" min="0.01" max="0.99" step="0.01" value="0.9"></div>
        <div class="field"><label>D(G(z)) on a fake image <output id="d-dgzo">0.10</output></label><input type="range" id="d-dgz" min="0.01" max="0.99" step="0.01" value="0.1"></div>
        <div class="actions"><button class="btn" id="d-run">Build architecture</button></div>
        <p class="note">CelebA (aligned faces) has 202,599 images. Experiment 6 uses 64x64 RGB, batch 128 and nz=100 as in standard DCGAN.</p>
      </section>
      <section class="glass panel"><h4>Outputs</h4><div id="d-out"></div></section>`;
    const $ = s => GL.$(s, root);
    $('#d-dx').addEventListener('input', e => { $('#d-dxo').textContent = (+e.target.value).toFixed(2); lossOnly(); });
    $('#d-dgz').addEventListener('input', e => { $('#d-dgzo').textContent = (+e.target.value).toFixed(2); lossOnly(); });
    const lossHTML = () => {
      const dx = +$('#d-dx').value, dgz = +$('#d-dgz').value;
      const lD = -(Math.log(dx) + Math.log(1 - dgz)), lG = -Math.log(dgz);
      return `<div class="kpis">
        <div class="kpi"><b>${lD.toFixed(4)}</b><span>Discriminator loss L_D = -[log D(x) + log(1 - D(G(z)))]</span></div>
        <div class="kpi"><b>${lG.toFixed(4)}</b><span>Generator loss L_G = -log D(G(z)) (non-saturating)</span></div></div>`;
    };
    const lossOnly = () => { const el = GL.$('#d-loss', root); if (el) el.innerHTML = lossHTML(); };
    const run = () => {
      const nz = +$('#d-nz').value, ngf = +$('#d-ngf').value, ndf = +$('#d-ndf').value, nc = +$('#d-nc').value, S = +$('#d-size').value;
      const data = +$('#d-data').value, bs = +$('#d-bs').value, ep = +$('#d-ep').value, lr = $('#d-lr').value, b1 = $('#d-b1').value;
      // Generator: ConvTranspose2d(k=4). Output size = (in-1)*s - 2p + k
      const g = [];
      let s = 1, c = nz;
      const steps = [{ name: 'ConvT 4x4 s1 p0 + BN + ReLU', out: ngf * 8, k: 4, st: 1, p: 0 }];
      let sz = 4; let ch = ngf * 8;
      const gl = [{ layer: 'Input latent z', shape: `${nz} x 1 x 1`, params: 0 }];
      gl.push({ layer: 'ConvT 4x4, stride 1, pad 0 + BN + ReLU', shape: `${ngf * 8} x 4 x 4`, params: nz * ngf * 8 * 16 + 2 * ngf * 8 });
      let cur = ngf * 8; let size = 4;
      while (size < S) {
        const nxt = cur / 2; size = size * 2;
        gl.push({ layer: 'ConvT 4x4, stride 2, pad 1 + BN + ReLU', shape: `${nxt} x ${size} x ${size}`, params: cur * nxt * 16 + 2 * nxt });
        cur = nxt;
      }
      gl.push({ layer: 'ConvT 4x4 to image + Tanh', shape: `${nc} x ${S} x ${S}`, params: cur * nc * 16 });
      // Discriminator: Conv2d(k=4,s2,p1) Output = floor((in+2p-k)/s)+1
      const dl = [{ layer: 'Input image x', shape: `${nc} x ${S} x ${S}`, params: 0 }];
      let dsz = S, dch = nc, dout = ndf;
      dl.push({ layer: 'Conv 4x4 s2 p1 + LeakyReLU', shape: `${ndf} x ${S / 2} x ${S / 2}`, params: nc * ndf * 16 });
      dsz = S / 2; dch = ndf;
      while (dsz > 4) {
        const nxt = dch * 2; dsz = dsz / 2;
        dl.push({ layer: 'Conv 4x4 s2 p1 + BN + LeakyReLU', shape: `${nxt} x ${dsz} x ${dsz}`, params: dch * nxt * 16 + 2 * nxt });
        dch = nxt;
      }
      dl.push({ layer: 'Conv 4x4 s1 p0 + Sigmoid', shape: `1 x 1 x 1`, params: dch * 16 });
      const gP = gl.reduce((a, b) => a + b.params, 0), dP = dl.reduce((a, b) => a + b.params, 0);
      const batches = Math.ceil(data / bs);
      const totalSteps = batches * ep;
      $('#d-out').innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${(gP / 1e6).toFixed(2)} M</b><span>Generator params (approx.)</span></div>
          <div class="kpi"><b>${(dP / 1e6).toFixed(2)} M</b><span>Discriminator params (approx.)</span></div>
          <div class="kpi"><b>${batches.toLocaleString()}</b><span>Batches per epoch</span></div>
          <div class="kpi"><b>${totalSteps.toLocaleString()}</b><span>Total training steps</span></div>
        </div>
        <h4 style="margin:8px 0">Generator layers</h4>
        <div class="scroll"><table class="data"><thead><tr><th style="text-align:left">Layer</th><th>Output shape (C x H x W)</th><th>Params</th></tr></thead><tbody>
          ${gl.map(r => `<tr><td>${GL.esc(r.layer)}</td><td>${r.shape}</td><td>${r.params.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
        <h4 style="margin:8px 0">Discriminator layers</h4>
        <div class="scroll"><table class="data"><thead><tr><th style="text-align:left">Layer</th><th>Output shape (C x H x W)</th><th>Params</th></tr></thead><tbody>
          ${dl.map(r => `<tr><td>${GL.esc(r.layer)}</td><td>${r.shape}</td><td>${r.params.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
        <h4 style="margin:8px 0">GAN loss calculator</h4>
        <div id="d-loss">${lossHTML()}</div>
        <div class="field"><label>PyTorch setup (from the notebook)</label><pre class="code">criterion = nn.BCELoss()
optimizerD = optim.Adam(netD.parameters(), lr=${lr}, betas=(${b1}, 0.999))
optimizerG = optim.Adam(netG.parameters(), lr=${lr}, betas=(${b1}, 0.999))
fixed_noise = torch.randn(64, ${nz}, 1, 1, device=device)
# epochs=${ep}, batch_size=${bs}, image_size=${S}, nc=${nc}</pre></div>
        <div class="actions"><button class="btn ghost small" id="d-dl">Download architecture (.json)</button></div>`;
      GL.$('#d-dl', root).addEventListener('click', () => GL.download(JSON.stringify({ nz, ngf, ndf, nc, size: S, generator: gl, discriminator: dl, totalSteps }, null, 2), 'dcgan_architecture.json', 'application/json'));
    };
    $('#d-run').addEventListener('click', run);
    run();
  }
};

GL.tools.stylegan = {
  mount(root) {
    const D = 128, LAYERS = 18, MLP_DEPTH = 8;
    // Fixed mapping network weights (seeded, so the same every time)
    const rw = GL.rng('stylegan-mapping');
    const W = []; for (let l = 0; l < MLP_DEPTH; l++) { const M = new Float32Array(D * D); for (let i = 0; i < D * D; i++) M[i] = GL.gauss(rw) / Math.sqrt(D); W.push(M); }
    const mapping = z => {
      const nrm = Math.sqrt(z.reduce((s, v) => s + v * v, 0) / z.length) + 1e-8;
      let x = z.map(v => v / nrm);
      for (let l = 0; l < MLP_DEPTH; l++) {
        const y = new Array(D).fill(0);
        for (let i = 0; i < D; i++) { let s = 0; for (let j = 0; j < D; j++) s += W[l][i * D + j] * x[j]; y[i] = s > 0 ? s : 0.2 * s; }
        x = y;
      }
      return x;
    };
    const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na * nb) || 1); };
    // average w for truncation trick
    const rwa = GL.rng('stylegan-wavg'); let wavg = new Array(D).fill(0);
    for (let s = 0; s < 256; s++) { const z = Array.from({ length: D }, () => GL.gauss(rwa)); mapping(z).forEach((v, i) => wavg[i] += v / 256); }

    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="row">
          <div class="field"><label>Identity A seed</label><input type="text" id="s-a" value="alice"></div>
          <div class="field"><label>Identity B seed</label><input type="text" id="s-b" value="bob"></div>
        </div>
        <div class="field"><label>Crossover layer (layers 0..${LAYERS - 1}; A before, B after) <output id="s-co">6</output></label><input type="range" id="s-c" min="0" max="${LAYERS}" value="6"></div>
        <div class="field"><label>Truncation psi <output id="s-po">0.70</output></label><input type="range" id="s-p" min="0" max="1" step="0.05" value="0.7"></div>
        <div class="field"><label>Noise injection strength <output id="s-no">0.30</output></label><input type="range" id="s-n" min="0" max="1" step="0.05" value="0.3"></div>
        <div class="actions"><button class="btn" id="s-run">Map & mix</button></div>
        <p class="note">Layers 0-3 control coarse structure (4x4 to 8x8: pose, face shape), 4-9 middle features (16x16 to 32x32: hair, eyes), 10-17 fine detail (64x64 to 1024x1024: skin, hair texture). Mapping uses a small seeded MLP at dim ${D}; the real StyleGAN uses 512 with trained weights.</p>
      </section>
      <section class="glass panel"><h4>Outputs</h4><div id="s-out"></div></section>`;
    const $ = s => GL.$(s, root);
    $('#s-c').addEventListener('input', e => { $('#s-co').textContent = e.target.value; });
    $('#s-p').addEventListener('input', e => { $('#s-po').textContent = (+e.target.value).toFixed(2); });
    $('#s-n').addEventListener('input', e => { $('#s-no').textContent = (+e.target.value).toFixed(2); });
    const zOf = seed => { const r = GL.rng('z-' + seed); return Array.from({ length: D }, () => GL.gauss(r)); };
    const run = () => {
      const sa = $('#s-a').value || 'A', sb = $('#s-b').value || 'B', co = +$('#s-c').value, psi = +$('#s-p').value, ns = +$('#s-n').value;
      const zA = zOf(sa), zB = zOf(sb);
      const wA = mapping(zA), wB = mapping(zB);
      const trunc = w => w.map((v, i) => wavg[i] + psi * (v - wavg[i]));
      const tA = trunc(wA), tB = trunc(wB);
      const rows = [];
      for (let l = 0; l < LAYERS; l++) {
        const src = l < co ? 'A' : 'B';
        const res = 4 * 2 ** Math.floor(l / 2);
        const grp = l <= 3 ? 'coarse' : l <= 9 ? 'middle' : 'fine';
        const style = src === 'A' ? tA : tB;
        const noiseAmp = ns * (grp === 'fine' ? 1 : grp === 'middle' ? 0.5 : 0.1);
        rows.push({ l, res, grp, src, norm: Math.sqrt(style.reduce((s, v) => s + v * v, 0)), noiseAmp });
      }
      const mixed = rows.map(r => r.src === 'A' ? tA : tB);
      const cv = document.createElement('canvas');
      const wDim = D, hL = LAYERS;
      const colors = rows.map(r => r.src === 'A' ? [0, 225, 196] : [255, 95, 162]);
      // Heatmap of the mixed W matrix (layers x dims)
      const allV = mixed.flat(); const mn = Math.min(...allV), mx = Math.max(...allV);
      const vis = document.createElement('canvas'); vis.width = 512; vis.height = 300;
      const vx = vis.getContext('2d');
      const cw = 512 / wDim, ch = 300 / hL;
      mixed.forEach((row, li) => row.forEach((v, di) => {
        const t = (v - mn) / ((mx - mn) || 1);
        const [r, g, b] = colors[li];
        vx.fillStyle = `rgba(${Math.round(r * t + 20 * (1 - t))},${Math.round(g * t + 10 * (1 - t))},${Math.round(b * t + 40 * (1 - t))},1)`;
        vx.fillRect(di * cw, li * ch, cw + 1, ch + 1);
      }));
      // Noise map: stochastic detail per layer
      const nrand = GL.rng('noise-' + sa + sb);
      const nc2 = document.createElement('canvas'); nc2.width = 256; nc2.height = 256;
      const nx = nc2.getContext('2d'); const img = nx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const p = (y * 256 + x) * 4; const lvl = Math.floor(y / 256 * LAYERS);
        const v = 128 + (nrand() - 0.5) * 255 * rows[Math.min(lvl, LAYERS - 1)].noiseAmp;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.max(0, Math.min(255, v)); img.data[p + 3] = 255;
      }
      nx.putImageData(img, 0, 0);
      const cos_z = cos(zA, zB), cos_w = cos(wA, wB);
      $('#s-out').innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${cos_z.toFixed(3)}</b><span>cos(z_A, z_B) latent similarity</span></div>
          <div class="kpi"><b>${cos_w.toFixed(3)}</b><span>cos(w_A, w_B) after mapping</span></div>
          <div class="kpi"><b>${co}/${LAYERS}</b><span>Layers from identity A</span></div>
          <div class="kpi"><b>${psi.toFixed(2)}</b><span>Truncation psi</span></div>
        </div>
        <h4 style="margin:8px 0">Style-mixing schedule (A = teal, B = pink)</h4>
        <div class="scroll"><table class="data"><thead><tr><th>Layer</th><th>Resolution</th><th>Group</th><th>Source</th><th>|w| (mixed)</th><th>Noise amp</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${r.l}</td><td>${r.res}x${r.res}</td><td>${r.grp}</td><td style="color:${r.src === 'A' ? '#00e1c4' : '#ff5fa2'}">${r.src}</td><td>${r.norm.toFixed(2)}</td><td>${r.noiseAmp.toFixed(3)}</td></tr>`).join('')}
        </tbody></table></div>
        <h4 style="margin:8px 0">Mixed W matrix (rows = layers, columns = ${D} dims)</h4>
        <canvas id="s-heat" width="512" height="300" style="width:100%"></canvas>
        <h4 style="margin:12px 0 8px">Stochastic noise map (top = layer 0, bottom = layer ${LAYERS - 1})</h4>
        <canvas id="s-noise" width="256" height="256" style="width:200px"></canvas>
        <div class="actions"><button class="btn ghost small" id="s-dl">Download mixed W (.csv)</button></div>`;
      GL.$('#s-heat', root).getContext('2d').drawImage(vis, 0, 0);
      GL.$('#s-noise', root).getContext('2d').drawImage(nc2, 0, 0);
      GL.$('#s-dl', root).addEventListener('click', () => GL.download(mixed.map((r, i) => `layer${i},${rows[i].src},` + r.map(v => v.toFixed(5)).join(',')).join('\n'), 'stylegan_mixed_w.csv', 'text/csv'));
    };
    $('#s-run').addEventListener('click', run);
    run();
  }
};
