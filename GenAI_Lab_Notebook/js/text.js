// Shared TF-IDF retriever + Experiments 3 (Q&A) and 9 (RAG).
GL.text = {};
GL.text.STOP = new Set('a an and are as at be by for from has have how in is it its of on or that the this to was were what when where which who why will with you your i we they them their there can do does did not into than then also about'.split(' '));
GL.text.stem = w => w.replace(/(ing|ed|es|s)$/, '').replace(/(.)\1$/, '$1');
GL.text.tokens = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !GL.text.STOP.has(w)).map(GL.text.stem).filter(w => w.length > 1);

// Build an index over chunks: returns {chunks, idf, vecs}
GL.text.index = function (chunks) {
  const N = chunks.length, df = new Map();
  const toks = chunks.map(c => GL.text.tokens(c));
  toks.forEach(t => new Set(t).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const idf = new Map();
  df.forEach((v, k) => idf.set(k, Math.log((1 + N) / (1 + v)) + 1));
  const vecs = toks.map(t => {
    const tf = new Map(); t.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
    const v = new Map(); let norm = 0;
    tf.forEach((c, w) => { const x = (c / t.length) * idf.get(w); v.set(w, x); norm += x * x; });
    norm = Math.sqrt(norm) || 1;
    v.forEach((x, w) => v.set(w, x / norm));
    return v;
  });
  return { chunks, idf, vecs };
};

// Score every chunk for a query; returns sorted [{i, score, matched}]
GL.text.search = function (index, query) {
  const qt = GL.text.tokens(query);
  const qv = new Map(); let norm = 0;
  qt.forEach(w => { const x = index.idf.get(w) || 0; if (x) { qv.set(w, (qv.get(w) || 0) + x); } });
  qv.forEach(x => norm += x * x); norm = Math.sqrt(norm) || 1;
  return index.vecs.map((v, i) => {
    let s = 0; const matched = [];
    qv.forEach((x, w) => { if (v.has(w)) { s += (x / norm) * v.get(w); matched.push(w); } });
    return { i, score: s, matched };
  }).sort((a, b) => b.score - a.score);
};

GL.text.highlight = function (text, words) {
  const set = new Set(words);
  return GL.esc(text).split(/(\b)/).map(part => {
    const st = GL.text.stem(part.toLowerCase());
    return set.has(st) && /[a-z0-9]/i.test(part) ? `<span class="hl">${part}</span>` : part;
  }).join('');
};

GL.text.splitSentences = s => s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 2);
GL.text.splitWords = (s, size, overlap) => {
  const w = s.split(/\s+/).filter(Boolean), out = [], step = Math.max(1, size - overlap);
  for (let i = 0; i < w.length; i += step) { out.push(w.slice(i, i + size).join(' ')); if (i + size >= w.length) break; }
  return out;
};

