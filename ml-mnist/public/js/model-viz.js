let currentVizKey = null;
let lastTableData = null;

async function reinitModelViz() {
  const grid = document.getElementById('modelVizGrid');
  grid.innerHTML = '<p class="viz-loading">Переинициализация...</p>';
  try {
    await fetch('/api/model-viz-snapshots', { method: 'DELETE' });
    const res = await fetch('/api/init-model-viz', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    await refreshModelVizList();
    await displayModelVizByKey('epoch_0');
    log('Модель переинициализирована, слепки удалены');
  } catch (err) {
    log('Ошибка: ' + err.message, true);
    grid.innerHTML = '';
  }
}

async function initModelViz() {
  const grid = document.getElementById('modelVizGrid');
  try {
    const res = await fetch('/api/model-viz-list');
    const { epochs } = await res.json();
    if (epochs?.includes(0)) {
      await refreshModelVizList();
      const sel = document.getElementById('modelVizSelect');
      if (sel) sel.value = 'epoch_0';
      await displayModelVizByKey('epoch_0');
      log('Модель уже инициализирована');
      return;
    }
  } catch (_) {}

  grid.innerHTML = '<p class="viz-loading">Создание модели со случайными весами...</p>';
  try {
    const res = await fetch('/api/init-model-viz', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    await refreshModelVizList();
    await displayModelVizByKey('epoch_0');
    log('Модель инициализирована, картинки созданы');
  } catch (err) {
    log('Ошибка: ' + err.message, true);
    grid.innerHTML = '';
  }
}

function onModelVizSelect() {
  const sel = document.getElementById('modelVizSelect');
  const key = sel?.value;
  if (key) displayModelVizByKey(key);
}

function createCanvas(w, h, cls = '') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.className = cls || 'viz-canvas';
  return c;
}

function loadImageToCanvas(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => reject(new Error('Не удалось загрузить: ' + src));
    img.src = src;
  });
}

function refreshZoomedCanvases(canvases) {
  if (!canvases) return;
  const drawScaled = (src, dst, scale) => {
    if (!src || !dst) return;
    const ctx = dst.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, src.width * scale, src.height * scale);
  };
  if (canvases.layer1x10 && canvases.layer1) drawScaled(canvases.layer1, canvases.layer1x10, 10);
  if (canvases.layer2x10 && canvases.layer2) drawScaled(canvases.layer2, canvases.layer2x10, 10);
  if (canvases.outputx100 && canvases.output) drawScaled(canvases.output, canvases.outputx100, 100);
}

