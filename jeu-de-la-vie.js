const CELL = 12;
const instances = {};

function createInstance(id, canvasId, cols, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  // ensure canvas uses device pixels properly
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;

  const grid = Array.from({length: rows}, () => new Uint8Array(cols));
  const next = Array.from({length: rows}, () => new Uint8Array(cols));

  instances[id] = {
    canvas, ctx: canvas.getContext('2d'),
    grid, next, cols, rows,
    running: false, gen: 0, speed: id === 'complex' ? 15 : (id === 'demo' ? 6 : 8),
    raf: null, lastTime: 0, drawing: false
  };

  setupEvents(id);
  setupDropEvents(id);
  render(id);
  return instances[id];
}

function setupEvents(id) {
  const inst = instances[id];
  const c = inst.canvas;
  let painting = false;
  let paintVal = 1;

  function getCell(e) {
    const rect = c.getBoundingClientRect();
    const scaleX = inst.cols / rect.width;
    const scaleY = inst.rows / rect.height;
    const touch = e.touches ? e.touches[0] : e;
    const col = Math.floor((touch.clientX - rect.left) * scaleX);
    const row = Math.floor((touch.clientY - rect.top) * scaleY);
    return [col, row];
  }

  c.addEventListener('mousedown', e => {
    painting = true;
    const [col, row] = getCell(e);
    if (col >= 0 && col < inst.cols && row >= 0 && row < inst.rows) {
      paintVal = inst.grid[row][col] ? 0 : 1;
      inst.grid[row][col] = paintVal;
      updateStats(id);
      render(id);
    }
  });
  c.addEventListener('mousemove', e => {
    if (!painting) return;
    const [col, row] = getCell(e);
    if (col >= 0 && col < inst.cols && row >= 0 && row < inst.rows) {
      inst.grid[row][col] = paintVal;
      updateStats(id);
      render(id);
    }
  });
  window.addEventListener('mouseup', () => { painting = false; });

  c.addEventListener('touchstart', e => {
    e.preventDefault(); painting = true;
    const [col, row] = getCell(e);
    if (col >= 0 && col < inst.cols && row >= 0 && row < inst.rows) {
      paintVal = inst.grid[row][col] ? 0 : 1;
      inst.grid[row][col] = paintVal;
      updateStats(id); render(id);
    }
  }, {passive: false});
  c.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!painting) return;
    const [col, row] = getCell(e);
    if (col >= 0 && col < inst.cols && row >= 0 && row < inst.rows) {
      inst.grid[row][col] = paintVal;
      updateStats(id); render(id);
    }
  }, {passive: false});
  window.addEventListener('touchend', () => { painting = false; });
}

function setupDropEvents(id) {
  const inst = instances[id];
  const c = inst.canvas;

  c.addEventListener('dragover', event => {
    event.preventDefault();
  });

  c.addEventListener('drop', event => {
    event.preventDefault();
    const payload = event.dataTransfer?.getData('application/json');
    if (!payload) return;

    try {
      const data = JSON.parse(payload);
      const [col, row] = getCellFromClientPoint(inst, event.clientX, event.clientY);
      insertPattern(id, data.pattern, row, col);
      const status = document.getElementById('patternStatus');
      if (status) status.textContent = `Motif ajouté sur la grille.`;
    } catch {
      return;
    }
  });
}

function getCellFromClientPoint(inst, clientX, clientY) {
  const rect = inst.canvas.getBoundingClientRect();
  const scaleX = inst.cols / rect.width;
  const scaleY = inst.rows / rect.height;
  const col = Math.floor((clientX - rect.left) * scaleX);
  const row = Math.floor((clientY - rect.top) * scaleY);
  return [col, row];
}

function countNeighbors(grid, row, col, rows, cols) {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = (row + dr + rows) % rows;
      const c = (col + dc + cols) % cols;
      n += grid[r][c];
    }
  }
  return n;
}

function step(id) {
  const inst = instances[id];
  const {grid, next, rows, cols} = inst;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = countNeighbors(grid, r, c, rows, cols);
      const alive = grid[r][c];
      next[r][c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) grid[r][c] = next[r][c];
  }
  inst.gen++;
  updateStats(id);
}

function render(id) {
  const inst = instances[id];
  const {ctx, grid, rows, cols} = inst;
  const W = inst.canvas.width, H = inst.canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
  }

  // Cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) {
        ctx.fillStyle = '#7c6fff';
        ctx.shadowColor = '#7c6fff';
        ctx.shadowBlur = 4;
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        ctx.shadowBlur = 0;
      }
    }
  }
}

