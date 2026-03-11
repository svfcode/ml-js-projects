/**
 * Логика нейросети для сервера (инициализация и forward)
 */

const INPUT = 784, HIDDEN1 = 512, HIDDEN2 = 256, OUTPUT = 10;

function initWeights(rows, cols) {
  const scale = Math.sqrt(2 / (cols - 1));
  const W = [];
  for (let i = 0; i < rows; i++) {
    W[i] = [];
    for (let j = 0; j < cols; j++) {
      W[i][j] = (Math.random() - 0.5) * 2 * scale;
    }
  }
  return W;
}

function relu(x) {
  return x > 0 ? x : 0;
}

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

function forward(W1, W2, W3, input) {
  const x = [...input, 1];
  const a1 = matVec(W1, x).map(relu);
  const a2 = matVec(W2, [...a1, 1]).map(relu);
  const a3 = matVec(W3, [...a2, 1]);
  const out = softmax(a3);
  return { a1, a2, a3, out };
}

function createRandomModel() {
  const W1 = initWeights(HIDDEN1, INPUT + 1);
  const W2 = initWeights(HIDDEN2, HIDDEN1 + 1);
  const W3 = initWeights(OUTPUT, HIDDEN2 + 1);
  return { W1, W2, W3 };
}

function getWeightsForImage(W1, W2, W3) {
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

module.exports = {
  createRandomModel,
  forward,
  getWeightsForImage
};
