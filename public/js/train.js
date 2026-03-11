let isTraining = false;
let isAutoTraining = false;
let autoTrainingStopped = false;
let cachedData = { trainData: null, testData: null, mode: null };
let cachedTestDataForEval = { data: null, mode: null };

async function ensureData() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (!cachedData.trainData || cachedData.mode !== mode) {
    const { trainData, testData } = await loadDataset(mode);
    cachedData = { trainData, testData, mode };
  }
  return cachedData;
}

/** Только тестовые данные для оценки (train one / batch) — в память ~500 примеров */
async function ensureTestDataForEval() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (!cachedTestDataForEval.data || cachedTestDataForEval.mode !== mode) {
    cachedTestDataForEval = { data: await loadTestDataForEval(mode), mode };
  }
  return cachedTestDataForEval.data;
}

function getBatchIndices(trainDataLen) {
  const files = typeof getBatchForTraining === 'function' ? getBatchForTraining() : null;
  if (!files || files.length === 0) return null;
  let indices = files.map(f => typeof parseFileToIndex === 'function' ? parseFileToIndex(f) : null).filter(i => i != null);
  if (trainDataLen != null) indices = indices.filter(i => i < trainDataLen);
  return indices.length > 0 ? indices : null;
}

function setInputImageFromBatch(mode, filename) {
  const canvases = window.modelCanvases;
  if (!canvases?.input || !filename) return;
  const img = new Image();
  img.onload = () => {
    const ctx = canvases.input.getContext('2d');
    ctx.drawImage(img, 0, 0);
  };
  img.src = `/prepared/${mode}/${filename}`;
}

async function trainOneExample() {
  if (isTraining) return;
  const canvases = window.modelCanvases;
  if (!canvases?.w1) {
    if (typeof showToast === 'function') showToast('Сначала инициализируйте модель');
    return;
  }
  const files = typeof getBatchForTraining === 'function' ? getBatchForTraining() : null;
  if (!files || files.length === 0) {
    if (typeof showToast === 'function') showToast('Подгрузите примеры для обучения');
    return;
  }
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const filename = files[0];
  const label = typeof parseFileToLabel === 'function' ? parseFileToLabel(filename) : null;
  if (label == null) {
    if (typeof showToast === 'function') showToast('Неверный формат имени файла');
    return;
  }
  isTraining = true;
  setTrainingState(true);
  if (typeof reportTrainingStart === 'function') reportTrainingStart();
  try {
    const batch = typeof getBatchPixelsFromPage === 'function' ? await getBatchPixelsFromPage([filename], mode) : null;
    const pixels = batch?.[0]?.pixels ?? await getPixelsFromImageUrl(`/prepared/${mode}/${filename}`);
    const out = trainStepFromCanvases(canvases, pixels, label, 0.01);
    if (typeof refreshZoomedCanvases === 'function') refreshZoomedCanvases(canvases);
    if (typeof updateModelVizTable === 'function') updateModelVizTable(label, out);
    const testData = await ensureTestDataForEval();
    const acc = await evaluateFromCanvasesAsync(canvases, testData);
    log(`1 пример — тест: ${(acc * 100).toFixed(2)}% (по ${testData.labels.length} примерам)`);
    await saveCurrentModelVizFromCanvases(canvases, label);
    setInputImageFromBatch(mode, filename);
    if (typeof removeUsedFilesFromBatch === 'function') await removeUsedFilesFromBatch([filename]);
    if (typeof reportTrainingEnd === 'function') await reportTrainingEnd({ type: 'one', mode, samples: 1, accuracy });
  } catch (err) {
    log('Ошибка: ' + err.message, true);
  } finally {
    isTraining = false;
    setTrainingState(false);
  }
}