function updateStats(id) {
  const inst = instances[id];
  if (!inst) return;
  let pop = 0;
  for (let r = 0; r < inst.rows; r++)
    for (let c = 0; c < inst.cols; c++) pop += inst.grid[r][c];

  const genEl = document.getElementById(id + 'Gen');
  const popEl = document.getElementById(id + 'Pop');
  if (genEl) genEl.textContent = inst.gen;
  if (popEl) popEl.textContent = pop;
}

function loop(id, timestamp) {
  const inst = instances[id];
  if (!inst.running) return;
  const interval = 1000 / inst.speed;
  if (timestamp - inst.lastTime >= interval) {
    step(id);
    render(id);
    inst.lastTime = timestamp;
  }
  inst.raf = requestAnimationFrame(t => loop(id, t));
}

function togglePlay(id) {
  const inst = instances[id];
  inst.running = !inst.running;
  const btnId = id === 'main' ? 'playBtn' : (id === 'demo' ? 'playBtn2' : 'playBtn3');
  const btn = document.getElementById(btnId);
  if (inst.running) {
    if (btn) { btn.textContent = '⏸ Pause'; btn.classList.add('active'); }
    inst.raf = requestAnimationFrame(t => loop(id, t));
  } else {
    if (btn) { btn.textContent = '▶ Lancer'; btn.classList.remove('active'); }
    if (inst.raf) cancelAnimationFrame(inst.raf);
  }
}

function stepOnce(id) {
  step(id);
  render(id);
}

function clearGrid(id) {
  const inst = instances[id];
  if (inst.running) togglePlay(id);
  for (let r = 0; r < inst.rows; r++) inst.grid[r].fill(0);
  inst.gen = 0;
  updateStats(id);
  render(id);
}

function randomize(id) {
  const inst = instances[id];
  for (let r = 0; r < inst.rows; r++)
    for (let c = 0; c < inst.cols; c++)
      inst.grid[r][c] = Math.random() < 0.28 ? 1 : 0;
  inst.gen = 0;
  updateStats(id);
  render(id);
}

function setSpeed(id, val) {
  instances[id].speed = +val;
  const el = document.getElementById('speed' + id.charAt(0).toUpperCase() + id.slice(1) + 'Val');
  if (el) el.textContent = val + ' gen/s';
}

function placePattern(id, pattern, centerRow, centerCol) {
  const inst = instances[id];
  const offsetR = centerRow - Math.floor(pattern.length / 2);
  const offsetC = centerCol - Math.floor(pattern[0].length / 2);
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      const tr = offsetR + r, tc = offsetC + c;
      if (tr >= 0 && tr < inst.rows && tc >= 0 && tc < inst.cols)
        inst.grid[tr][tc] = pattern[r][c];
    }
  }
  render(id);
  updateStats(id);
}

function insertPattern(id, pattern, centerRow, centerCol) {
  placePattern(id, pattern, centerRow, centerCol);
}

// PATTERNS (same data as before)
const PATTERNS_BASIC = [
  {
    name: 'Block', type: 'stable', desc: 'Forme stable, ne bouge pas',
    pattern: [[1,1],[1,1]],
    preview: [[1,1],[1,1]]
  },
  {
    name: 'Beehive', type: 'stable', desc: 'Ruche, stable à 6 cellules',
    pattern: [[0,1,1,0],[1,0,0,1],[0,1,1,0]],
    preview: [[0,1,1,0],[1,0,0,1],[0,1,1,0]]
  },
  {
    name: 'Blinker', type: 'oscillator', desc: 'Oscille entre 2 états',
    pattern: [[1,1,1]],
    preview: [[1,1,1],[0,0,0],[0,0,0]]
  },
  {
    name: 'Toad', type: 'oscillator', desc: 'Crapaud, période 2',
    pattern: [[0,1,1,1],[1,1,1,0]],
    preview: [[0,1,1,1],[1,1,1,0],[0,0,0,0]]
  },
  {
    name: 'Glider', type: 'spaceship', desc: 'Se déplace en diagonale',
    pattern: [[0,1,0],[0,0,1],[1,1,1]],
    preview: [[0,1,0],[0,0,1],[1,1,1]]
  },
  {
    name: 'LWSS', type: 'spaceship', desc: 'Vaisseau spatial léger',
    pattern: [[1,0,0,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1]],
    preview: [[1,0,0,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1]]
  }
];

