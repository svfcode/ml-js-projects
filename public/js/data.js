const EVAL_SAMPLES = 500;

async function fetchAndParseCSV(url, hasHeader, limit) {
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const start = hasHeader ? 1 : 0;
  const labels = [];
  const pixels = [];

  for (let i = start; i < lines.length; i++) {
    if (limit != null && pixels.length >= limit) break;
    const parts = lines[i].split(',');
    if (parts.length >= 785) {
      labels.push(parseInt(parts[0], 10));
      const row = new Float32Array(784);
      for (let k = 0; k < 784; k++) row[k] = parseInt(parts[k + 1], 10) / 255;
      pixels.push(row);
    }
  }
  return { labels, pixels };
}

async function loadDataset(mode) {
  const cfg = FILES[mode];
  const [trainData, testData] = await Promise.all([
    fetchAndParseCSV(cfg.train, cfg.hasHeader, cfg.trainLimit ?? null),
    fetchAndParseCSV(cfg.test, cfg.hasHeader, cfg.testLimit ?? null)
  ]);
  return { trainData, testData };
}

/** Только тестовые данные для оценки (минимум памяти при train one/batch) */
async function loadTestDataForEval(mode) {
  const cfg = FILES[mode];
  return fetchAndParseCSV(cfg.test, cfg.hasHeader, EVAL_SAMPLES);
}
