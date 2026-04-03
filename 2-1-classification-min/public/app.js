/**
 * Минимальное демо: бинарная классификация в 2D.
 * P(y=1 | x) = σ(w₁·x₁ + w₂·x₂ + b), точки двух классов.
 * σ(...) — сигмоида: преобразует z = w₁·x₁ + w₂·x₂ + b в вероятность из диапазона [0, 1].
 * P(y=1 | x) — вероятность того, что точка с признаками x относится к классу 1.
 * 
 * w₁·x₁ + w₂·x₂ + b — линейная комбинация признаков (linear combination of features):
 * w₁, w₂ — веса (наклоны влияния координат), b — смещение (bias).
 * 
 * “точки двух классов” означает, что каждая добавленная точка имеет метку label:
 * label = 0 (класс 0) или label = 1 (класс 1); точки рисуются разными цветами.
 * label - это метка класса, то есть то, к какому классу относится точка,
 * 
 * При обучении шагами подбираются w₁, w₂, b, чтобы log-loss (кросс-энтропия) уменьшалась.
 * x = (x₁, x₂) — координаты точки на плоскости; w₁, w₂ — веса, b — смещение.
 * 
 * ЛКМ — добавить точку выбранного класса, ПКМ — удалить ближайшую.
 */
(function () {
  "use strict";

  const Ui = window.CLFMinUi;
  if (!Ui) {
    console.error("ui.js должен быть загружен до app.js");
    return;
  }

  // сигмоида - это функция, которая преобразует z в вероятность из диапазона [0, 1]
  function sigmoid(z) {
    if (z > 35) return 1; // объяснение клипинга (clipping) на странице doc-sigmoid.html
    if (z < -35) return 0;
    return 1 / (1 + Math.exp(-z));
  }

  // модель - это параметры w1, w2, b, которые определяют линейную границу решения
  // w1, w2 - веса, b - смещение
  // w1, w2 - наклоны влияния координат (weights of features), b - смещение (bias)
  // w1, w2, b - параметры модели, которые определяют линейную границу решения (linear decision boundary)
  const model = {
    w1: Math.random() * 0.8 - 0.4, // случайный вес w1 в диапазоне [-0.4, 0.4]
    w2: Math.random() * 0.8 - 0.4, // случайный вес w2 в диапазоне [-0.4, 0.4]
    b: Math.random() * 0.4 - 0.2, // случайный смещение b в диапазоне [-0.2, 0.2]
    step: 0, // количество шагов обучения
  };

  // канвас - это область на плоскости, в которой рисуются точки
  // x0, x1 - границы осей x
  // y0, y1 - границы осей y
  // points - массив точек { x, y, label }
  const canvas = {
    x0: -1,
    x1: 10,
    y0: -1,
    y1: 10,
    points: /** @type {{ x:number, y:number, label:0|1 }[]} */ ([]),
  };

  // функция для вычисления средней бинарной кросс-энтропии (log-loss)
  function logLoss() {
    const pts = canvas.points;
    const n = pts.length;
    if (!n) return 0;
    const { w1, w2, b } = model;
    let s = 0;
    for (const p of pts) {
      const z = w1 * p.x + w2 * p.y + b;
      const a = sigmoid(z);
      const y = p.label;
      const t = Math.min(1 - 1e-12, Math.max(1e-12, a));
      s += -(y * Math.log(t) + (1 - y) * Math.log(1 - t));
    }
    return s / n;
  }

  // метрика точности (accuracy) - это доля правильных предсказаний = количество правильных предсказаний / общее количество предсказаний
  function accuracy() {
    const pts = canvas.points;
    const n = pts.length;
    if (!n) return 0;

    const { w1, w2, b } = model; // параметры модели
    let c = 0; // количество правильных предсказаний

    for (const p of pts) {
      const z = w1 * p.x + w2 * p.y + b; // линейная комбинация признаков (linear combination of features)
      const a = sigmoid(z); // сигмоида (sigmoid)
      const pred = a >= 0.5 ? 1 : 0; // предсказание класса (prediction of class)
      if (pred === p.label) c++; // если предсказание совпадает с меткой класса, то увеличиваем счетчик правильных предсказаний
    }

    return c / n; // возвращаем долю правильных предсказаний
  }

  // функция для выполнения одного шага обучения
  function oneStep() {
    const pts = canvas.points;
    const n = pts.length;
    const v = parseFloat(document.getElementById("lr").value);
    const lr = Number.isFinite(v) && v > 0 ? v : NaN;
    if (!n || !Number.isFinite(lr) || lr <= 0) return;

    let g1 = 0; // сумма градиентов по w1
    let g2 = 0; // сумма градиентов по w2
    let gb = 0; // сумма градиентов по b
    const { w1, w2, b } = model; // параметры модели

    // накапливаем сумму ошибок по всем точкам
    for (const p of pts) {
      const z = w1 * p.x + w2 * p.y + b; // линейная комбинация признаков (linear combination of features)
      const a = sigmoid(z); // сигмоида (sigmoid)
      const err = a - p.label; // ошибка на точке (error on point) = предсказание - метка класса
      g1 += err * p.x; // сумма градиентов по w1
      g2 += err * p.y; // сумма градиентов по w2
      gb += err; // сумма градиентов по b
    }

    const k = 1 / n; // чтобы получить среднее значение градиентов, умножаем на 1/n

    // приводим суммы к среднему значению градиентов
    g1 *= k;
    g2 *= k;
    gb *= k;

    // обновляем параметры модели
    model.w1 = w1 - lr * g1; // обновление параметра w1
    model.w2 = w2 - lr * g2; // обновление параметра w2
    model.b = b - lr * gb; // обновление параметра b

    model.step++; // увеличение счетчика шагов

    Ui.draw();
  }

  Ui.init({
    getModel: function () {
      return { w1: model.w1, w2: model.w2, b: model.b, step: model.step };
    },
    getCanvas: function () {
      return canvas;
    },
    logLoss,
    accuracy,
    oneStep,
    resetStep: function () {
      model.step = 0;
    },
  });
})();

