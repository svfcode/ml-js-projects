/**
 * Минимальное демо: MSE, batch-градиент (логика модели).
 * Точки только вручную: ЛКМ — добавить, ПКМ — удалить ближайшую (в ui.js).
 */
(function () {
  "use strict";

  const Ui = window.LRMinUi;
  if (!Ui) {
    console.error("ui.js должен быть загружен до app.js");
    return;
  }

  const R = (a, b) => a + Math.random() * (b - a); // случайное число в диапазоне [a, b]

  /** Параметры линии ŷ = w·x + b и счётчик шагов обучения. */
  const model = {
    w: R(-0.5, 0.5), // наклон: коэффициент при x, то есть w в уравнении ŷ = w·x + b
    b: R(-0.5, 0.5), // смещение, то есть b в уравнении ŷ = w·x + b
    step: 0, // количество шагов градиента
  };

  /** Границы осей, точки на графике (поля x0…y1 ждёт LRMinUi.initView). */
  const canvas = {
    x0: -1, // левая граница по x
    x1: 10, // правая граница по x
    y0: -1, // нижняя граница по y
    y1: 10, // верхняя граница по y
    points: [], // массив точек { x, y }
  };

  // функция для вычисления среднеквадратичной ошибки (MSE)
  // MSE = 1/n * Σ(e²)
  // где e = ŷ - y, то есть ошибка предсказания на точке
  // которая равна разнице между фактическим и предсказанным значением y
  // является мерой точности модели (то есть метрикой ошибки loss function),
  // то есть насколько близко предсказанные значения находятся к фактическим значениям
  // чем меньше MSE, тем лучше модель
  function mse() {
    const n = canvas.points.length;
    if (!n) return 0;

    let s = 0; // сумма квадратов ошибок
    for (const p of canvas.points) {
      const e = model.w * p.x + model.b - p.y; // ошибка на точке
      s += e * e; // сумма квадратов ошибок
    }

    return s / n; // среднее значение квадратов ошибок
  }

  // функция для выполнения одного шага градиентного спуска
  function oneStep() {
    const n = canvas.points.length;
    const lr = Ui.getLr();

    if (!n || !Number.isFinite(lr) || lr <= 0) return;

    // накапливаем суммы градиентов по w и b, необходимы для вычисления среднего градиента
    // dw = 2/n * Σ(e * x)
    // db = 2/n * Σ(e)
    // где e = ŷ - y, то есть ошибка предсказания на точке
    // которая равна разнице между фактическим и предсказанным значением y
    // потом делим на количество точек n и умножаем на скорость обучения lr
    // необходимы для обновления параметров w и b,
    // чтобы уменьшить ошибку не только числено, но и по направлению к минимуму ошибки
    let dw = 0; // сумма градиентов по w
    let db = 0; // сумма градиентов по b

    for (const p of canvas.points) {
      const e = model.w * p.x + model.b - p.y; // ошибка на точке
      dw += e * p.x; // сумма градиентов по w
      db += e; // сумма градиентов по b
    }
    dw = (2 / n) * dw; // среднее значение градиентов по w
    db = (2 / n) * db; // среднее значение градиентов по b
    model.w -= lr * dw; // обновление параметра w
    model.b -= lr * db; // обновление параметра b
    model.step++; // увеличение счетчика шагов

    Ui.draw();
  }

  Ui.initView({
    getW: function () {
      return model.w;
    },
    getB: function () {
      return model.b;
    },
    getPoints: function () {
      return canvas.points;
    },
    getMse: mse,
    getStep: function () {
      return model.step;
    },
    resetStep: function () {
      model.step = 0;
    },
    ...canvas,
  });

  Ui.bindControls({
    getPointCount: function () {
      return canvas.points.length;
    },
    oneStep: oneStep,
  });

  Ui.draw();
})();
