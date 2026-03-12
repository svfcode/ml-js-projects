/**
 * Обучение «прямо на картинке»: читаем веса и активации из canvas, считаем, записываем обратно.
 */

const INPUT = 784, HIDDEN1 = 512, HIDDEN2 = 256, OUTPUT = 10;

function pixelToWeight(p) {
  return (p / 255) * 2 - 1;
}

function weightToPixel(w) {
  return Math.max(0, Math.min(255, Math.round((w + 1) / 2 * 255)));
}

function pixelToActivation(p) {
  return p / 255;
}

function activationToPixel(a) {
  return Math.max(0, Math.min(255, Math.round(Math.min(1, Math.max(0, a)) * 255)));
}

function relu(x) { return x > 0 ? x : 0; }
function reluDeriv(x) { return x > 0 ? 1 : 0; }

function softmax(arr) {
  const max = Math.max(...arr);
  const exp = arr.map(x => Math.exp(x - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(x => x / sum);
}

function matVec(M, v) {
  const out = [];
  for (let i = 0; i < M.length; i++) {
    let sum = 0;
    for (let j = 0; j < v.length; j++) sum += M[i][j] * v[j];
    out.push(sum);
  }
  return out;
}

/** Читает W1 из ImageData (784×513): строка j = веса нейрона j, строка 512 = bias */
function readW1FromImageData(data) {
  const W1 = [];
  for (let j = 0; j < 512; j++) {
    W1[j] = [];
    for (let i = 0; i < 784; i++) {
      const idx = (j * 784 + i) * 4;
      W1[j][i] = pixelToWeight(data.data[idx]);
    }
    W1[j][784] = pixelToWeight(data.data[(512 * 784 + j) * 4]);
  }
  return W1;
}

/** Читает W2 из ImageData (512×257) */
function readW2FromImageData(data) {
  const W2 = [];
  for (let j = 0; j < 256; j++) {
    W2[j] = [];
    for (let i = 0; i < 512; i++) {
      const idx = (j * 512 + i) * 4;
      W2[j][i] = pixelToWeight(data.data[idx]);
    }
    W2[j][512] = pixelToWeight(data.data[(256 * 512 + j) * 4]);
  }
  return W2;
}

/** Читает W3 из ImageData (256×11) */
function readW3FromImageData(data) {
  const W3 = [];
  for (let j = 0; j < 10; j++) {
    W3[j] = [];
    for (let i = 0; i < 256; i++) {
      const idx = (j * 256 + i) * 4;
      W3[j][i] = pixelToWeight(data.data[idx]);
    }
    W3[j][256] = pixelToWeight(data.data[(10 * 256 + j) * 4]);
  }
  return W3;
}

/** Пишет W1 в ImageData (784×513): строка 512 = bias каждого нейрона */
function writeW1ToImageData(W1, data) {
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 784; i++) {
      const idx = (j * 784 + i) * 4;
      const p = weightToPixel(W1[j][i]);
      data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
      data.data[idx + 3] = 255;
    }
  }
  for (let j = 0; j < 512; j++) {
    const idx = (512 * 784 + j) * 4;
    const p = weightToPixel(W1[j][784]);
    data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
    data.data[idx + 3] = 255;
  }
}

function writeW2ToImageData(W2, data) {
  for (let j = 0; j < 256; j++) {
    for (let i = 0; i < 512; i++) {
      const idx = (j * 512 + i) * 4;
      const p = weightToPixel(W2[j][i]);
      data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
      data.data[idx + 3] = 255;
    }
  }
  for (let j = 0; j < 256; j++) {
    const idx = (256 * 512 + j) * 4;
    const p = weightToPixel(W2[j][512]);
    data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
    data.data[idx + 3] = 255;
  }
}

function writeW3ToImageData(W3, data) {
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 256; i++) {
      const idx = (j * 256 + i) * 4;
      const p = weightToPixel(W3[j][i]);
      data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
      data.data[idx + 3] = 255;
    }
  }
  for (let j = 0; j < 10; j++) {
    const idx = (10 * 256 + j) * 4;
    const p = weightToPixel(W3[j][256]);
    data.data[idx] = data.data[idx + 1] = data.data[idx + 2] = p;
    data.data[idx + 3] = 255;
  }
}

