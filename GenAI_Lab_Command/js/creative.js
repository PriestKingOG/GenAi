// Experiments 4 (text-to-image), 8 (music), 10 (text-to-video). Browser stand-ins + runnable model code.

GL.hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- Experiment 4 ----------
GL.tools.image = {
  mount(root) {
    const STYLES = {
      'Photorealistic': ['#1b2a3a', '#e7c79b', '#7fa6b8'], 'Watercolor': ['#fbe9e7', '#90caf9', '#f8bbd0'],
      'Cyberpunk': ['#0b0020', '#ff2e88', '#00f0ff'], 'Oil painting': ['#3b2a1a', '#d08c3a', '#6b8e4e'], 'Minimal': ['#f4f4f4', '#222222', '#d7d7d7']
    };
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Prompt</label><textarea id="i-p">a lighthouse on a cliff at sunset, dramatic clouds, highly detailed</textarea></div>
        <div class="field"><label>Negative prompt</label><input type="text" id="i-np" value="blurry, low quality, watermark"></div>
        <div class="field"><label>Style preset</label><select id="i-style">${Object.keys(STYLES).map(s => `<option>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Inference steps <output id="i-so">30</output></label><input type="range" id="i-s" min="1" max="50" value="30"></div>
        <div class="field"><label>Guidance scale <output id="i-go">7.5</output></label><input type="range" id="i-g" min="1" max="15" step="0.5" value="7.5"></div>
        <div class="row">
          <div class="field"><label>Seed</label><input type="number" id="i-seed" value="42"></div>
          <div class="field"><label>Size</label><select id="i-size"><option value="512">512 x 512</option><option value="768">768 x 768</option><option value="1024">1024 x 1024</option></select></div>
        </div>
        <div class="actions"><button class="btn" id="i-run">Generate</button><button class="btn ghost" id="i-rand">Random seed</button></div>
        <p class="note">Browser preview: a seeded procedural image that denoises from noise over the chosen steps, with guidance controlling contrast and saturation. For real SDXL images, run the generated script on a GPU.</p>
      </section>
      <section class="glass panel">
        <h4>Outputs</h4>
        <div style="display:flex;justify-content:center"><canvas id="i-cv" width="512" height="512" style="width:min(100%,460px)"></canvas></div>
        <p class="msg" id="i-status" style="text-align:center"></p>
        <div class="actions" style="justify-content:center"><button class="btn ghost small" id="i-png" disabled>Download PNG</button></div>
        <h4 style="margin-top:14px">SDXL script for the notebook (GPU)</h4>
        <pre class="code" id="i-code"></pre>
        <div class="actions"><button class="btn ghost small" id="i-copy">Copy script</button></div>
      </section>`;
    const $ = s => GL.$(s, root);
    $('#i-s').addEventListener('input', e => $('#i-so').textContent = e.target.value);
    $('#i-g').addEventListener('input', e => { $('#i-go').textContent = (+e.target.value).toFixed(1); });
    let anim = 0, lastDone = null;
    const cv = $('#i-cv'), ctx = cv.getContext('2d');
    const noiseCv = document.createElement('canvas'), targetCv = document.createElement('canvas');
    noiseCv.width = targetCv.width = 512; noiseCv.height = targetCv.height = 512;

    const code = () => {
      const p = $('#i-p').value.replace(/"/g, '\\"'), np = $('#i-np').value.replace(/"/g, '\\"');
      const sz = $('#i-size').value, steps = $('#i-s').value, g = $('#i-g').value, seed = $('#i-seed').value;
      return `import torch
from diffusers import StableDiffusionXLPipeline

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
).to("cuda")

image = pipe(
    prompt="${p}",
    negative_prompt="${np}",
    num_inference_steps=${steps},
    guidance_scale=${g},
    width=${sz}, height=${sz},
    generator=torch.Generator("cuda").manual_seed(${seed}),
).images[0]
image.save("output.png")`;
    };
    const buildTarget = () => {
      const p = $('#i-p').value, style = $('#i-style').value, g = +$('#i-g').value, seed = $('#i-seed').value;
      const pal = STYLES[style], r = GL.rng(GL.hash(p) + '-' + seed);
      const tc = targetCv.getContext('2d'), W = 512;
      tc.filter = `saturate(${(0.6 + g * 0.06).toFixed(2)}) contrast(${(0.9 + g * 0.02).toFixed(2)})`;
      const grd = tc.createLinearGradient(0, 0, 0, W); grd.addColorStop(0, pal[0]); grd.addColorStop(1, pal[2]);
      tc.fillStyle = grd; tc.fillRect(0, 0, W, W);
      const words = p.toLowerCase().match(/[a-z]+/g) || [];
      const blobs = 6 + (words.length % 8) * 2;
      for (let i = 0; i < blobs; i++) {
        tc.globalAlpha = 0.35 + r() * 0.5;
        tc.fillStyle = [pal[1], pal[2], pal[0]][Math.floor(r() * 3)];
        const x = r() * W, y = r() * W, rad = 40 + r() * 140;
        tc.beginPath(); tc.ellipse(x, y, rad, rad * (0.5 + r()), r() * Math.PI, 0, Math.PI * 2); tc.fill();
      }
      tc.globalAlpha = 0.9; tc.fillStyle = pal[1];
      const sunY = W * (0.35 + r() * 0.3); tc.beginPath(); tc.arc(W * (0.3 + r() * 0.4), sunY, 60 + r() * 50, 0, Math.PI * 2); tc.fill();
      tc.globalAlpha = 1; tc.filter = 'none';
      tc.filter = 'blur(6px)'; tc.drawImage(targetCv, 0, 0); tc.filter = 'none';
    };
    const buildNoise = () => {
      const nctx = noiseCv.getContext('2d'), img = nctx.createImageData(512, 512), r = GL.rng($('#i-seed').value + '-noise');
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = v; img.data[i + 1] = r() * 255; img.data[i + 2] = r() * 255; img.data[i + 3] = 255; }
      nctx.putImageData(img, 0, 0);
    };
    const frame = (p) => {
      ctx.clearRect(0, 0, 512, 512);
      ctx.globalAlpha = 1; ctx.drawImage(noiseCv, 0, 0);
      ctx.globalAlpha = Math.min(1, Math.pow(p, 1.4)); ctx.drawImage(targetCv, 0, 0);
      ctx.globalAlpha = 1;
    };
    const generate = () => {
      cancelAnimationFrame(anim);
      code(); $('#i-code', root).textContent = code();
      buildTarget(); buildNoise();
      const steps = +$('#i-s').value, total = Math.min(3000, steps * 60);
      const t0 = performance.now(); $('#i-png').disabled = true;
      const step = now => {
        const p = Math.min(1, (now - t0) / total);
        frame(p);
        const cur = Math.min(steps, Math.max(1, Math.ceil(p * steps)));
        $('#i-status', root).textContent = p < 1 ? `Denoising step ${cur} / ${steps}` : `Done in ${steps} steps, guidance ${(+$('#i-g').value).toFixed(1)}, seed ${$('#i-seed').value}`;
        if (p < 1) anim = requestAnimationFrame(step);
        else { lastDone = true; $('#i-png', root).disabled = false; }
      };
      anim = requestAnimationFrame(step);
    };
    $('#i-run').addEventListener('click', generate);
    $('#i-rand').addEventListener('click', () => { $('#i-seed').value = Math.floor(Math.random() * 1e6); generate(); });
    $('#i-png').addEventListener('click', () => { cv.toBlob(b => GL.download(b, 'sdxl_preview.png', 'image/png')); });
    $('#i-copy').addEventListener('click', () => GL.copy(code()));
    ['#i-p', '#i-np', '#i-style', '#i-seed', '#i-size'].forEach(s => $(s).addEventListener('change', code));
    code(); $('#i-code', root).textContent = code();
    generate();
  }
};

// ---------- Experiment 8 ----------
GL.tools.music = {
  mount(root) {
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Describe the music</label><textarea id="m-p">peaceful piano music with soft flute, slow and calm</textarea></div>
        <div class="field"><label>Duration (seconds) <output id="m-do">12</output></label><input type="range" id="m-d" min="4" max="30" value="12"></div>
        <div class="field"><label>Creativity / temperature <output id="m-to">0.6</output></label><input type="range" id="m-t" min="0.1" max="1.5" step="0.1" value="0.6"></div>
        <div class="row">
          <div class="field"><label>Seed</label><input type="number" id="m-seed" value="7"></div>
          <div class="field"><label>Tempo override (BPM, 0 = from prompt)</label><input type="number" id="m-bpm" value="0"></div>
        </div>
        <div class="actions"><button class="btn" id="m-gen">Compose</button><button class="btn ghost" id="m-play">Play</button><button class="btn ghost" id="m-stop">Stop</button></div>
        <div class="actions"><button class="btn ghost small" id="m-wav" disabled>Download WAV</button></div>
        <p class="note">Browser stand-in: notes are composed from prompt keywords (tempo, mood, instrument, drums) and synthesised here. MusicGen itself produces the real music in the notebook.</p>
      </section>
      <section class="glass panel">
        <h4>Outputs</h4>
        <div id="m-info"></div>
        <canvas id="m-roll" width="640" height="220" style="width:100%"></canvas>
        <h4 style="margin:14px 0 8px">MusicGen code for the notebook (GPU)</h4>
        <pre class="code" id="m-code"></pre>
      </section>`;
    const $ = s => GL.$(s, root);
    $('#m-d').addEventListener('input', e => $('#m-do').textContent = e.target.value);
    $('#m-t').addEventListener('input', e => $('#m-to').textContent = (+e.target.value).toFixed(1));
    const SR = 22050;
    let audioCtx = null, src = null, wavData = null;
    const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
    const midiToF = m => 440 * Math.pow(2, (m - 69) / 12);

    const parse = (prompt, seed, bpmOverride) => {
      const p = prompt.toLowerCase(), r = GL.rng('music-' + seed + prompt);
      let bpm = /fast|upbeat|energetic|dance|edm|rock|party|driv/.test(p) ? 124 : /slow|calm|peaceful|ambient|sleep|soft|relax/.test(p) ? 74 : 98;
      if (bpmOverride > 0) bpm = bpmOverride;
      const minor = /sad|dark|melanchol|minor|moody|lonely|night/.test(p);
      const inst = /flute/.test(p) && !/piano/.test(p) ? 'flute' : /synth|electronic|edm|techno/.test(p) ? 'synth' : /guitar/.test(p) ? 'guitar' : 'piano';
      const drums = /drum|beat|dance|edm|rock|energetic|party|upbeat/.test(p);
      const root = 57 + Math.floor(r() * 12);
      return { bpm, minor, inst, drums, root, r };
    };

    const compose = () => {
      const prompt = $('#m-p').value, dur = +$('#m-d').value, temp = +$('#m-t').value, seed = $('#m-seed').value;
      const cfg = parse(prompt, seed, +$('#m-bpm').value);
      const scale = cfg.minor ? MIN : MAJ, r = cfg.r;
      const beat = 60 / cfg.bpm, notes = [];
      const chordDeg = cfg.minor ? [0, 5, 3, 4] : [0, 4, 5, 3]; // I-V-vi-IV (or i-VI-iv-V in minor)
      let deg = Math.floor(r() * 7), t = 0;
      while (t < dur) {
        const bar = Math.floor(t / (4 * beat)), chord = chordDeg[bar % 4];
        const len = r() < 0.6 ? 1 : 0.5;
        const step = Math.round((r() - 0.5) * 4 * temp + (r() < 0.2 * temp ? (r() - 0.5) * 6 : 0));
        deg = Math.max(-3, Math.min(9, deg + step));
        const isDown = Math.abs(t - bar * 4 * beat) < 1e-6;
        if (isDown && r() < 0.6) deg = chord + (r() < 0.5 ? 0 : 2);
        const octave = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7;
        const midi = cfg.root + scale[idx] + 12 * octave;
        const d = Math.min(len * beat, dur - t);
        if (r() > 0.1) notes.push({ t, d, midi, vel: 0.55 + r() * 0.3 });
        t += len * beat;
      }
      return { cfg, notes, beat, dur, prompt, seed, temp };
    };

    const renderAudio = (C) => {
      const n = Math.floor(C.dur * SR), buf = new Float32Array(n);
      const add = (start, len, f, fn) => {
        const s0 = Math.floor(start * SR), s1 = Math.min(n, s0 + Math.floor(len * SR));
        for (let i = s0; i < s1; i++) buf[i] += fn((i - s0) / SR, len, f);
      };
      const voice = {
        piano: (tt, L, f) => (Math.sin(2 * Math.PI * f * tt) * Math.exp(-3 * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-6 * tt)) * Math.min(1, tt / 0.005) * 0.6,
        flute: (tt, L, f) => Math.sin(2 * Math.PI * (f + 3 * Math.sin(2 * Math.PI * 5 * tt)) * tt) * Math.min(1, tt / 0.12) * Math.min(1, (L - tt) / 0.12) * 0.45,
        synth: (tt, L, f) => { let s = 0; for (let k = 1; k <= 6; k++) s += Math.sin(2 * Math.PI * f * k * tt) / k; return s * 0.22 * Math.min(1, tt / 0.02) * Math.min(1, (L - tt) / 0.08); },
        guitar: (tt, L, f) => (Math.sin(2 * Math.PI * f * tt) + 0.5 * Math.sin(6 * Math.PI * f * tt)) * Math.exp(-4 * tt) * 0.55
      }[C.cfg.inst];
      C.notes.forEach(nt => add(nt.t, nt.d, midiToF(nt.midi), (tt, L, f) => voice(tt, L, f) * nt.vel));
      if (C.cfg.drums) {
        const rr = GL.rng('drums-' + C.seed);
        for (let b = 0; b * C.beat < C.dur; b++) {
          const tb = b * C.beat;
          if (b % 2 === 0) add(tb, 0.18, 0, (tt) => Math.sin(2 * Math.PI * (120 - 600 * tt) * tt) * Math.exp(-14 * tt) * 0.8);
          if (b % 2 === 1) add(tb, 0.05, 0, () => (rr() * 2 - 1) * 0.12);
        }
      }
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
      if (peak > 0) for (let i = 0; i < n; i++) buf[i] = buf[i] / peak * 0.9;
      return buf;
    };

    const encodeWav = (f32) => {
      const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true);
      v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32767, true);
      return new Blob([buf], { type: 'audio/wav' });
    };

    const drawRoll = (C) => {
      const cv = $('#m-roll'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const midis = C.notes.map(n => n.midi), lo = Math.min(...midis) - 1, hi = Math.max(...midis) + 1;
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      for (let m = lo; m <= hi; m++) { const y = H - (m - lo) / (hi - lo + 1) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      C.notes.forEach(nt => {
        const x = nt.t / C.dur * W, w = Math.max(3, nt.d / C.dur * W - 2);
        const y = H - (nt.midi - lo + 1) / (hi - lo + 1) * H, h = Math.max(4, H / (hi - lo + 1) - 2);
        const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#00e1c4'); g.addColorStop(1, '#7c5cff');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y - h, w, h, 4); ctx.fill();
      });
    };

    let C = null;
    const build = () => {
      C = compose();
      const pcm = renderAudio(C);
      wavData = pcm;
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const rootName = names[C.cfg.root % 12] + (C.cfg.minor ? ' minor' : ' major');
      $('#m-info').innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${C.cfg.bpm}</b><span>Tempo (BPM)</span></div>
          <div class="kpi"><b>${rootName}</b><span>Key</span></div>
          <div class="kpi"><b>${C.cfg.inst}</b><span>Lead instrument</span></div>
          <div class="kpi"><b>${C.notes.length}</b><span>Notes</span></div>
          <div class="kpi"><b>${C.dur.toFixed(1)} s</b><span>Duration</span></div>
          <div class="kpi"><b>${C.cfg.drums ? 'yes' : 'no'}</b><span>Drum pattern</span></div>
        </div>`;
      drawRoll(C);
      $('#m-wav', root).disabled = false;
      $('#m-code', root).textContent = `from transformers import AutoProcessor, MusicgenForConditionalGeneration
import scipy

processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")

inputs = processor(text=["${C.prompt.replace(/"/g, '\\"')}"], padding=True, return_tensors="pt")
audio = model.generate(**inputs, do_sample=True, guidance_scale=3,
                       max_new_tokens=int(${Math.round(C.dur)} * 50))   # ~50 tokens per second

rate = model.config.audio_encoder.sampling_rate
scipy.io.wavfile.write("generated_music.wav", rate=rate, data=audio[0, 0].cpu().numpy())`;
    };
    const play = () => {
      if (!wavData) return;
      stop();
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const b = audioCtx.createBuffer(1, wavData.length, SR);
      b.copyToChannel(wavData, 0);
      src = audioCtx.createBufferSource(); src.buffer = b; src.connect(audioCtx.destination); src.start();
    };
    const stop = () => { try { src && src.stop(); } catch (e) {} src = null; };

    $('#m-gen').addEventListener('click', build);
    $('#m-play').addEventListener('click', play);
    $('#m-stop').addEventListener('click', stop);
    $('#m-wav').addEventListener('click', () => { if (wavData) GL.download(encodeWav(wavData), 'generated_music.wav', 'audio/wav'); });
    build();
  }
};

// ---------- Experiment 10 ----------
GL.tools.video = {
  mount(root) {
    const STYLE = {
      cinematic: { bg: ['#0d2b2e', '#f39c4a'], accent: '#f6d7a7', motion: 'dust' },
      neon: { bg: ['#05010f', '#ff2e88'], accent: '#00f0ff', motion: 'lines' },
      pastel: { bg: ['#ffe8f0', '#b8e0ff'], accent: '#ff9ac1', motion: 'bubbles' },
      sketch: { bg: ['#fbf8f1', '#e9e2cf'], accent: '#333333', motion: 'strokes' }
    };
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Prompt (separate scenes with full stops)</label><textarea id="vid-p">A red fox runs through a snowy forest. The fox stops at a frozen lake. Snow falls as the sun rises.</textarea></div>
        <div class="field"><label>Visual style</label><select id="vid-style"><option value="cinematic">Cinematic</option><option value="neon">Neon</option><option value="pastel">Pastel</option><option value="sketch">Sketch</option></select></div>
        <div class="row">
          <div class="field"><label>Seconds per scene</label><input type="number" id="vid-sec" value="3" min="1" max="6"></div>
          <div class="field"><label>FPS</label><select id="vid-fps"><option value="24">24</option><option value="30">30</option></select></div>
        </div>
        <div class="actions"><button class="btn" id="vid-play">Build & play storyboard</button><button class="btn ghost" id="vid-export">Export WebM</button></div>
        <p class="note">Browser stand-in: each scene becomes an animated frame with a caption. Exports a real WebM file. Actual text-to-video needs the pretrained video model on a GPU (see the snippet on the right).</p>
      </section>
      <section class="glass panel">
        <h4>Outputs</h4>
        <div style="display:flex;justify-content:center"><canvas id="vid-cv" width="640" height="360" style="width:100%;max-width:560px"></canvas></div>
        <div style="height:6px;border-radius:4px;background:rgba(255,255,255,.1);margin:10px 0;overflow:hidden"><div id="vid-bar" style="height:100%;width:0;background:linear-gradient(90deg,#00e1c4,#7c5cff)"></div></div>
        <p class="msg" id="vid-status" style="text-align:center"></p>
        <div id="vid-scenes"></div>
        <h4 style="margin:12px 0 8px">Video model code for the notebook (GPU)</h4>
        <pre class="code" id="vid-code"></pre>
      </section>`;
    const $ = s => GL.$(s, root);
    const cv = $('#vid-cv'), ctx = cv.getContext('2d'), W = 640, H = 360;
    let scenes = [], anim = 0, t0 = 0, total = 0, recording = false;

    const splitScenes = p => {
      let s = p.split(/[.;!?]+\s*/).map(x => x.trim()).filter(Boolean);
      if (s.length < 2) s = [p, p + ' (close-up)', p + ' (wide shot)'];
      return s.slice(0, 6);
    };
    const drawScene = (scene, idx, localT, style, sceneSeconds, fade) => {
      const S = STYLE[style], r = GL.rng(GL.hash(scene) + style);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, S.bg[0]); g.addColorStop(1, S.bg[1]);
      ctx.globalAlpha = fade; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const motion = S.motion;
      const particles = 40;
      for (let i = 0; i < particles; i++) {
        const seedX = r(), seedY = r(), sp = 0.2 + r() * 0.8;
        const x = ((seedX * W + localT * 60 * sp) % W + W) % W;
        const y = ((seedY * H + localT * (motion === 'bubbles' ? -25 : 15) * sp) % H + H) % H;
        ctx.globalAlpha = fade * (0.25 + r() * 0.5);
        ctx.fillStyle = S.accent;
        if (motion === 'lines') { ctx.fillRect(x, y, 2, 30 * sp); }
        else if (motion === 'strokes') { ctx.fillStyle = '#333'; ctx.fillRect(x, y, 14 * sp, 1.2); }
        else { ctx.beginPath(); ctx.arc(x, y, 1.5 + sp * 3, 0, Math.PI * 2); ctx.fill(); }
      }
      // subject: a moving shape representing the scene
      const cx = W * (0.2 + 0.6 * ((localT / sceneSeconds) % 1)), cy = H * (0.55 + 0.04 * Math.sin(localT * 3));
      ctx.globalAlpha = fade * 0.9; ctx.fillStyle = S.accent;
      ctx.beginPath(); ctx.ellipse(cx, cy, 70 + 10 * Math.sin(localT * 4), 36, 0, 0, Math.PI * 2); ctx.fill();
      // caption typed out
      const chars = Math.floor(Math.min(1, localT / (sceneSeconds * 0.6)) * scene.length);
      ctx.globalAlpha = fade; ctx.fillStyle = style === 'sketch' ? '#222' : '#fff';
      ctx.font = '600 22px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(scene.slice(0, chars), W / 2, 44);
      ctx.globalAlpha = 1;
    };
    const render = (time) => {
      const sec = +$('#vid-sec').value, style = $('#vid-style').value;
      const idx = Math.min(scenes.length - 1, Math.floor(time / sec));
      const local = time - idx * sec;
      const fadeIn = Math.min(1, local / 0.4);
      ctx.clearRect(0, 0, W, H);
      drawScene(scenes[idx], idx, local, style, sec, fadeIn);
      $('#vid-bar', root).style.width = Math.min(100, time / total * 100) + '%';
      $('#vid-status', root).textContent = `Scene ${idx + 1} / ${scenes.length}  |  ${time.toFixed(1)} s of ${total.toFixed(1)} s`;
    };
    const loop = (now, onEnd) => {
      const time = (now - t0) / 1000;
      if (time >= total) { render(total - 0.001); if (onEnd) onEnd(); return; }
      render(time);
      anim = requestAnimationFrame(n => loop(n, onEnd));
    };
    const prepare = () => {
      scenes = splitScenes($('#vid-p').value);
      total = scenes.length * +$('#vid-sec').value;
      const sec = +$('#vid-sec').value, fps = $('#vid-fps').value;
      $('#vid-scenes', root).innerHTML = `<div class="kpis"><div class="kpi"><b>${scenes.length}</b><span>Scenes</span></div><div class="kpi"><b>${total} s</b><span>Length</span></div><div class="kpi"><b>${W}x${H}</b><span>Resolution</span></div><div class="kpi"><b>${fps} fps</b><span>Frame rate</span></div></div>
        <ol style="color:var(--muted);line-height:1.6">${scenes.map(s => `<li>${GL.esc(s)}</li>`).join('')}</ol>`;
      $('#vid-code', root).textContent = `import torch
from diffusers import DiffusionPipeline
from diffusers.utils import export_to_video

pipe = DiffusionPipeline.from_pretrained("<pretrained-text-to-video-model>", torch_dtype=torch.float16)
pipe.to("cuda")

prompt = "${$('#vid-p').value.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
frames = pipe(prompt, num_inference_steps=25, num_frames=${Math.round(sec * 8)}).frames[0]
export_to_video(frames, "generated_video.mp4", fps=${fps})`;
    };
    const playStoryboard = () => {
      cancelAnimationFrame(anim); prepare();
      t0 = performance.now();
      loop(t0, null);
    };
    const exportWebM = () => {
      if (recording) return;
      if (!window.MediaRecorder) { GL.toast('MediaRecorder not supported in this browser'); return; }
      cancelAnimationFrame(anim); prepare();
      const fps = +$('#vid-fps').value;
      const stream = cv.captureStream(fps);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = () => { recording = false; GL.download(new Blob(chunks, { type: 'video/webm' }), 'generated_storyboard.webm'); GL.toast('WebM exported'); };
      recording = true;
      rec.start();
      t0 = performance.now();
      loop(t0, () => { setTimeout(() => rec.stop(), 150); });
    };
    $('#vid-play').addEventListener('click', playStoryboard);
    $('#vid-export').addEventListener('click', exportWebM);
    $('#vid-sec').addEventListener('change', prepare);
    $('#vid-fps').addEventListener('change', prepare);
    $('#vid-style').addEventListener('change', playStoryboard);
    prepare();
    render(0);
  }
};