async function displayModelVizByKey(key) {
  currentVizKey = key;
  const grid = document.getElementById('modelVizGrid');
  grid.innerHTML = '<p class="viz-loading">Загрузка...</p>';

  const base = `/model-viz/${key}`;
  const specs = [
    { name: 'Вход 28×28', src: `${base}/layer_input.webp`, w: 28, h: 28 },
    { name: 'Слой 1 (32×16)', src: `${base}/layer_h1.webp`, w: 32, h: 16 },
    { name: 'Слой 2 (16×16)', src: `${base}/layer_h2.webp`, w: 16, h: 16 },
    { name: 'Выход (10×1)', src: `${base}/layer_out.webp`, w: 10, h: 1 },
    { name: 'Веса W1 (784×513)', src: `${base}/weights_w1.webp`, w: 784, h: 513 },
    { name: 'Веса W2 (512×257)', src: `${base}/weights_w2.webp`, w: 512, h: 257 },
    { name: 'Веса W3 (256×11)', src: `${base}/weights_w3.webp`, w: 256, h: 11 }
  ];

  const canvases = {};
  const [inputSpec, layer1Spec, layer2Spec, outputSpec, w1Spec, w2Spec, w3Spec] = specs;

  await Promise.all(specs.map(s => {
    const c = createCanvas(s.w, s.h);
    return loadImageToCanvas(c, s.src).catch(() => {});
  }));

  grid.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'viz-layers';

  const col = document.createElement('div');
  col.className = 'viz-input-column';

  const inputCanvas = createCanvas(28, 28);
  await loadImageToCanvas(inputCanvas, inputSpec.src).catch(() => {});
  canvases.input = inputCanvas;
  const inputWrap = document.createElement('div');
  inputWrap.className = 'viz-item';
  inputWrap.innerHTML = `<p class="viz-label">${inputSpec.name}</p>`;
  inputWrap.appendChild(inputCanvas);
  col.appendChild(inputWrap);

  const w1Canvas = createCanvas(784, 513);
  await loadImageToCanvas(w1Canvas, w1Spec.src).catch(() => {});
  canvases.w1 = w1Canvas;
  const w1Wrap = document.createElement('div');
  w1Wrap.className = 'viz-item viz-w1-row';
  w1Wrap.innerHTML = `
    <p class="viz-label">${w1Spec.name}</p>
    <p class="viz-desc">784 строк — по одной на каждый входной пиксель (28×28). 513 столбцов — веса от каждого пикселя к 512 нейронам слоя 1 плюс bias.</p>`;
  w1Wrap.appendChild(w1Canvas);
  col.appendChild(w1Wrap);

  const layer1Canvas = createCanvas(32, 16);
  await loadImageToCanvas(layer1Canvas, layer1Spec.src).catch(() => {});
  canvases.layer1 = layer1Canvas;
  const layer1x10Canvas = createCanvas(320, 160);
  refreshZoomedCanvases({ layer1: layer1Canvas, layer1x10: layer1x10Canvas });
  const layer1Block = document.createElement('div');
  layer1Block.className = 'viz-layer1-block';
  const layer1Row = document.createElement('div');
  layer1Row.className = 'viz-layer1-row';
  const layer1Wrap = document.createElement('div');
  layer1Wrap.className = 'viz-layer1-item';
  layer1Wrap.innerHTML = `<p class="viz-label">${layer1Spec.name}</p>`;
  layer1Wrap.appendChild(layer1Canvas);
  const layer1x10Wrap = document.createElement('div');
  layer1x10Wrap.className = 'viz-layer1-item viz-item-x10';
  layer1x10Wrap.innerHTML = '<p class="viz-label">Слой 1 (32×16) ×10</p>';
  layer1x10Wrap.appendChild(layer1x10Canvas);
  canvases.layer1x10 = layer1x10Canvas;
  layer1Row.appendChild(layer1Wrap);
  layer1Row.appendChild(layer1x10Wrap);
  layer1Block.appendChild(layer1Row);
  col.appendChild(layer1Block);

  const w2Canvas = createCanvas(512, 257);
  await loadImageToCanvas(w2Canvas, w2Spec.src).catch(() => {});
  canvases.w2 = w2Canvas;
  const w2Wrap = document.createElement('div');
  w2Wrap.className = 'viz-item viz-w2-row';
  w2Wrap.innerHTML = `
    <p class="viz-label">${w2Spec.name}</p>
    <p class="viz-desc">512 строк — по одной на каждый нейрон слоя 1 (32×16). 257 столбцов — веса к 256 нейронам слоя 2 плюс bias.</p>`;
  w2Wrap.appendChild(w2Canvas);
  col.appendChild(w2Wrap);

  const layer2Canvas = createCanvas(16, 16);
  await loadImageToCanvas(layer2Canvas, layer2Spec.src).catch(() => {});
  canvases.layer2 = layer2Canvas;
  const layer2x10Canvas = createCanvas(160, 160);
  refreshZoomedCanvases({ layer2: layer2Canvas, layer2x10: layer2x10Canvas });
  const layer2Block = document.createElement('div');
  layer2Block.className = 'viz-layer2-block';
  const layer2Row = document.createElement('div');
  layer2Row.className = 'viz-layer2-row';
  const layer2Wrap = document.createElement('div');
  layer2Wrap.className = 'viz-layer2-item';
  layer2Wrap.innerHTML = `<p class="viz-label">${layer2Spec.name}</p>`;
  layer2Wrap.appendChild(layer2Canvas);
  const layer2x10Wrap = document.createElement('div');
  layer2x10Wrap.className = 'viz-layer2-item viz-item-x10';
  layer2x10Wrap.innerHTML = '<p class="viz-label">Слой 2 (16×16) ×10</p>';
  layer2x10Wrap.appendChild(layer2x10Canvas);
  canvases.layer2x10 = layer2x10Canvas;
  layer2Row.appendChild(layer2Wrap);
  layer2Row.appendChild(layer2x10Wrap);
  layer2Block.appendChild(layer2Row);
  col.appendChild(layer2Block);

  const w3Canvas = createCanvas(256, 11);
  await loadImageToCanvas(w3Canvas, w3Spec.src).catch(() => {});
  canvases.w3 = w3Canvas;
  const w3Wrap = document.createElement('div');
  w3Wrap.className = 'viz-item viz-w3-row';
  w3Wrap.innerHTML = `
    <p class="viz-label">${w3Spec.name}</p>
    <p class="viz-desc">256 строк — по одной на каждый нейрон слоя 2 (16×16). 11 столбцов — веса к 10 нейронам выхода плюс bias.</p>`;
  w3Wrap.appendChild(w3Canvas);
  col.appendChild(w3Wrap);

  const outputCanvas = createCanvas(10, 1);
  await loadImageToCanvas(outputCanvas, outputSpec.src).catch(() => {});
  canvases.output = outputCanvas;
  const outputx100Canvas = createCanvas(1000, 100);
  refreshZoomedCanvases({ output: outputCanvas, outputx100: outputx100Canvas });
  const outputBlock = document.createElement('div');
  outputBlock.className = 'viz-output-block';
  const outputRow = document.createElement('div');
  outputRow.className = 'viz-output-row';
  const outputWrap = document.createElement('div');
  outputWrap.className = 'viz-output-item';
  outputWrap.innerHTML = `<p class="viz-label">${outputSpec.name}</p>`;
  outputWrap.appendChild(outputCanvas);
  const outputx100Wrap = document.createElement('div');
  outputx100Wrap.className = 'viz-output-item viz-item-x100';
  outputx100Wrap.innerHTML = '<p class="viz-label">Выход (10×1) ×100</p>';
  outputx100Wrap.appendChild(outputx100Canvas);
  canvases.outputx100 = outputx100Canvas;
  outputRow.appendChild(outputWrap);
  outputRow.appendChild(outputx100Wrap);
  outputBlock.appendChild(outputRow);
  col.appendChild(outputBlock);

  window.modelCanvases = canvases;
  container.appendChild(col);

  grid.appendChild(container);

  try {
    const tableRes = await fetch(`${base}/table.json`);
    if (tableRes.ok) {
      const { label, output } = await tableRes.json();
      lastTableData = { label, output };
      const maxIdx = output.reduce((best, o, i) => parseFloat(o.pct) > parseFloat(output[best].pct) ? i : best, 0);
      const tableDiv = document.createElement('div');
      tableDiv.className = 'viz-table-wrap';
      tableDiv.innerHTML = `
        <p class="viz-label">Таблица (дано / результат)</p>
        <table class="viz-table">
          <tr><th>Цифра</th>${[0,1,2,3,4,5,6,7,8,9].map(d=>`<td>${d}</td>`).join('')}</tr>
          <tr><th>Дано</th>${[0,1,2,3,4,5,6,7,8,9].map(d=>`<td>${d===label?'✓':''}</td>`).join('')}</tr>
          <tr><th>%</th>${output.map((o,i)=>`<td class="${i===maxIdx?'viz-table-max':''}">${o.pct}%</td>`).join('')}</tr>
        </table>`;
      grid.appendChild(tableDiv);
    }
  } catch (_) {}

  log(`Слепок ${key} загружен`);
}