/** Пишет input (784) в canvas 28×28 */
function writeInputToCanvas(ctx, input) {
  const imgData = ctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const p = activationToPixel(input[i]);
    const idx = i * 4;
    imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = p;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Пишет a1 (512) в canvas 32×16 */
function writeLayer1ToCanvas(ctx, a1) {
  const imgData = ctx.createImageData(32, 16);
  for (let i = 0; i < 512; i++) {
    const p = activationToPixel(a1[i]);
    const idx = i * 4;
    imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = p;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Пишет a2 (256) в canvas 16×16 */
function writeLayer2ToCanvas(ctx, a2) {
  const imgData = ctx.createImageData(16, 16);
  for (let i = 0; i < 256; i++) {
    const p = activationToPixel(a2[i]);
    const idx = i * 4;
    imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = p;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Пишет out (10) в canvas 10×1 */
function writeOutputToCanvas(ctx, out) {
  const imgData = ctx.createImageData(10, 1);
  for (let i = 0; i < 10; i++) {
    const p = activationToPixel(out[i]);
    const idx = i * 4;
    imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = p;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Один шаг обучения: читает из canvas, forward+backward, записывает обратно.
 * @param {Object} canvases - { input, layer1, layer2, output, w1, w2, w3 } (canvas elements)
 * @param {number[]} input - вход 784 (0-1)
 * @param {number} label - метка 0-9
 * @param {number} lr
 */
function trainStepFromCanvases(canvases, input, label, lr) {
  const ctxW1 = canvases.w1.getContext('2d');
  const ctxW2 = canvases.w2.getContext('2d');
  const ctxW3 = canvases.w3.getContext('2d');
  const ctxL1 = canvases.layer1.getContext('2d');
  const ctxL2 = canvases.layer2.getContext('2d');
  const ctxOut = canvases.output.getContext('2d');
  const ctxIn = canvases.input.getContext('2d');

  // 1) Записываем вход
  writeInputToCanvas(ctxIn, input);

  // 2) Читаем веса
  const imgW1 = ctxW1.getImageData(0, 0, 784, 513);
  const imgW2 = ctxW2.getImageData(0, 0, 512, 257);
  const imgW3 = ctxW3.getImageData(0, 0, 256, 11);

  const W1 = readW1FromImageData(imgW1);
  const W2 = readW2FromImageData(imgW2);
  const W3 = readW3FromImageData(imgW3);

  // 3) Forward
  const x = [...input, 1];
  const a1 = matVec(W1, x).map(relu);
  const a1b = [...a1, 1];
  const a2 = matVec(W2, a1b).map(relu);
  const a2b = [...a2, 1];
  const a3 = matVec(W3, a2b);
  const out = softmax(a3);

  // 4) Записываем активации на картинки
  writeLayer1ToCanvas(ctxL1, a1);
  writeLayer2ToCanvas(ctxL2, a2);
  writeOutputToCanvas(ctxOut, out);

  // 5) Backpropagation
  const target = Array(10).fill(0);
  target[label] = 1;

  const dOut = out.map((o, i) => o - target[i]);

  const dA2 = Array(256).fill(0);
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 257; i++) {
      const grad = dOut[j] * a2b[i];
      W3[j][i] -= lr * grad;
      if (i < 256) dA2[i] += dOut[j] * W3[j][i];
    }
  }

  const dA2Relu = dA2.map((d, i) => d * reluDeriv(a2[i]));
  const dA1 = Array(512).fill(0);
  for (let j = 0; j < 256; j++) {
    for (let i = 0; i < 513; i++) {
      const grad = dA2Relu[j] * a1b[i];
      W2[j][i] -= lr * grad;
      if (i < 512) dA1[i] += dA2Relu[j] * W2[j][i];
    }
  }

  const dA1Relu = dA1.map((d, i) => d * reluDeriv(a1[i]));
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 785; i++) {
      W1[j][i] -= lr * dA1Relu[j] * x[i];
    }
  }

  // 6) Записываем обновлённые веса обратно на картинки
  writeW1ToImageData(W1, imgW1);
  writeW2ToImageData(W2, imgW2);
  writeW3ToImageData(W3, imgW3);
  ctxW1.putImageData(imgW1, 0, 0);
  ctxW2.putImageData(imgW2, 0, 0);
  ctxW3.putImageData(imgW3, 0, 0);

  return out;
}

/**
 * Экспорт состояния canvas для сохранения слепка на сервер.
 * @returns {{ input, layer1, layer2, output, weights }}
 */
function exportCanvasesForSnapshot(canvases) {
  const ctx = (c) => c.getContext('2d');
  const dataIn = ctx(canvases.input).getImageData(0, 0, 28, 28);
  const dataL1 = ctx(canvases.layer1).getImageData(0, 0, 32, 16);
  const dataL2 = ctx(canvases.layer2).getImageData(0, 0, 16, 16);
  const dataOut = ctx(canvases.output).getImageData(0, 0, 10, 1);
  const dataW1 = ctx(canvases.w1).getImageData(0, 0, 784, 513);
  const dataW2 = ctx(canvases.w2).getImageData(0, 0, 512, 257);
  const dataW3 = ctx(canvases.w3).getImageData(0, 0, 256, 11);

  const input = [];
  for (let i = 0; i < 784; i++) input.push(dataIn.data[i * 4]);
  const layer1 = [];
  for (let i = 0; i < 512; i++) layer1.push(dataL1.data[i * 4]);
  const layer2 = [];
  for (let i = 0; i < 256; i++) layer2.push(dataL2.data[i * 4]);
  const output = [];
  for (let i = 0; i < 10; i++) output.push(dataOut.data[i * 4]);

  const W1 = readW1FromImageData(dataW1);
  const W2 = readW2FromImageData(dataW2);
  const W3 = readW3FromImageData(dataW3);
  const weights = getWeightsForImageFromArrays(W1, W2, W3);

  return { input, layer1, layer2, output, weights };
}

/** Веса в формате getWeightsForImage (сырые float для сервера) */
function getWeightsForImageFromArrays(W1, W2, W3) {
  const w1Img = [];
  for (let row = 0; row < 784; row++) {
    w1Img[row] = [];
    for (let col = 0; col < 512; col++) w1Img[row][col] = W1[col][row];
    w1Img[row][512] = row < 512 ? W1[row][784] : W1[511][784];
  }
  const w2Img = [];
  for (let row = 0; row < 512; row++) {
    w2Img[row] = [];
    for (let col = 0; col < 256; col++) w2Img[row][col] = W2[col][row];
    w2Img[row][256] = row < 256 ? W2[row][512] : W2[255][512];
  }
  const w3Img = [];
  for (let row = 0; row < 256; row++) {
    w3Img[row] = [];
    for (let col = 0; col < 10; col++) w3Img[row][col] = W3[col][row];
    w3Img[row][10] = row < 10 ? W3[row][256] : W3[9][256];
  }
  return { w1: w1Img, w2: w2Img, w3: w3Img };
}

/** Читает веса из canvas один раз (для переиспользования) */
function readWeightsFromCanvases(canvases) {
  const ctxW1 = canvases.w1.getContext('2d');
  const ctxW2 = canvases.w2.getContext('2d');
  const ctxW3 = canvases.w3.getContext('2d');
  return {
    W1: readW1FromImageData(ctxW1.getImageData(0, 0, 784, 513)),
    W2: readW2FromImageData(ctxW2.getImageData(0, 0, 512, 257)),
    W3: readW3FromImageData(ctxW3.getImageData(0, 0, 256, 11))
  };
}

/** Прямой проход по уже прочитанным весам */
function forwardFromWeights(W1, W2, W3, input) {
  const x = [...input, 1];
  const a1 = matVec(W1, x).map(relu);
  const a2 = matVec(W2, [...a1, 1]).map(relu);
  const a3 = matVec(W3, [...a2, 1]);
  return softmax(a3);
}

/** Прямой проход: вход → вероятности (0-9) */
function forwardFromCanvases(canvases, input) {
  const { W1, W2, W3 } = readWeightsFromCanvases(canvases);
  return forwardFromWeights(W1, W2, W3, input);
}

/** Предсказание по текущим весам в canvas */
function predictFromCanvases(canvases, input) {
  const out = forwardFromCanvases(canvases, input);
  let maxIdx = 0;
  for (let i = 1; i < 10; i++) if (out[i] > out[maxIdx]) maxIdx = i;
  return maxIdx;
}

/** Точность на датасете по весам в canvas */
function evaluateFromCanvases(canvases, data) {
  if (!data || !data.labels || !data.pixels || data.labels.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < data.labels.length; i++) {
    if (predictFromCanvases(canvases, data.pixels[i]) === data.labels[i]) correct++;
  }
  return correct / data.labels.length;
}

const EVAL_CHUNK = 200;

/** Асинхронная оценка: веса читаются один раз, память не раздувается */
async function evaluateFromCanvasesAsync(canvases, data) {
  if (!data || !data.labels || !data.pixels || data.labels.length === 0) return 0;
  const { W1, W2, W3 } = readWeightsFromCanvases(canvases);
  let correct = 0;
  for (let i = 0; i < data.labels.length; i += EVAL_CHUNK) {
    const end = Math.min(i + EVAL_CHUNK, data.labels.length);
    for (let j = i; j < end; j++) {
      const out = forwardFromWeights(W1, W2, W3, data.pixels[j]);
      let maxIdx = 0;
      for (let k = 1; k < 10; k++) if (out[k] > out[maxIdx]) maxIdx = k;
      if (maxIdx === data.labels[j]) correct++;
    }
    await new Promise(r => setTimeout(r, 0));
  }
  return correct / data.labels.length;
}
