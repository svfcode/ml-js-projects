const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const si = require('systeminformation');
const nn = require('./nn-server');

const app = express();
const PORT = 3000;
const PREPARED_DIR = path.join(__dirname, 'prepared');
const MODEL_VIZ_DIR = path.join(__dirname, 'model-viz');
const STATS_FILE = path.join(__dirname, 'training-stats.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/mnist', express.static(path.join(__dirname, 'mnist')));
app.use('/prepared', express.static(PREPARED_DIR));
app.use('/model-viz', express.static(MODEL_VIZ_DIR));

const CSV_FILES = {
  tiny: { file: 'mnist_train_100.csv', hasHeader: false },
  medium: { file: 'mnist_train.csv', hasHeader: true, limit: 10000 },
  full: { file: 'mnist_train.csv', hasHeader: true }
};

function parseCSV(csvPath, hasHeader) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.trim().split('\n');
  const start = hasHeader ? 1 : 0;
  const samples = [];

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 785) {
      samples.push({
        label: parseInt(parts[0], 10),
        pixels: parts.slice(1, 785).map(p => parseInt(p, 10))
      });
    }
  }
  return samples;
}

async function writeWebp(pixels, width, height, outPath) {
  const buf = Buffer.from(pixels.flat());
  await sharp(buf, { raw: { width, height, channels: 1 } })
    .webp({ lossless: true })
    .toFile(outPath);
}

function weightToPixel(w) {
  return Math.max(0, Math.min(255, Math.round((w + 1) / 2 * 255)));
}

function transposeForImage(matrix) {
  return matrix[0].map((_, c) => matrix.map(row => row[c]));
}

async function prepareImages(mode) {
  const cfg = CSV_FILES[mode];
  const csvPath = path.join(__dirname, 'mnist', cfg.file);
  const outDir = path.join(PREPARED_DIR, mode);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Файл не найден: ${cfg.file}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  let samples = parseCSV(csvPath, cfg.hasHeader);
  if (cfg.limit) samples = samples.slice(0, cfg.limit);
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < samples.length; i++) {
    const { label, pixels } = samples[i];
    const name = `${label}_${String(i).padStart(5, '0')}.webp`;
    const outPath = path.join(outDir, name);
    if (fs.existsSync(outPath)) {
      skipped++;
      continue;
    }
    await writeWebp([pixels], 28, 28, outPath);
    written++;
  }

  return { count: written + skipped, written, skipped, dir: outDir };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