GL.tools.qa = {
  mount(root) {
    const CTX = 'The Transformer architecture was introduced in 2017 and relies on self-attention instead of recurrence. ' +
      'Pre-trained language models such as FLAN-T5 are trained on many instruction tasks, so they can answer questions without task-specific training. ' +
      'Text generation means producing new text from an input instruction, such as an answer, a summary or a story. ' +
      'Training a large model from scratch needs very large datasets and substantial compute, so practitioners usually load a pre-trained model. ' +
      'Gradio provides a simple web interface where users type a question and see the model response immediately.';
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Passage (context)</label><textarea id="qa-ctx">${GL.esc(CTX)}</textarea></div>
        <div class="field"><label>Question</label><input type="text" id="qa-q" value="How do pre-trained models like FLAN-T5 answer questions?"></div>
        <div class="field"><label>Sample questions</label>
          <div class="row" style="flex-wrap:wrap">
            <button class="chip" data-q="What is the Transformer architecture based on?">Transformer?</button>
            <button class="chip" data-q="Why do practitioners load a pre-trained model?">Why pre-trained?</button>
            <button class="chip" data-q="What does Gradio provide?">Gradio?</button>
          </div></div>
        <div class="field"><label>Answer length <output id="qa-k-out">2</output></label><input type="range" id="qa-k" min="1" max="4" value="2"></div>
        <div class="actions"><button class="btn" id="qa-run">Get answer</button></div>
        <p class="note">Stand-in: this tool ranks passage sentences by relevance (TF-IDF). The lab notebook generates the answer with FLAN-T5 (google/flan-t5-base); the prompt it sends is shown on the right.</p>
      </section>
      <section class="glass panel">
        <h4>Outputs</h4>
        <div id="qa-out"><p class="note">Ask a question to see the answer, confidence and the prompt sent to the model.</p></div>
      </section>`;
    const run = () => {
      const ctx = GL.$('#qa-ctx', root).value, q = GL.$('#qa-q', root).value, k = +GL.$('#qa-k', root).value;
      const sents = GL.text.splitSentences(ctx);
      if (!sents.length || !q.trim()) { GL.$('#qa-out', root).innerHTML = '<p class="msg">Please provide a passage and a question.</p>'; return; }
      const idx = GL.text.index(sents);
      const res = GL.text.search(idx, q);
      const top = res.slice(0, k).filter(r => r.score > 0);
      const best = top[0];
      const conf = best ? Math.min(0.99, best.score) : 0;
      const prompt = `Read the context and answer the question.\n\nContext: ${ctx}\n\nQuestion: ${q}\nAnswer:`;
      GL.$('#qa-out', root).innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${sents.length}</b><span>Passage sentences</span></div>
          <div class="kpi"><b>${(conf * 100).toFixed(0)}%</b><span>Evidence confidence</span></div>
          <div class="kpi"><b>${top.length}</b><span>Supporting sentences</span></div>
        </div>
        <div class="glass" style="padding:14px;margin-bottom:14px">
          <div class="note" style="margin:0 0 6px">Answer</div>
          <div style="font-size:1.05rem;line-height:1.5">${best ? GL.text.highlight(top.map(t => sents[t.i]).join(' '), best.matched) : 'No relevant sentence found in the passage.'}</div>
        </div>
        <div class="scroll"><table class="data"><thead><tr><th>Rank</th><th>Score</th><th style="text-align:left">Evidence sentence</th></tr></thead><tbody>
          ${top.map((t, r) => `<tr><td>${r + 1}</td><td>${t.score.toFixed(3)}</td><td style="text-align:left;white-space:normal">${GL.esc(sents[t.i])}</td></tr>`).join('') || '<tr><td colspan="3">No overlap with passage.</td></tr>'}
        </tbody></table></div>
        <div class="field"><label>Prompt sent to FLAN-T5 (notebook)</label><pre class="code">${GL.esc(prompt)}</pre></div>
        <div class="actions"><button class="btn ghost small" id="qa-dl">Download answer (.txt)</button></div>`;
      GL.$('#qa-dl', root).addEventListener('click', () => GL.download(`Q: ${q}\n\nA: ${top.map(t => sents[t.i]).join(' ')}\n`, 'qa_answer.txt'));
    };
    GL.$('#qa-run', root).addEventListener('click', run);
    GL.$('#qa-k', root).addEventListener('input', e => GL.$('#qa-k-out', root).textContent = e.target.value);
    GL.$$('[data-q]', root).forEach(b => b.addEventListener('click', () => { GL.$('#qa-q', root).value = b.dataset.q; run(); }));
    run();
  }
};

