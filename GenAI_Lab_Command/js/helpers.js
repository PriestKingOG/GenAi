// Core: helpers, experiment catalogue, router. Tools register themselves in GL.tools.
window.GL = window.GL || {};
GL.tools = {};

GL.$ = (sel, root = document) => root.querySelector(sel);
GL.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
GL.esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
GL.fmt = (n, d = 4) => (typeof n === 'number' && isFinite(n)) ? (Math.abs(n) >= 1e6 ? n.toExponential(3) : +n.toFixed(d)) : String(n);

// Deterministic RNG from a string seed (xmur3 hash + mulberry32)
GL.rng = function (seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
GL.gauss = function (rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

GL.download = function (data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
};

GL.toast = function (msg) {
  const t = GL.$('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(GL._tt); GL._tt = setTimeout(() => t.classList.add('hidden'), 2200);
};

GL.copy = function (text) {
  try { navigator.clipboard.writeText(text); GL.toast('Copied to clipboard'); }
  catch (e) { GL.toast('Copy failed - select the text manually'); }
};

// Experiment catalogue. `runtime`: 'browser' = fully runnable here; 'gpu' = the lab needs a GPU model; this app gives an in-browser stand-in + generated code.
GL.EXPERIMENTS = [
  { id: 1, title: 'Understanding Any Dataset Like a Data Scientist', short: 'Load a CSV, inspect types, missing values, statistics, distributions and correlations, then export a cleaned dataset.',
    category: 'Data Foundations', level: 'Beginner', runtime: 'browser', tool: 'eda',
    notebooks: ['Copy_of_Understanding_Any_Dataset_Like_a_Data_Scientist.ipynb'], pdf: 'Experiment No1.pdf',
    aim: 'Understand, explore, preprocess and analyse any dataset with pandas, NumPy, Matplotlib/Seaborn and scikit-learn, producing AI-ready data.',
    objectives: ['Inspect dimensions, dtypes, summary statistics and missing values', 'Preprocess data (imputation, duplicates)', 'Visualise distributions and relationships', 'Prepare clean, structured datasets for ML / GenAI'] },
  { id: 2, title: 'TensorFlow 2 Tensors & Python Operations', short: 'Build tensors, inspect shape, rank and dtype, and run arithmetic, reshape, reductions and activations.',
    category: 'Data Foundations', level: 'Beginner', runtime: 'browser', tool: 'tensor', notebooks: [], pdf: 'Experiment No2.pdf',
    aim: 'Learn the tensor concept and TensorFlow 2 operations that every generative model is built on.',
    objectives: ['Create scalar, vector, matrix and higher-rank tensors', 'Perform arithmetic, reshaping and math functions', 'Understand shape, rank and dtype', 'Convert between tensors and NumPy arrays'] },
  { id: 3, title: 'Question-Answer System with a Pre-trained Transformer (FLAN-T5)', short: 'Ask questions over a passage. Shows the exact prompt the model receives and ranks the answer evidence.',
    category: 'Language', level: 'Beginner', runtime: 'gpu', tool: 'qa', notebooks: ['Text_Generation_AI_Question_Answer_System_FLAN_T5.ipynb'], pdf: 'Experiment No3.pdf',
    aim: 'Build a text-generation Q&A system with a pre-trained Transformer and an interactive Gradio interface.',
    objectives: ['Understand text generation and Transformers', 'Use a pre-trained FLAN-T5 model for Q&A', 'Build an interactive Q&A interface', 'Analyse the generated responses'] },
  { id: 4, title: 'Text-to-Image Generation with a Diffusion Model (SDXL)', short: 'Tune prompt, steps, guidance and seed, watch denoising happen, and export a ready-to-run SDXL script.',
    category: 'Generative Images', level: 'Intermediate', runtime: 'gpu', tool: 'image', notebooks: ['Exe_4_ImageGeneration.ipynb'], pdf: 'Experiment No4.pdf',
    aim: 'Generate images from text prompts with Stable Diffusion XL and analyse the effect of prompts and generation parameters.',
    objectives: ['Understand text-to-image generation', 'Understand the denoising principle of diffusion models', 'Use Diffusers with SDXL', 'Analyse prompt and parameter effects (steps, guidance scale)'] },
  { id: 5, title: 'Variational Autoencoder (VAE) on MNIST', short: 'Explore the reparameterisation trick, KL divergence and reconstruction loss in a 2-D latent space.',
    category: 'Generative Models', level: 'Intermediate', runtime: 'browser', tool: 'vae', notebooks: ['VAE_MNIST_Generation.ipynb'], pdf: 'Experiment No5.pdf',
    aim: 'Implement a VAE with a 2-D latent space and generate new MNIST-like digits from random latent vectors.',
    objectives: ['Understand the encoder, sampling and decoder', 'Apply the reparameterisation trick z = mu + sigma * eps', 'Compute reconstruction loss and KL divergence', 'Visualise the 2-D latent space and sampled points'] },
  { id: 6, title: 'Face Generation with DCGAN on CelebA', short: 'Design the DCGAN generator and discriminator, check every layer shape and parameter count, and compute GAN losses.',
    category: 'Generative Models', level: 'Intermediate', runtime: 'browser', tool: 'dcgan', notebooks: ['GAN_Face_Generation_CelebA.ipynb'], pdf: 'Experiment_No6_GAN_CelebA.pdf',
    aim: 'Implement a DCGAN in PyTorch, train it on CelebA and generate new face images (optional Flask deployment).',
    objectives: ['Understand the Generator / Discriminator min-max game', 'Build DCGAN layers with (transposed) convolutions', 'Train with BCE loss and Adam', 'Track losses and generated image grids'] },
  { id: 7, title: 'StyleGAN: Style Mixing & Noise Control', short: 'Map latents to W space, mix two identities layer by layer, and inspect the stochastic noise controls.',
    category: 'Generative Models', level: 'Advanced', runtime: 'browser', tool: 'stylegan', notebooks: ['StyleGAN_Face_Generation2.ipynb'], pdf: 'Experiment No7.pdf',
    aim: 'Implement StyleGAN for high-quality faces with a mapping network, coarse-to-fine style control, style mixing and noise injection.',
    objectives: ['Map z to intermediate W space via a mapping network', 'Inject styles at different resolutions', 'Demonstrate style mixing between two identities', 'Demonstrate noise injection for fine detail'] },
  { id: 8, title: 'Music Generation with a Pre-trained MusicGen Model', short: 'Describe the music you want, pick its length and randomness, listen to a synthesised preview, export WAV and the MusicGen code.',
    category: 'Audio', level: 'Intermediate', runtime: 'gpu', tool: 'music', notebooks: ['Simple_MusicGen_Generation.ipynb', 'MusicGen_Finetuning_Novel_Compositions.ipynb'], pdf: 'Experiment No8.pdf',
    aim: 'Generate novel music from text prompts with the pre-trained open-source MusicGen foundation model, and save/play the audio.',
    objectives: ['Understand music foundation models', 'Generate music from text prompts', 'Experiment with prompts and styles', 'Play and save audio (WAV)'] },
  { id: 9, title: 'Personal AI Assistant with RAG & LoRA Fine-tuning', short: 'Chunk your documents, retrieve the most relevant passages for a question, and see the exact RAG prompt built.',
    category: 'Assistants', level: 'Advanced', runtime: 'browser', tool: 'rag', notebooks: [], pdf: 'Experiment No9.pdf',
    aim: 'Build a personalised assistant: an open-source LLM plus Retrieval-Augmented Generation over your documents, with optional LoRA/QLoRA fine-tuning.',
    objectives: ['Understand LLMs and their limits on private data', 'Chunk documents and build embeddings / a vector index', 'Implement a RAG pipeline', 'Compare base, RAG and fine-tuned responses'] },
  { id: 10, title: 'Text-to-Video Generation', short: 'Turn a prompt into scenes, preview a storyboard animation, and export it as a WebM video.',
    category: 'Video', level: 'Intermediate', runtime: 'gpu', tool: 'video', notebooks: [], pdf: 'Experiment No10.pdf',
    aim: 'Generate short videos directly from text prompts with a pre-trained open-source video foundation model, then preview and save them.',
    objectives: ['Understand video generation with foundation models', 'Generate short videos from prompts', 'Experiment with prompts, scenes and visual styles', 'Preview and save the videos'] }
];

GL.NOTEBOOKS = [
  'Copy_of_Understanding_Any_Dataset_Like_a_Data_Scientist.ipynb', 'Text_Generation_AI_Question_Answer_System_FLAN_T5.ipynb',
  'Exe_4_ImageGeneration.ipynb', 'VAE_MNIST_Generation.ipynb', 'GAN_Face_Generation_CelebA.ipynb', 'StyleGAN_Face_Generation2.ipynb',
  'Simple_MusicGen_Generation.ipynb', 'MusicGen_Finetuning_Novel_Compositions.ipynb'
];