function loadTrainingStats() {
  if (!fs.existsSync(STATS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

app.get('/api/training-stats', (req, res) => {
  try {
    const stats = loadTrainingStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/training-stats', (req, res) => {
  try {
    const entry = req.body;
    if (!entry || typeof entry !== 'object') return res.status(400).json({ error: 'Некорректные данные' });
    entry.date = new Date().toISOString();
    entry.id = Date.now();
    const stats = loadTrainingStats();
    stats.push(entry);
    if (stats.length > 500) stats.splice(0, stats.length - 500);
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system-load', async (req, res) => {
  try {
    const [cpu, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);
    const processMem = process.memoryUsage();
    res.json({
      cpu: Math.round(cpu.currentLoad),
      ramTotal: mem.total,
      ramUsed: mem.used,
      ramFree: mem.free,
      processHeap: Math.round(processMem.heapUsed / 1024 / 1024)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const SPRITE_MAX = 100;
const CELL_SIZE = 28;

app.get('/api/batch-sprite', async (req, res) => {
  try {
    const mode = req.query.mode || 'tiny';
    const start = Math.max(0, parseInt(req.query.start, 10) || 0);
    let count = Math.min(SPRITE_MAX, Math.max(1, parseInt(req.query.count, 10) || 100));

    if (!['tiny', 'medium', 'full'].includes(mode)) {
      return res.status(400).json({ error: 'mode должен быть tiny, medium или full' });
    }

    const dir = path.join(PREPARED_DIR, mode);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Данные не приготовлены' });

    const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.webp')).sort();
    const files = allFiles.slice(start, start + count);
    if (files.length === 0) return res.status(404).json({ error: 'Нет картинок' });

    const cols = 10;
    const rows = Math.ceil(files.length / cols);
    const width = cols * CELL_SIZE;
    const height = rows * CELL_SIZE;

    const composite = [];
    for (let i = 0; i < files.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      composite.push({
        input: path.join(dir, files[i]),
        left: col * CELL_SIZE,
        top: row * CELL_SIZE
      });
    }

    const buf = await sharp({
      create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
      .composite(composite)
      .webp({ lossless: true })
      .toBuffer();

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Спрайт по списку файлов (для перемешанного порядка) */
app.post('/api/batch-sprite-by-files', async (req, res) => {
  try {
    const { mode, files } = req.body;
    if (!['tiny', 'medium', 'full'].includes(mode) || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Нужны mode и files (массив)' });
    }
    const limited = files.slice(0, SPRITE_MAX);
    const dir = path.join(PREPARED_DIR, mode);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Данные не приготовлены' });

    const cols = 10;
    const rows = Math.ceil(limited.length / cols);
    const width = cols * CELL_SIZE;
    const height = rows * CELL_SIZE;

    const composite = [];
    for (let i = 0; i < limited.length; i++) {
      const fp = path.join(dir, limited[i]);
      if (!fs.existsSync(fp)) continue;
      composite.push({
        input: fp,
        left: (i % cols) * CELL_SIZE,
        top: Math.floor(i / cols) * CELL_SIZE
      });
    }
    if (composite.length === 0) return res.status(404).json({ error: 'Файлы не найдены' });

    const buf = await sharp({
      create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
      .composite(composite)
      .webp({ lossless: true })
      .toBuffer();

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prepared-list', (req, res) => {
  const mode = req.query.mode || 'tiny';
  if (!['tiny', 'medium', 'full'].includes(mode)) {
    return res.status(400).json({ error: 'mode должен быть tiny, medium или full' });
  }
  const dir = path.join(PREPARED_DIR, mode);
  if (!fs.existsSync(dir)) {
    return res.json({ files: [] });
  }
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.webp'))
    .sort();
  res.json({ files });
});

app.post('/api/save-model-viz', async (req, res) => {
  try {
    const { epoch, input, layer1, layer2, output, label, weights } = req.body;
    if (epoch == null || !weights) return res.status(400).json({ error: 'epoch и weights обязательны' });

    const epochDir = path.join(MODEL_VIZ_DIR, `epoch_${epoch}`);
    fs.mkdirSync(epochDir, { recursive: true });

    await writeWebp([input], 28, 28, path.join(epochDir, 'layer_input.webp'));
    await writeWebp([layer1], 32, 16, path.join(epochDir, 'layer_h1.webp'));
    await writeWebp([layer2], 16, 16, path.join(epochDir, 'layer_h2.webp'));
    await writeWebp([output], 10, 1, path.join(epochDir, 'layer_out.webp'));

    const w1Transposed = transposeForImage(weights.w1);
    const w1Pixels = w1Transposed.flat().map(weightToPixel);
    const w2Transposed = transposeForImage(weights.w2);
    const w2Pixels = w2Transposed.flat().map(weightToPixel);
    const w3Transposed = transposeForImage(weights.w3);
    const w3Pixels = w3Transposed.flat().map(weightToPixel);

    await writeWebp(w1Pixels, 784, 513, path.join(epochDir, 'weights_w1.webp'));
    await writeWebp(w2Pixels, 512, 257, path.join(epochDir, 'weights_w2.webp'));
    await writeWebp(w3Pixels, 256, 11, path.join(epochDir, 'weights_w3.webp'));

    const outPct = output.map((v, i) => ({ digit: i, pct: (v / 255 * 100).toFixed(1) })).sort((a, b) => a.digit - b.digit);
    fs.writeFileSync(path.join(epochDir, 'table.json'), JSON.stringify({ label, output: outPct }, null, 2));

    res.json({ success: true, dir: `model-viz/epoch_${epoch}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/init-model-viz', async (req, res) => {
  try {
    const { W1, W2, W3 } = nn.createRandomModel();
    const randomInput = Array(784).fill(0).map(() => Math.random());
    const randomLabel = Math.floor(Math.random() * 10);

    const { a1, a2, a3, out } = nn.forward(W1, W2, W3, randomInput);

    const inputPixels = randomInput.map(v => Math.round(v * 255));
    const layer1 = a1.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
    const layer2 = a2.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
    const output = out.map(v => Math.round(v * 255));

    const weights = nn.getWeightsForImage(W1, W2, W3);
    const epochDir = path.join(MODEL_VIZ_DIR, 'epoch_0');
    fs.mkdirSync(epochDir, { recursive: true });

    await writeWebp([inputPixels], 28, 28, path.join(epochDir, 'layer_input.webp'));
    await writeWebp([layer1], 32, 16, path.join(epochDir, 'layer_h1.webp'));
    await writeWebp([layer2], 16, 16, path.join(epochDir, 'layer_h2.webp'));
    await writeWebp([output], 10, 1, path.join(epochDir, 'layer_out.webp'));

    const w1Transposed = transposeForImage(weights.w1);
    const w1Pixels = w1Transposed.flat().map(weightToPixel);
    const w2Transposed = transposeForImage(weights.w2);
    const w2Pixels = w2Transposed.flat().map(weightToPixel);
    const w3Transposed = transposeForImage(weights.w3);
    const w3Pixels = w3Transposed.flat().map(weightToPixel);

    await writeWebp(w1Pixels, 784, 513, path.join(epochDir, 'weights_w1.webp'));
    await writeWebp(w2Pixels, 512, 257, path.join(epochDir, 'weights_w2.webp'));
    await writeWebp(w3Pixels, 256, 11, path.join(epochDir, 'weights_w3.webp'));

    const outPct = output.map((v, i) => ({ digit: i, pct: (v / 255 * 100).toFixed(1) })).sort((a, b) => a.digit - b.digit);
    fs.writeFileSync(path.join(epochDir, 'table.json'), JSON.stringify({ label: randomLabel, output: outPct }, null, 2));

    res.json({ success: true, dir: 'model-viz/epoch_0' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/model-viz-snapshots', (req, res) => {
  try {
    if (!fs.existsSync(MODEL_VIZ_DIR)) return res.json({ success: true, deleted: 0 });
    const all = fs.readdirSync(MODEL_VIZ_DIR);
    const snapshotDirs = all.filter(d => d.startsWith('snapshot_'));
    for (const d of snapshotDirs) {
      fs.rmSync(path.join(MODEL_VIZ_DIR, d), { recursive: true });
    }
    res.json({ success: true, deleted: snapshotDirs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/model-viz-list', (req, res) => {
  if (!fs.existsSync(MODEL_VIZ_DIR)) return res.json({ epochs: [], snapshots: [] });
  const all = fs.readdirSync(MODEL_VIZ_DIR);
  const epochs = all
    .filter(d => d.startsWith('epoch_'))
    .map(d => parseInt(d.replace('epoch_', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  const snapshots = all
    .filter(d => d.startsWith('snapshot_'))
    .map(d => parseInt(d.replace('snapshot_', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  res.json({ epochs, snapshots });
});

app.post('/api/save-model-snapshot', async (req, res) => {
  try {
    const { input, layer1, layer2, output, label, weights } = req.body;
    if (!weights) return res.status(400).json({ error: 'weights обязательны' });

    const existing = fs.existsSync(MODEL_VIZ_DIR) ? fs.readdirSync(MODEL_VIZ_DIR) : [];
    const snapshotNums = existing
      .filter(d => d.startsWith('snapshot_'))
      .map(d => parseInt(d.replace('snapshot_', ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = snapshotNums.length > 0 ? Math.max(...snapshotNums) + 1 : 1;

    const snapshotDir = path.join(MODEL_VIZ_DIR, `snapshot_${nextNum}`);
    fs.mkdirSync(snapshotDir, { recursive: true });

    await writeWebp([input], 28, 28, path.join(snapshotDir, 'layer_input.webp'));
    await writeWebp([layer1], 32, 16, path.join(snapshotDir, 'layer_h1.webp'));
    await writeWebp([layer2], 16, 16, path.join(snapshotDir, 'layer_h2.webp'));
    await writeWebp([output], 10, 1, path.join(snapshotDir, 'layer_out.webp'));

    const w1Transposed = transposeForImage(weights.w1);
    const w1Pixels = w1Transposed.flat().map(weightToPixel);
    const w2Transposed = transposeForImage(weights.w2);
    const w2Pixels = w2Transposed.flat().map(weightToPixel);
    const w3Transposed = transposeForImage(weights.w3);
    const w3Pixels = w3Transposed.flat().map(weightToPixel);

    await writeWebp(w1Pixels, 784, 513, path.join(snapshotDir, 'weights_w1.webp'));
    await writeWebp(w2Pixels, 512, 257, path.join(snapshotDir, 'weights_w2.webp'));
    await writeWebp(w3Pixels, 256, 11, path.join(snapshotDir, 'weights_w3.webp'));

    const outPct = output.map((v, i) => ({ digit: i, pct: (v / 255 * 100).toFixed(1) })).sort((a, b) => a.digit - b.digit);
    fs.writeFileSync(path.join(snapshotDir, 'table.json'), JSON.stringify({ label, output: outPct }, null, 2));

    res.json({ success: true, snapshot: nextNum, dir: `model-viz/snapshot_${nextNum}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prepare-data', async (req, res) => {
  const mode = req.query.mode || 'tiny';
  if (!['tiny', 'medium', 'full'].includes(mode)) {
    return res.status(400).json({ error: 'mode должен быть tiny, medium или full' });
  }
  try {
    const result = await prepareImages(mode);
    res.json({
      success: true,
      count: result.count,
      written: result.written,
      skipped: result.skipped,
      dir: path.relative(process.cwd(), result.dir)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MNIST server: http://localhost:${PORT}`);
});
