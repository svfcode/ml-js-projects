const BATCH_SIZE_MIN = 1;
const BATCH_SIZE_MAX = 5000;
const SPRITE_CHUNK = 100;

let imageFiles = [];
let currentBatchIndex = 0;
let lastSpriteUrls = [];

function validateBatchSize(value) {
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return { ok: false, error: 'Введите целое число' };
  }
  if (num < BATCH_SIZE_MIN) {
    return { ok: false, error: `Минимум ${BATCH_SIZE_MIN}` };
  }
  if (num > BATCH_SIZE_MAX) {
    return { ok: false, error: `Максимум ${BATCH_SIZE_MAX}` };
  }
  return { ok: true, value: num };
}

async function renderBatch(mode, batchIndex, batchSize) {
  const start = batchIndex * batchSize;
  const batch = imageFiles.slice(start, start + batchSize);
  const grid = document.getElementById('imagesGrid');
  grid.innerHTML = '';
  lastSpriteUrls.forEach(u => URL.revokeObjectURL(u));
  lastSpriteUrls = [];

  const useSprites = batchSize > SPRITE_CHUNK;

  if (useSprites) {
    const spriteCache = new Map();
    for (let i = 0; i < batch.length; i++) {
      const file = batch[i];
      const match = file.match(/^(\d+)_(\d+)\.webp$/);
      const label = match ? match[1] : '?';
      const chunkIdx = Math.floor(i / SPRITE_CHUNK);
      const cellIdx = i % SPRITE_CHUNK;
      const chunkStart = chunkIdx * SPRITE_CHUNK;
      const chunkFiles = batch.slice(chunkStart, chunkStart + SPRITE_CHUNK);
      const cacheKey = chunkFiles.join(',');
      let spriteUrl = spriteCache.get(cacheKey);
      if (!spriteUrl) {
        try {
          const r = await fetch('/api/batch-sprite-by-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, files: chunkFiles })
          });
          if (r.ok) {
            const blob = await r.blob();
            spriteUrl = URL.createObjectURL(blob);
            lastSpriteUrls.push(spriteUrl);
            spriteCache.set(cacheKey, spriteUrl);
          }
        } catch (_) {}
      }
      const div = document.createElement('div');
      div.className = 'thumb thumb-sprite';
      div.title = `Метка: ${label}`;
      div.dataset.file = file;
      if (spriteUrl) {
        div.style.backgroundImage = `url(${spriteUrl})`;
        div.style.backgroundSize = `${10 * 56}px ${Math.ceil(chunkFiles.length / 10) * 56}px`;
        div.style.backgroundPosition = `-${(cellIdx % 10) * 56}px -${Math.floor(cellIdx / 10) * 56}px`;
      }
      grid.appendChild(div);
    }
  } else {
    batch.forEach((file) => {
      const match = file.match(/^(\d+)_(\d+)\.webp$/);
      const label = match ? match[1] : '?';
      const img = document.createElement('img');
      img.src = `/prepared/${mode}/${file}`;
      img.alt = file;
      img.title = `Метка: ${label}`;
      img.className = 'thumb';
      grid.appendChild(img);
    });
  }

  const total = imageFiles.length;
  const totalBatches = Math.ceil(total / batchSize);
  const info = document.getElementById('batchInfo');
  info.textContent = `Батч ${batchIndex + 1} из ${totalBatches} (${batch.length} картинок)`;

  document.getElementById('prevBatch').disabled = batchIndex === 0;
  document.getElementById('nextBatch').disabled = batchIndex >= totalBatches - 1;
}

async function loadImagesBatch() {
  const input = document.getElementById('batchSize');
  const validation = validateBatchSize(input.value);

  if (!validation.ok) {
    log(validation.error, true);
    input.focus();
    input.select();
    return;
  }

  const batchSize = validation.value;
  const mode = document.querySelector('input[name="mode"]:checked').value;

  try {
    log('Загрузка списка картинок...');
    const res = await fetch(`/api/prepared-list?mode=${mode}`);
    const data = await res.json();

    if (!data.files || data.files.length === 0) {
      log('Нет картинок. Сначала нажмите «Приготовить данные»', true);
      return;
    }

    imageFiles = data.files;
    shuffleImageFiles();
    currentBatchIndex = 0;

    document.getElementById('batchNav').style.display = 'flex';
    await renderBatch(mode, 0, batchSize);
    log(`Загружено ${imageFiles.length} картинок (порядок перемешан), батч по ${batchSize}`);
  } catch (err) {
    log('Ошибка: ' + err.message, true);
  }
}

function shuffleImageFiles() {
  for (let i = imageFiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [imageFiles[i], imageFiles[j]] = [imageFiles[j], imageFiles[i]];
  }
}

function getBatchForTraining() {
  if (imageFiles.length === 0) return null;
  const batchSize = parseInt(document.getElementById('batchSize').value, 10) || 20;
  const start = currentBatchIndex * batchSize;
  return imageFiles.slice(start, start + batchSize);
}

function getBatchSize() {
  const v = validateBatchSize(document.getElementById('batchSize')?.value);
  return v.ok ? v.value : 20;
}

function getTotalBatches() {
  if (imageFiles.length === 0) return 0;
  return Math.ceil(imageFiles.length / getBatchSize());
}