const PATTERNS_COMPLEX = [
  {
    name: 'Gosper Glider Gun', type: 'gun', desc: 'Produit des planeurs à l\'infini',
    pattern: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    preview: [[1,1,0,0,0],[1,1,0,1,0],[0,0,1,1,0],[0,1,0,0,1],[0,0,1,0,0]]
  },
  {
    name: 'Pulsar', type: 'oscillator', desc: 'Oscille sur période 3',
    pattern: [
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0]
    ],
    preview: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0],[0,1,1,1,0]]
  },
  {
    name: 'R-pentomino', type: 'methuselah', desc: 'Évolue pendant 1103 générations',
    pattern: [[0,1,1],[1,1,0],[0,1,0]],
    preview: [[0,1,1],[1,1,0],[0,1,0],[0,0,0],[0,0,0]]
  },
  {
    name: 'Diehard', type: 'methuselah', desc: 'Disparaît après 130 générations',
    pattern: [[0,0,0,0,0,0,1,0],[1,1,0,0,0,0,0,0],[0,1,0,0,0,1,1,1]],
    preview: [[0,0,0,0,1,0],[1,1,0,0,0,0],[0,1,0,1,1,1]]
  }
];

function renderPreview(pattern) {
  const rows = pattern.length;
  const cols = pattern[0].length;
  let html = `<div class="pattern-preview" style="grid-template-columns:repeat(${cols},8px);grid-template-rows:repeat(${rows},8px)">`;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      html += `<div class="pc ${pattern[r][c] ? 'on' : 'off'}"></div>`;
  return html + '</div>';
}

const typeLabel = {stable:'Stable',oscillator:'Oscillateur',spaceship:'Vaisseau',gun:'Canon',methuselah:'Méthusélah'};
const typeColor = {stable:'var(--green)',oscillator:'var(--accent)',spaceship:'var(--accent2)',gun:'var(--amber)',methuselah:'#ff9966'};
// One-line tooltip explanations for each type (shown on hover over the colored label)
const typeTooltip = {
  stable: 'Structure immobile — ne change pas au fil des générations.',
  oscillator: 'Structure qui oscille entre plusieurs états périodiquement.',
  spaceship: 'Se déplace à travers la grille (ex: planeur, vaisseau).',
  gun: 'Produit périodiquement des planeurs ou objets mobiles.',
  methuselah: 'Évolue pendant de nombreuses générations avant de se stabiliser.'
};

function buildPatternGrid(containerId, patterns, instanceId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = patterns.map((p, i) => `
    <button type="button" class="pattern-card" id="pc_${containerId}_${i}" draggable="true">
      ${renderPreview(p.preview)}
      <div class="pattern-name">${p.name}</div>
      <div class="pattern-desc" style="color:${typeColor[p.type]};font-weight:500;font-size:0.7rem" title="${typeTooltip[p.type] || ''}">${typeLabel[p.type]}</div>
      <div class="pattern-desc">${p.desc}</div>
    </button>
  `).join('');

  patterns.forEach((pattern, index) => {
    const card = document.getElementById(`pc_${containerId}_${index}`);
    if (!card) return;
    card.addEventListener('click', () => loadPattern(instanceId, pattern.pattern, containerId, index));
    card.addEventListener('dragstart', event => {
      card.classList.add('dragging');
      event.dataTransfer?.setData('application/json', JSON.stringify({ pattern: pattern.pattern, name: pattern.name }));
      event.dataTransfer?.setData('text/plain', pattern.name);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function loadPattern(instanceId, pattern, gridId, idx) {
  const inst = instances[instanceId];
  if (!inst) return;

  // Insert without clearing the existing grid
  const cr = Math.floor(inst.rows / 2);
  const cc = Math.floor(inst.cols / 2);
  insertPattern(instanceId, pattern, cr, cc);

  const status = document.getElementById('patternStatus');
  if (status) {
    status.textContent = `Motif ajouté : ${gridId === 'patternGrid' ? 'forme classique' : 'forme avancée'}`;
  }

  // Visual feedback
  document.querySelectorAll(`#${gridId} .pattern-card`).forEach(el => el.classList.remove('selected'));
  const sel = document.getElementById(`pc_${gridId}_${idx}`);
  if (sel) sel.classList.add('selected');
}

function initHeroBg() {
  const canvas = document.getElementById('heroBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const CELL_S = 16;
  let cols = Math.floor(canvas.width / CELL_S) + 2;
  let rows = Math.floor(canvas.height / CELL_S) + 2;
  let grid = Array.from({length: rows}, () => new Uint8Array(cols));
  let ng = Array.from({length: rows}, () => new Uint8Array(cols));

  // Seed
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      grid[r][c] = Math.random() < 0.3 ? 1 : 0;

  function stepBg() {
    cols = Math.floor(canvas.width / CELL_S) + 2;
    rows = Math.floor(canvas.height / CELL_S) + 2;
    for (let r = 0; r < rows; r++) {
      if (!ng[r]) ng[r] = new Uint8Array(cols);
      for (let c = 0; c < cols; c++) {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = (r + dr + rows) % rows;
            const cc2 = (c + dc + cols) % cols;
            if (grid[rr] && grid[rr][cc2]) n++;
          }
        const alive = grid[r] && grid[r][c];
        ng[r][c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
    }
    for (let r = 0; r < rows; r++) {
      if (!grid[r]) grid[r] = new Uint8Array(cols);
      for (let c = 0; c < cols; c++) grid[r][c] = ng[r][c];
    }
  }

  function renderBg() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r] && grid[r][c]) {
          ctx.fillStyle = '#7c6fff';
          ctx.fillRect(c * CELL_S, r * CELL_S, CELL_S - 1, CELL_S - 1);
        }
      }
    }
  }

  let lastT = 0;
  function bgLoop(t) {
    if (t - lastT > 120) { stepBg(); renderBg(); lastT = t; }
    requestAnimationFrame(bgLoop);
  }
  requestAnimationFrame(bgLoop);
}

function initScroll() {
  const bar = document.getElementById('progressBar');
  const sections = document.querySelectorAll('section[id], #finale');
  const navLinks = document.querySelectorAll('nav a');

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    bar.style.width = (scrolled / maxScroll * 100) + '%';

    // Active nav
    let current = '';
    sections.forEach(s => {
      if (scrolled >= s.offsetTop - 120) current = s.id;
    });
    navLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  });

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, {threshold: 0.1, rootMargin: '0px 0px -60px 0px'});
  reveals.forEach(el => obs.observe(el));
}