function updateModelVizTable(label, outputProbs) {
  const wrap = document.querySelector('.viz-table-wrap');
  if (!wrap) return;
  const outPct = outputProbs.map((p, i) => ({ digit: i, pct: (p * 100).toFixed(1) }));
  const maxIdx = outputProbs.reduce((best, p, i) => p > outputProbs[best] ? i : best, 0);
  lastTableData = { label, output: outPct };
  wrap.innerHTML = `
    <p class="viz-label">Таблица (дано / результат)</p>
    <table class="viz-table">
      <tr><th>Цифра</th>${[0,1,2,3,4,5,6,7,8,9].map(d=>`<td>${d}</td>`).join('')}</tr>
      <tr><th>Дано</th>${[0,1,2,3,4,5,6,7,8,9].map(d=>`<td>${d===label?'✓':''}</td>`).join('')}</tr>
      <tr><th>%</th>${outPct.map((o,i)=>`<td class="${i===maxIdx?'viz-table-max':''}">${o.pct}%</td>`).join('')}</tr>
    </table>`;
}

async function refreshModelVizList() {
  const sel = document.getElementById('modelVizSelect');
  const initBtn = document.getElementById('initModelBtn');
  const reinitBtn = document.getElementById('reinitModelBtn');
  const compareBtn = document.getElementById('compareSnapshotsBtn');
  try {
    const res = await fetch('/api/model-viz-list');
    const { epochs, snapshots } = await res.json();
    const hasModel = (epochs?.includes(0) || (snapshots?.length || 0) > 0);
    if (initBtn) initBtn.style.display = hasModel ? 'none' : '';
    if (reinitBtn) reinitBtn.style.display = hasModel ? '' : 'none';
    if (compareBtn) compareBtn.style.display = hasModel ? '' : 'none';

    const options = [];
    if (epochs?.includes(0)) options.push({ key: 'epoch_0', label: 'Начальная' });
    (snapshots || []).forEach(n => options.push({ key: `snapshot_${n}`, label: `Слепок ${n}` }));

    if (sel) {
      sel.innerHTML = options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
      if (options.length > 0) {
        const lastKey = options[options.length - 1].key;
        if (!sel.value || !options.some(o => o.key === sel.value)) sel.value = lastKey;
      }
    }
    return options;
  } catch {
    if (sel) sel.innerHTML = '<option value="">—</option>';
    if (initBtn) initBtn.style.display = '';
    if (reinitBtn) reinitBtn.style.display = 'none';
    if (compareBtn) compareBtn.style.display = 'none';
    return [];
  }
}