async function trainBatch(opts = {}) {
  const { skipRemove = false, silent = false } = opts;
  if (isTraining) return;
  const canvases = window.modelCanvases;
  if (!canvases?.w1) {
    if (typeof showToast === 'function') showToast('Сначала инициализируйте модель');
    return;
  }
  const files = typeof getBatchForTraining === 'function' ? getBatchForTraining() : null;
  if (!files || files.length === 0) {
    if (typeof showToast === 'function') showToast('Подгрузите примеры для обучения');
    return;
  }
  const mode = document.querySelector('input[name="mode"]:checked').value;
  isTraining = true;
  if (!silent) setTrainingState(true);
  if (!silent && typeof reportTrainingStart === 'function') reportTrainingStart();
  try {
    const batchData = typeof getBatchPixelsFromPage === 'function' ? await getBatchPixelsFromPage(files, mode) : null;
    if (!batchData || batchData.length === 0) {
      if (typeof showToast === 'function') showToast('Нет валидных примеров в батче');
      return;
    }
    let lastLabel, lastOut;
    for (const { pixels, label } of batchData) {
      lastOut = trainStepFromCanvases(canvases, pixels, label, 0.01);
      lastLabel = label;
    }
    if (typeof refreshZoomedCanvases === 'function') refreshZoomedCanvases(canvases);
    if (typeof updateModelVizTable === 'function' && lastLabel != null) updateModelVizTable(lastLabel, lastOut);
    const testData = await ensureTestDataForEval();
    const acc = await evaluateFromCanvasesAsync(canvases, testData);
    log(`Батч ${batchData.length} — тест: ${(acc * 100).toFixed(2)}% (по ${testData.labels.length} примерам)`);
    await saveCurrentModelVizFromCanvases(canvases, lastLabel);
    setInputImageFromBatch(mode, batchData[0].filename);
    if (!skipRemove && typeof removeUsedFilesFromBatch === 'function') await removeUsedFilesFromBatch(files);
    if (!silent && typeof reportTrainingEnd === 'function') {
      const batchSize = typeof getBatchSize === 'function' ? getBatchSize() : batchData.length;
      await reportTrainingEnd({ type: 'batch', mode, samples: batchData.length, batchSize, accuracy: acc });
    }
  } catch (err) {
    log('Ошибка: ' + err.message, true);
  } finally {
    isTraining = false;
    if (!silent) setTrainingState(false);
  }
}

const AUTO_BATCH_DELAY_MS = 3000;

async function trainBatchesAutonomously() {
  if (isTraining || isAutoTraining) return;
  const canvases = window.modelCanvases;
  if (!canvases?.w1) {
    if (typeof showToast === 'function') showToast('Сначала инициализируйте модель');
    return;
  }
  let totalBatches = typeof getTotalBatches === 'function' ? getTotalBatches() : 0;
  if (totalBatches === 0) {
    if (typeof loadImagesBatch === 'function') {
      await loadImagesBatch();
      totalBatches = typeof getTotalBatches === 'function' ? getTotalBatches() : 0;
    }
  }
  if (totalBatches === 0) {
    if (typeof showToast === 'function') showToast('Нет данных. Нажмите «Приготовить данные» и «Подгрузить картинки»');
    return;
  }

  isAutoTraining = true;
  autoTrainingStopped = false;
  setAutoTrainingState(true);
  const batchAccordion = document.querySelector('.batch-accordion');
  if (batchAccordion) batchAccordion.classList.add('expanded');
  if (document.getElementById('batchNav')) document.getElementById('batchNav').style.display = 'flex';
  if (typeof log === 'function') log(`Автономная тренировка: ${totalBatches} батчей, пауза ${AUTO_BATCH_DELAY_MS / 1000} сек`);
  if (typeof reportTrainingStart === 'function') reportTrainingStart();

  const batchSize = typeof getBatchSize === 'function' ? getBatchSize() : 20;
  let batchesDone = 0;
  let lastAcc = null;

  try {
    for (let i = 0; i < totalBatches; i++) {
      if (autoTrainingStopped) {
        if (typeof log === 'function') log(`Остановлено пользователем после ${i} батчей`);
        break;
      }
      if (typeof showBatchAtIndex === 'function') await showBatchAtIndex(i);
      if (typeof setAutoTrainingProgress === 'function') setAutoTrainingProgress(i + 1, totalBatches);
      await trainBatch({ skipRemove: true, silent: true });
      batchesDone++;
      if (i === totalBatches - 1 || autoTrainingStopped) {
        const testData = await ensureTestDataForEval();
        lastAcc = await evaluateFromCanvasesAsync(canvases, testData);
      }
      if (i < totalBatches - 1 && !autoTrainingStopped) {
        if (typeof log === 'function') log(`Пауза ${AUTO_BATCH_DELAY_MS / 1000} сек...`);
        await new Promise((r) => setTimeout(r, AUTO_BATCH_DELAY_MS));
      }
    }
    if (!autoTrainingStopped && typeof log === 'function') log(`Готово. Обработано ${totalBatches} батчей.`);
    if (typeof reportTrainingEnd === 'function') {
      const mode = document.querySelector('input[name="mode"]:checked')?.value || 'tiny';
      await reportTrainingEnd({
        type: 'batches',
        mode,
        batches: batchesDone,
        samples: batchesDone * batchSize,
        batchSize,
        stopped: autoTrainingStopped,
        accuracy: lastAcc
      });
    }
  } catch (err) {
    if (typeof log === 'function') log('Ошибка: ' + err.message, true);
  } finally {
    isAutoTraining = false;
    setAutoTrainingState(false);
  }
}