function setupTextToSpeech(buttonId, textId) {
  const button = document.getElementById(buttonId);
  const textBlock = document.getElementById(textId);
  if (!button || !textBlock || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  let currentUtterance = null;

  const stopReading = () => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    currentUtterance = null;
    button.classList.remove('is-playing');
    button.textContent = '🔊';
  };

  button.addEventListener('click', () => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      stopReading();
      return;
    }

    const text = textBlock.innerText.trim().replace(/\s+/g, ' ');
    if (!text) return;

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'fr-FR';
    currentUtterance.rate = 0.95;
    currentUtterance.pitch = 1;
    currentUtterance.onstart = () => {
      button.classList.add('is-playing');
      button.textContent = '⏹';
    };
    currentUtterance.onend = stopReading;
    currentUtterance.onerror = stopReading;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(currentUtterance);
  });
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
  initHeroBg();
  initScroll();
  setupTextToSpeech('fireAudioBtn', 'fireText');
  setupTextToSpeech('gasAudioBtn', 'gasText');

  // Compute canvas sizes based on container
  const MAIN_COLS = 78, MAIN_ROWS = 80;
  const DEMO_COLS = 45, DEMO_ROWS = 30;
  const CPX_COLS = 55, CPX_ROWS = 30;

  createInstance('main', 'mainCanvas', MAIN_COLS, MAIN_ROWS);
  if (document.getElementById('demoCanvas')) createInstance('demo', 'demoCanvas', DEMO_COLS, DEMO_ROWS);
  if (document.getElementById('complexCanvas')) createInstance('complex', 'complexCanvas', CPX_COLS, CPX_ROWS);

  buildPatternGrid('patternGrid', PATTERNS_BASIC, 'main');
  // Do not show advanced patterns in the right column — keep dock populated instead
  buildPatternGrid('complexGrid', [], 'main');
  buildPatternGrid('dockGrid', PATTERNS_COMPLEX.slice(0, 4), 'main');

  updateStats('main');
  updateStats('demo');
  updateStats('complex');

  // Attach UI listeners (keeps HTML clean)
  document.getElementById('playBtn')?.addEventListener('click', () => togglePlay('main'));
  document.getElementById('stepMain')?.addEventListener('click', () => stepOnce('main'));
  document.getElementById('clearMain')?.addEventListener('click', () => clearGrid('main'));
  document.getElementById('randomMain')?.addEventListener('click', () => randomize('main'));
  document.getElementById('speedMain')?.addEventListener('input', (e) => setSpeed('main', e.target.value));

  document.getElementById('playBtn2')?.addEventListener('click', () => togglePlay('demo'));
  document.getElementById('stepDemo')?.addEventListener('click', () => stepOnce('demo'));
  document.getElementById('clearDemo')?.addEventListener('click', () => clearGrid('demo'));
  document.getElementById('speedDemo')?.addEventListener('input', (e) => setSpeed('demo', e.target.value));

  document.getElementById('playBtn3')?.addEventListener('click', () => togglePlay('complex'));
  document.getElementById('stepComplex')?.addEventListener('click', () => stepOnce('complex'));
  document.getElementById('clearComplex')?.addEventListener('click', () => clearGrid('complex'));
  document.getElementById('speedComplex')?.addEventListener('input', (e) => setSpeed('complex', e.target.value));

});