GL.tools.rag = {
  mount(root) {
    const DOC = `Acme Learning Handbook

Leave policy: Full-time employees receive 18 days of paid leave per year. Unused leave can be carried forward up to 5 days into the next year.

Work from home: Employees may work from home up to two days per week with manager approval. Equipment for home work is provided once per year.

Expense claims: Travel and meal expenses must be submitted within 30 days using the finance portal. Receipts above 500 rupees are mandatory.

Learning budget: Each employee has an annual learning budget of 20000 rupees for courses, books and certifications. Courses must be relevant to the current role.

Project onboarding: New joiners complete a 2-week onboarding plan that covers the codebase, security training and a mentor pairing session.`;
    root.innerHTML = `
      <section class="glass panel">
        <h4>Inputs</h4>
        <div class="field"><label>Your documents (.txt / .md or paste)</label><input type="file" id="rag-file" accept=".txt,.md,.csv"><textarea id="rag-doc">${GL.esc(DOC)}</textarea></div>
        <div class="field"><label>Chunk size (words) <output id="rag-cs-o">60</output></label><input type="range" id="rag-cs" min="20" max="200" value="60"></div>
        <div class="field"><label>Chunk overlap (words) <output id="rag-ov-o">10</output></label><input type="range" id="rag-ov" min="0" max="50" value="10"></div>
        <div class="field"><label>Top-k chunks to retrieve <output id="rag-k-o">3</output></label><input type="range" id="rag-k" min="1" max="6" value="3"></div>
        <div class="field"><label>Question</label><input type="text" id="rag-q" value="How many days of leave do employees get?"></div>
        <div class="actions"><button class="btn" id="rag-run">Retrieve & build prompt</button></div>
        <p class="note">Stand-in for the embedding model + vector DB: chunks are indexed with TF-IDF instead of dense embeddings. The LoRA fine-tuning step is a training job and lives in the notebook.</p>
      </section>
      <section class="glass panel">
        <h4>Outputs</h4>
        <div id="rag-out"></div>
      </section>`;
    const bind = (id, oid) => GL.$(id, root).addEventListener('input', e => GL.$(oid, root).textContent = e.target.value);
    bind('#rag-cs', '#rag-cs-o'); bind('#rag-ov', '#rag-ov-o'); bind('#rag-k', '#rag-k-o');
    GL.$('#rag-file', root).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      GL.$('#rag-doc', root).value = await f.text(); run();
    });
    const run = () => {
      const doc = GL.$('#rag-doc', root).value, q = GL.$('#rag-q', root).value;
      const size = +GL.$('#rag-cs', root).value, ov = Math.min(+GL.$('#rag-ov', root).value, size - 1), k = +GL.$('#rag-k', root).value;
      const chunks = GL.text.splitWords(doc, size, ov);
      if (!chunks.length || !q.trim()) { GL.$('#rag-out', root).innerHTML = '<p class="msg">Add documents and a question.</p>'; return; }
      const idx = GL.text.index(chunks);
      const res = GL.text.search(idx, q);
      const top = res.slice(0, k).filter(r => r.score > 0);
      const context = top.map((t, n) => `[${n + 1}] ${chunks[t.i]}`).join('\n');
      const prompt = `You are a personal assistant. Answer using only the context. If the answer is not in the context, say you do not know.\n\nContext:\n${context || '(none)'}\n\nQuestion: ${q}\nAnswer:`;
      const tokEst = Math.round(prompt.split(/\s+/).length * 1.3);
      GL.$('#rag-out', root).innerHTML = `
        <div class="kpis">
          <div class="kpi"><b>${chunks.length}</b><span>Chunks indexed</span></div>
          <div class="kpi"><b>${idx.idf.size}</b><span>Vocabulary terms</span></div>
          <div class="kpi"><b>${top.length}</b><span>Chunks retrieved</span></div>
          <div class="kpi"><b>~${tokEst}</b><span>Prompt tokens (est.)</span></div>
        </div>
        <div class="scroll"><table class="data"><thead><tr><th>#</th><th>Score</th><th>Chunk</th></tr></thead><tbody>
          ${top.map((t, n) => `<tr><td>${n + 1}</td><td>${t.score.toFixed(3)}</td><td style="text-align:left;white-space:normal;min-width:260px">${GL.text.highlight(chunks[t.i], t.matched)}</td></tr>`).join('') || '<tr><td colspan="3">No chunk matches the question.</td></tr>'}
        </tbody></table></div>
        <div class="field"><label>RAG prompt sent to the LLM</label><pre class="code">${GL.esc(prompt)}</pre></div>
        <div class="actions"><button class="btn ghost small" id="rag-dl">Download prompt (.txt)</button><button class="btn ghost small" id="rag-cp">Copy prompt</button></div>
        <p class="note">Without retrieval the base LLM has never seen your handbook and would guess. The retrieved context is what makes the answer grounded.</p>`;
      GL.$('#rag-dl', root).addEventListener('click', () => GL.download(prompt, 'rag_prompt.txt'));
      GL.$('#rag-cp', root).addEventListener('click', () => GL.copy(prompt));
    };
    GL.$('#rag-run', root).addEventListener('click', run);
    run();
  }
};