function getSnapshotOptions() {
  const sel = document.getElementById('modelVizSelect');
  if (!sel) return [];
  return Array.from(sel.options).map(o => ({ key: o.value, label: o.text }));
}

function openComparePopover() {
  const popover = document.getElementById('comparePopover');
  const options = getSnapshotOptions();
  if (options.length < 2) {
    if (typeof showToast === 'function') showToast('Нужно минимум 2 слепка для сравнения');
    return;
  }
  const selA = document.getElementById('compareSelectA');
  const selB = document.getElementById('compareSelectB');
  const body = document.getElementById('comparePopoverBody');
  selA.innerHTML = options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
  selB.innerHTML = options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
  selA.value = options[0]?.key ?? '';
  selB.value = options[options.length - 1]?.key ?? '';
  selA.onchange = renderCompareView;
  selB.onchange = renderCompareView;
  popover.classList.add('compare-popover-open');
  renderCompareView();
}

function closeComparePopover() {
  document.getElementById('comparePopover').classList.remove('compare-popover-open');
}

async function renderCompareView() {
  const keyA = document.getElementById('compareSelectA')?.value;
  const keyB = document.getElementById('compareSelectB')?.value;
  const body = document.getElementById('comparePopoverBody');
  if (!keyA || !keyB) {
    body.innerHTML = '<p class="viz-loading">Выберите оба слепка</p>';
    return;
  }
  body.innerHTML = '<p class="viz-loading">Загрузка...</p>';
  const specs = [
    { name: 'Вход 28×28', file: 'layer_input.webp' },
    { name: 'Слой 1 (32×16)', file: 'layer_h1.webp', zoom: 10, zoomClass: 'compare-zoom-layer1' },
    { name: 'Слой 2 (16×16)', file: 'layer_h2.webp', zoom: 10, zoomClass: 'compare-zoom-layer2' },
    { name: 'Выход (10×1)', file: 'layer_out.webp', zoom: 100, zoomClass: 'compare-zoom-100' },
    { name: 'Веса W1 (784×513)', file: 'weights_w1.webp' },
    { name: 'Веса W2 (512×257)', file: 'weights_w2.webp' },
    { name: 'Веса W3 (256×11)', file: 'weights_w3.webp', zoom: 10, zoomClass: 'compare-zoom-w3' }
  ];
  const colA = document.createElement('div');
  colA.className = 'compare-column';
  colA.innerHTML = '<div class="compare-column-title">Слепок A</div>';
  const colB = document.createElement('div');
  colB.className = 'compare-column';
  colB.innerHTML = '<div class="compare-column-title">Слепок B</div>';
  for (const s of specs) {
    const srcA = `/model-viz/${keyA}/${s.file}`;
    const srcB = `/model-viz/${keyB}/${s.file}`;
    const wrapA = document.createElement('div');
    wrapA.className = 'viz-item compare-item';
    const zoomCls = s.zoomClass || `compare-zoom-${s.zoom}`;
    wrapA.innerHTML = s.zoom
      ? `<p class="viz-label">${s.name}</p><div class="compare-item-row"><img src="${srcA}" alt="${s.name}" loading="lazy"><img class="compare-zoom ${zoomCls}" src="${srcA}" alt="${s.name} ×${s.zoom}" loading="lazy"></div>`
      : `<p class="viz-label">${s.name}</p><img src="${srcA}" alt="${s.name}" loading="lazy">`;
    const wrapB = document.createElement('div');
    wrapB.className = 'viz-item compare-item';
    wrapB.innerHTML = s.zoom
      ? `<p class="viz-label">${s.name}</p><div class="compare-item-row"><img src="${srcB}" alt="${s.name}" loading="lazy"><img class="compare-zoom ${zoomCls}" src="${srcB}" alt="${s.name} ×${s.zoom}" loading="lazy"></div>`
      : `<p class="viz-label">${s.name}</p><img src="${srcB}" alt="${s.name}" loading="lazy">`;
    colA.appendChild(wrapA);
    colB.appendChild(wrapB);
  }
  const grid = document.createElement('div');
  grid.className = 'compare-sidebyside';
  grid.appendChild(colA);
  grid.appendChild(colB);
  body.innerHTML = '';
  body.appendChild(grid);
}

document.addEventListener('DOMContentLoaded', async () => {
  const options = await refreshModelVizList();
  document.getElementById('modelAccordionHeader').addEventListener('click', () => {
    document.querySelector('.model-accordion').classList.toggle('expanded');
  });
  if (options.length > 0) {
    const sel = document.getElementById('modelVizSelect');
    const key = sel?.value || options[options.length - 1].key;
    await displayModelVizByKey(key);
  }
});