function stopAutoTraining() {
  autoTrainingStopped = true;
}

async function trainBatchesAutonomouslyEpochs() {
  if (isTraining || isAutoTraining) return;
  const canvases = window.modelCanvases;
  if (!canvases?.w1) {
    if (typeof showToast === 'function') showToast('Сначала инициализируйте модель');
    return;
  }
  let totalBatches = typeof getTotalBatches === 'function' ? getTotalBatches() : 0;
  if (totalBatches === 0) {
    if (typeof loadImagesBatch === 'function') {
      await loadImagesBatch();
      totalBatches = typeof getTotalBatches === 'function' ? getTotalBatches() : 0;
    }
  }
  if (totalBatches === 0) {
    if (typeof showToast === 'function') showToast('Нет данных. Нажмите «Приготовить данные» и «Подгрузить картинки»');
    return;
  }

  const epochsInput = document.getElementById('epochsCount');
  const epochs = Math.max(1, Math.min(100, parseInt(epochsInput?.value, 10) || 5));

  isAutoTraining = true;
  autoTrainingStopped = false;
  setAutoTrainingState(true);
  const batchAccordion = document.querySelector('.batch-accordion');
  if (batchAccordion) batchAccordion.classList.add('expanded');
  if (document.getElementById('batchNav')) document.getElementById('batchNav').style.display = 'flex';
  if (typeof log === 'function') log(`Автономная тренировка: ${epochs} эпох × ${totalBatches} батчей, пауза ${AUTO_BATCH_DELAY_MS / 1000} сек`);
  if (typeof reportTrainingStart === 'function') reportTrainingStart();

  const batchSize = typeof getBatchSize === 'function' ? getBatchSize() : 20;
  let epochsDone = 0;
  let lastAcc = null;
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'tiny';

  try {
    for (let epoch = 0; epoch < epochs; epoch++) {
      if (autoTrainingStopped) {
        if (typeof log === 'function') log(`Остановлено после эпохи ${epoch}`);
        break;
      }
      if (typeof shuffleImageFiles === 'function') shuffleImageFiles();
      if (typeof log === 'function') log(`Эпоха ${epoch + 1}/${epochs}`);
      for (let i = 0; i < totalBatches; i++) {
        if (autoTrainingStopped) break;
        if (typeof showBatchAtIndex === 'function') await showBatchAtIndex(i);
        if (typeof setAutoTrainingProgress === 'function') setAutoTrainingProgress(i + 1, totalBatches, epoch + 1, epochs);
        await trainBatch({ skipRemove: true, silent: true });
        if (i < totalBatches - 1 && !autoTrainingStopped) {
          await new Promise((r) => setTimeout(r, AUTO_BATCH_DELAY_MS));
        }
      }
      if (typeof evaluateFromCanvasesAsync === 'function' && !autoTrainingStopped) {
        const testData = await ensureTestDataForEval();
        lastAcc = await evaluateFromCanvasesAsync(canvases, testData);
        if (typeof log === 'function') log(`Эпоха ${epoch + 1} — тест: ${(lastAcc * 100).toFixed(2)}%`);
      }
      epochsDone++;
    }
    if (!autoTrainingStopped && typeof log === 'function') log(`Готово. Пройдено ${epochs} эпох.`);
    if (typeof reportTrainingEnd === 'function') {
      await reportTrainingEnd({
        type: 'epochs',
        mode,
        epochs: epochsDone,
        batches: totalBatches,
        samples: epochsDone * totalBatches * batchSize,
        batchSize,
        stopped: autoTrainingStopped,
        accuracy: lastAcc
      });
    }
  } catch (err) {
    if (typeof log === 'function') log('Ошибка: ' + err.message, true);
  } finally {
    isAutoTraining = false;
    setAutoTrainingState(false);
  }
}