/** Показать батч по индексу (0-based). Возвращает true если батч существует. */
async function showBatchAtIndex(batchIndex) {
  if (imageFiles.length === 0) return false;
  const batchSize = getBatchSize();
  const total = Math.ceil(imageFiles.length / batchSize);
  if (batchIndex < 0 || batchIndex >= total) return false;
  currentBatchIndex = batchIndex;
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'tiny';
  await renderBatch(mode, batchIndex, batchSize);
  return true;
}

function parseFileToIndex(filename) {
  const match = filename.match(/^\d+_(\d+)\.webp$/);
  return match ? parseInt(match[1], 10) : null;
}

function parseFileToLabel(filename) {
  const match = filename.match(/^(\d+)_\d+\.webp$/);
  return match ? parseInt(match[1], 10) : null;
}

function pixelsFromImageData(id) {
  const pixels = new Float32Array(784);
  for (let i = 0; i < 784; i++) pixels[i] = id.data[i * 4] / 255;
  return pixels;
}

/** Берёт пиксели из img-элемента на странице (без запросов) */
function getPixelsFromImgElement(img) {
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 28;
  canvas.height = 28;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, 28, 28);
  return pixelsFromImageData(ctx.getImageData(0, 0, 28, 28));
}

/** Берёт пиксели со страницы: из img или из спрайта. Один запрос на чанк спрайта. */
async function getBatchPixelsFromPage(files, mode) {
  const batchSize = parseInt(document.getElementById('batchSize').value, 10) || 20;
  const start = currentBatchIndex * batchSize;
  const useSprites = batchSize > SPRITE_CHUNK;
  const result = [];

  if (!useSprites) {
    for (const filename of files) {
      const label = parseFileToLabel(filename);
      if (label == null) continue;
      const img = document.querySelector(`#imagesGrid img[alt="${CSS.escape(filename)}"]`);
      let pixels = img ? getPixelsFromImgElement(img) : null;
      if (!pixels) pixels = await getPixelsFromImageUrl(`/prepared/${mode}/${filename}`);
      result.push({ pixels, label, filename });
    }
    return result;
  }

  const spriteCache = new Map();
  for (let i = 0; i < files.length; i++) {
    const label = parseFileToLabel(files[i]);
    if (label == null) continue;
    const chunkIdx = Math.floor(i / SPRITE_CHUNK);
    const cellIdx = i % SPRITE_CHUNK;
    const chunkFiles = files.slice(chunkIdx * SPRITE_CHUNK, chunkIdx * SPRITE_CHUNK + SPRITE_CHUNK);
    const cacheKey = chunkFiles.join(',');

    let spriteImg = spriteCache.get(cacheKey);
    if (!spriteImg) {
      const r = await fetch('/api/batch-sprite-by-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, files: chunkFiles })
      });
      if (!r.ok) throw new Error('Не удалось загрузить спрайт');
      const blob = await r.blob();
      const spriteUrl = URL.createObjectURL(blob);
      spriteImg = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('Не удалось загрузить спрайт'));
        im.src = spriteUrl;
      });
      URL.revokeObjectURL(spriteUrl);
      spriteCache.set(cacheKey, spriteImg);
    }

    const col = cellIdx % 10;
    const row = Math.floor(cellIdx / 10);
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(spriteImg, col * 28, row * 28, 28, 28, 0, 0, 28, 28);
    const pixels = pixelsFromImageData(ctx.getImageData(0, 0, 28, 28));
    result.push({ pixels, label, filename: files[i] });
  }
  return result;
}

/** Загружает изображение по URL (fallback, когда не на странице) */
function getPixelsFromImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 28;
      canvas.height = 28;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, img.naturalWidth || 28, img.naturalHeight || 28, 0, 0, 28, 28);
      resolve(pixelsFromImageData(ctx.getImageData(0, 0, 28, 28)));
    };
    img.onerror = () => reject(new Error('Не удалось загрузить картинку'));
    img.src = url;
  });
}

async function removeUsedFilesFromBatch(usedFilenames) {
  if (!usedFilenames || usedFilenames.length === 0) return;
  const set = new Set(usedFilenames);
  const before = imageFiles.length;
  imageFiles = imageFiles.filter(f => !set.has(f));
  const removed = before - imageFiles.length;
  if (removed > 0) {
    const batchSize = parseInt(document.getElementById('batchSize').value, 10) || 20;
    const totalBatches = Math.ceil(imageFiles.length / batchSize);
    if (currentBatchIndex >= totalBatches && totalBatches > 0) currentBatchIndex = Math.max(0, totalBatches - 1);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    await renderBatch(mode, currentBatchIndex, batchSize);
    if (typeof log === 'function') log(`Убрано из батча: ${removed} картинок, осталось ${imageFiles.length}`);
  }
}

function initBatchNav() {
  document.getElementById('prevBatch').addEventListener('click', async () => {
    const batchSize = validateBatchSize(document.getElementById('batchSize').value);
    if (batchSize.ok && currentBatchIndex > 0) {
      currentBatchIndex--;
      const mode = document.querySelector('input[name="mode"]:checked').value;
      await renderBatch(mode, currentBatchIndex, batchSize.value);
    }
  });

  document.getElementById('nextBatch').addEventListener('click', async () => {
    const batchSize = validateBatchSize(document.getElementById('batchSize').value);
    if (batchSize.ok) {
      const totalBatches = Math.ceil(imageFiles.length / batchSize.value);
      if (currentBatchIndex < totalBatches - 1) {
        currentBatchIndex++;
        const mode = document.querySelector('input[name="mode"]:checked').value;
        await renderBatch(mode, currentBatchIndex, batchSize.value);
      }
    }
  });
}
