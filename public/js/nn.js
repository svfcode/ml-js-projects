/**
 * Полносвязная нейронная сеть для MNIST
 * Архитектура: 784 (28×28) → 512 (32×16) → 256 (16×16) → 10
 * ~535k параметров
 */

const NN = {
  /** Размер входа: 28×28 пикселей */
  INPUT: 784,
  /** Первый скрытый слой: 32×16 нейронов */
  HIDDEN1: 512,
  /** Второй скрытый слой: 16×16 нейронов */
  HIDDEN2: 256,
  /** Выход: 10 классов (цифры 0–9) */
  OUTPUT: 10,

  /**
   * Создаёт новую сеть со случайными весами
   * @returns {Object} экземпляр нейросети
   */
  create() {
    const self = Object.create(NN);
    // W1: 512 нейронов × (784 входа + 1 bias) = 401 920
    // W2: 256 нейронов × (512 входа + 1 bias) = 131 328
    // W3: 10 нейронов × (256 входа + 1 bias) = 2 570
    self.W1 = this._initWeights(this.HIDDEN1, this.INPUT + 1);
    self.W2 = this._initWeights(this.HIDDEN2, this.HIDDEN1 + 1);
    self.W3 = this._initWeights(this.OUTPUT, this.HIDDEN2 + 1);
    return self;
  },

  /**
   * Инициализация весов (He для ReLU)
   * @param {number} rows — число нейронов следующего слоя
   * @param {number} cols — число входов + bias
   */
  _initWeights(rows, cols) {
    const scale = Math.sqrt(2 / (cols - 1));
    const W = [];
    for (let i = 0; i < rows; i++) {
      W[i] = [];
      for (let j = 0; j < cols; j++) {
        W[i][j] = (Math.random() - 0.5) * 2 * scale;
      }
    }
    return W;
  },

  /** ReLU: max(0, x) */
  _relu(x) {
    return x > 0 ? x : 0;
  },

  /** Производная ReLU для backprop */
  _reluDeriv(x) {
    return x > 0 ? 1 : 0;
  },

  /**
   * Softmax: преобразует логиты в вероятности (сумма = 1)
   * Вычитание max — численная стабильность
   */
  _softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  },

  /** Добавляет bias-единицу к вектору */
  _addBias(arr) {
    return [...arr, 1];
  },

  /**
   * Прямой проход (forward pass)
   * @param {number[]} input — вектор 784 (нормализованные пиксели 0–1)
   * @returns {{a1, a2, a3, out}} активации слоёв и выход
   */
  forward(input) {
    const x = this._addBias(input);
    const a1 = this._matVec(this.W1, x).map(this._relu);
    const a2 = this._matVec(this.W2, this._addBias(a1)).map(this._relu);
    const a3 = this._matVec(this.W3, this._addBias(a2));
    const out = this._softmax(a3);
    return { a1, a2, a3, out };
  },

  /**
   * Умножение матрицы на вектор
   * @param {number[][]} M — матрица [rows × cols]
   * @param {number[]} v — вектор длины cols
   */
  _matVec(M, v) {
    const out = [];
    for (let i = 0; i < M.length; i++) {
      let sum = 0;
      for (let j = 0; j < v.length; j++) sum += M[i][j] * v[j];
      out.push(sum);
    }
    return out;
  },

  /**
   * Предсказание: возвращает индекс класса с макс. вероятностью
   * @param {number[]} input
   * @returns {number} цифра 0–9
   */
  predict(input) {
    const { out } = this.forward(input);
    let maxIdx = 0;
    for (let i = 1; i < out.length; i++) if (out[i] > out[maxIdx]) maxIdx = i;
    return maxIdx;
  },

  /**
   * Один шаг SGD + backpropagation
   * @param {number[]} input — образец
   * @param {number} label — истинный класс (0–9)
   * @param {number} lr — learning rate
   */
  trainStep(input, label, lr = 0.01) {
    const target = Array(10).fill(0);
    target[label] = 1;

    const x = this._addBias(input);
    const { a1, a2, a3, out } = this.forward(input);
    const a1b = this._addBias(a1);
    const a2b = this._addBias(a2);

    // Градиент по выходу (softmax + cross-entropy)
    const dOut = out.map((o, i) => o - target[i]);

    // Слой 4 → 3: обновление W3 и градиент для a2
    const dA2 = Array(this.HIDDEN2).fill(0);
    for (let j = 0; j < this.OUTPUT; j++) {
      for (let i = 0; i < this.HIDDEN2 + 1; i++) {
        const grad = dOut[j] * a2b[i];
        this.W3[j][i] -= lr * grad;
        if (i < this.HIDDEN2) dA2[i] += dOut[j] * this.W3[j][i];
      }
    }

    // Слой 3 → 2: градиент через ReLU, обновление W2 и градиент для a1
    const dA2Relu = dA2.map((d, i) => d * this._reluDeriv(a2[i]));
    const dA1 = Array(this.HIDDEN1).fill(0);
    for (let j = 0; j < this.HIDDEN2; j++) {
      for (let i = 0; i < this.HIDDEN1 + 1; i++) {
        const grad = dA2Relu[j] * a1b[i];
        this.W2[j][i] -= lr * grad;
        if (i < this.HIDDEN1) dA1[i] += dA2Relu[j] * this.W2[j][i];
      }
    }

    // Слой 2 → 1: градиент через ReLU, обновление W1
    const dA1Relu = dA1.map((d, i) => d * this._reluDeriv(a1[i]));
    for (let j = 0; j < this.HIDDEN1; j++) {
      for (let i = 0; i < this.INPUT + 1; i++) {
        this.W1[j][i] -= lr * dA1Relu[j] * x[i];
      }
    }
  },

  /**
   * Экспорт весов для сервера
   */
  exportWeights() {
    return { W1: this.W1, W2: this.W2, W3: this.W3 };
  },

  /**
   * Данные для визуализации: слои + веса в формате для сервера
   * @param {number[]} input — образец 784 (0–1)
   * @param {number} label — истинная цифра
   */
  getVizData(input, label) {
    const { a1, a2, a3, out } = this.forward(input);
    const inputPixels = input.map(v => Math.round(v * 255));
    const a1Scaled = a1.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
    const a2Scaled = a2.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
    const outScaled = out.map(v => Math.round(v * 255));
    return {
      input: inputPixels,
      layer1: a1Scaled,
      layer2: a2Scaled,
      output: outScaled,
      label,
      weights: this.exportWeights()
    };
  },

  /** Веса как массивы для картинок: 784×513, 512×257, 256×11 (bias в последней строке) */
  getWeightsForImage() {
    const w1Img = [];
    for (let row = 0; row < 784; row++) {
      w1Img[row] = [];
      for (let col = 0; col < 512; col++) w1Img[row][col] = this.W1[col][row];
      w1Img[row][512] = row < 512 ? this.W1[row][784] : this.W1[511][784];
    }
    const w2Img = [];
    for (let row = 0; row < 512; row++) {
      w2Img[row] = [];
      for (let col = 0; col < 256; col++) w2Img[row][col] = this.W2[col][row];
      w2Img[row][256] = row < 256 ? this.W2[row][512] : this.W2[255][512];
    }
    const w3Img = [];
    for (let row = 0; row < 256; row++) {
      w3Img[row] = [];
      for (let col = 0; col < 10; col++) w3Img[row][col] = this.W3[col][row];
      w3Img[row][10] = row < 10 ? this.W3[row][256] : this.W3[9][256];
    }
    return { w1: w1Img, w2: w2Img, w3: w3Img };
  }
};