async function saveCurrentModelVizFromCanvases(canvases, label) {
  try {
    const viz = exportCanvasesForSnapshot(canvases);
    viz.label = label;
    const res = await fetch('/api/save-model-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viz)
    });
    const data = await res.json();
    if (res.ok && data.snapshot) {
      if (typeof refreshModelVizList === 'function') await refreshModelVizList();
      const sel = document.getElementById('modelVizSelect');
      if (sel) sel.value = 'snapshot_' + data.snapshot;
    }
  } catch (_) {}
}

function runEpoch(model, trainData, lr) {
  const indices = [...Array(trainData.labels.length).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (const idx of indices) {
    model.trainStep(trainData.pixels[idx], trainData.labels[idx], lr);
  }
}

async function startTraining() {
  if (isTraining) return;

  const mode = document.querySelector('input[name="mode"]:checked').value;

  isTraining = true;
  setTrainingState(true);
  resetUI();

  try {
    log(`Загрузка данных (${mode})...`);
    const { trainData, testData } = await loadDataset(mode);
    cachedData = { trainData, testData, mode };
    log(`Загружено: ${trainData.labels.length} train, ${testData.labels.length} test`);

    model = createModel();
    log('Старт обучения (полносвязная 784→512→256→10, ~535k параметров)...');
    setProgress(5);

    const epochs = mode === 'tiny' ? 50 : mode === 'medium' ? 20 : 10;
    const lr = 0.05;

    const sampleIdx = 0;
    const sampleInput = trainData.pixels[sampleIdx];
    const sampleLabel = trainData.labels[sampleIdx];

    for (let e = 0; e < epochs; e++) {
      runEpoch(model, trainData, lr);
      const trainAcc = evaluate(model, trainData);
      const testAcc = evaluate(model, testData);
      const p = 5 + ((e + 1) / epochs) * 90;
      setProgress(p);
      log(`Epoch ${e + 1}/${epochs} — train: ${(trainAcc * 100).toFixed(2)}%, test: ${(testAcc * 100).toFixed(2)}%`);

      try {
        const viz = model.getVizData(sampleInput, sampleLabel);
        viz.weights = model.getWeightsForImage();
        await fetch('/api/save-model-viz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ epoch: e + 1, ...viz })
        });
      } catch (_) {}

      await new Promise((r) => setTimeout(r, 0));
    }

    setProgress(95);
    const acc = evaluate(model, testData);
    setProgress(100);

    log(`Готово. Точность на тесте: ${(acc * 100).toFixed(2)}%`);
    showResults(acc);
    if (typeof refreshModelEpochList === 'function') refreshModelEpochList();
  } catch (err) {
    log('Ошибка: ' + err.message, true);
    setProgress(0);
  } finally {
    isTraining = false;
    setTrainingState(false);
  }
}
