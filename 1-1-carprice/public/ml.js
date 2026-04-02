/**
 * Линейная регрессия ŷ = w·x + b: данные, MSE, шаг градиентного спуска.
 * Без DOM — только числа и массивы точек { x, y }.
 */
(function (global) {
  "use strict";

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function randomWeights() {
    // Старт ближе к авто-кейсу: отрицательный наклон и положительный базовый уровень цены.
    return { w: rand(-0.12, -0.01), b: rand(2.0, 4.8) };
  }

  /**
   * Генерирует синтетический датасет:
   * x — пробег в десятках тысяч км (например, 12 => 120 000 км),
   * y — цена в млн рублей.
   */
  function generateSyntheticDataset(n) {
    // У подержанных авто обычно: больше пробег => ниже цена (отрицательный наклон).
    const trueW = -rand(0.07, 0.12);
    const trueB = rand(3.2, 4.2);
    const points = [];
    for (let i = 0; i < n; i++) {
      const x = rand(0.5, 30);
      const noise = rand(-0.25, 0.25);
      points.push({ x, y: trueW * x + trueB + noise });
    }
    return points;
  }

  /** @param {{x:number,y:number}[]} points */
  function mse(points, w, b) {
    const n = points.length;
    if (!n) return 0;
    let s = 0;
    for (const p of points) {
      const err = w * p.x + b - p.y;
      s += err * err;
    }
    return s / n;
  }

  /**
   * Делает один полный (batch) шаг градиентного спуска для линейной модели `y = w*x + b`.
   *
   * Что происходит внутри:
   * 1) Для каждой точки считаем предсказание `pred = w*x + b` и ошибку `err = pred - y`.
   * 2) Накапливаем суммы для производных по MSE:
   *    - `dw += err * x`  (вклад в градиент по весу `w`)
   *    - `db += err`      (вклад в градиент по смещению `b`)
   * 3) Приводим суммы к среднему градиенту MSE множителем `(2 / n)`:
   *    - `dw = (2/n) * Σ(err*x)`
   *    - `db = (2/n) * Σ(err)`
   * 4) Обновляем параметры:
   *    - `w_new = w - lr * dw`
   *    - `b_new = b - lr * db`
   *
   * Важно: если точек нет (`n = 0`), функция возвращает исходные `w` и `b`.
   *
   * @param {{x:number,y:number}[]} points Набор обучающих точек.
   * @param {number} w Текущий вес (наклон прямой).
   * @param {number} b Текущее смещение (сдвиг по оси y).
   * @param {number} lr Скорость обучения (learning rate, η).
   * @returns {{ w: number, b: number }} Новые параметры после одного шага.
   */
  function gradientStep(points, w, b, lr) {
    const n = points.length;
    if (!n) return { w, b };

    let dw = 0;
    let db = 0;

    for (const p of points) {
      // Текущее предсказание модели для точки p.
      const pred = w * p.x + b;
      // Ошибка: насколько предсказание выше/ниже реального y.
      const err = pred - p.y;
      // Накопление частных производных до нормировки на n.
      dw += err * p.x;
      db += err;
    }
    // Переход от сумм к среднему градиенту MSE.
    dw = (2 / n) * dw;
    db = (2 / n) * db;
    // Шаг антиградиента: двигаем параметры в сторону уменьшения ошибки.
    return { w: w - lr * dw, b: b - lr * db };
  }

  function fmt(x, digits) {
    const d = digits === undefined ? 6 : digits;
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(d).replace(/\.?0+$/, "") || "0";
  }

  /**
   * Тот же шаг, что gradientStep, плюс многострочное описание вызовов и чисел (для лога UI).
   * @param {number} stepIndex — номер шага (1-based для отображения)
   * @returns {{ w: number, b: number, dw: number, db: number, traceText: string }}
   */
  function gradientStepTrace(points, w, b, lr, stepIndex) {
    const n = points.length;
    if (!n) {
      return {
        w,
        b,
        dw: 0,
        db: 0,
        traceText:
          "Точек нет — LRML.gradientStep(points, w, b, lr) сразу возвращает { w, b } без изменений.",
      };
    }
    const w0 = w;
    const b0 = b;
    const mseBefore = mse(points, w0, b0);
    const lines = [];
    lines.push("=== Шаг обучения #" + stepIndex + " (полный батч: все точки за один вызов) ===");
    lines.push(
      "Вход в LRML.gradientStep(points, w, b, lr): было w=" +
        fmt(w0, 4) +
        ", b=" +
        fmt(b0, 4) +
        ", η=" +
        fmt(lr, 6) +
        "."
    );
    lines.push(
      "Перед циклом: LRML.mse(points, w, b) = " + fmt(mseBefore, 6) + " (средний квадрат ошибки при старых w, b)."
    );
    lines.push("");
    lines.push("Внутри gradientStep — по очереди каждая точка из points:");
    let sumErrX = 0;
    let sumErr = 0;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const pred = w0 * p.x + b0;
      const err = pred - p.y;
      const termX = err * p.x;
      sumErrX += termX;
      sumErr += err;
      lines.push(
        "  [" +
          i +
          "] Точка { x: " +
          fmt(p.x, 4) +
          ", y: " +
          fmt(p.y, 4) +
          " } → pred = w·x+b = " +
          fmt(pred, 4) +
          ", err = pred−y = " +
          fmt(err, 4) +
          " → к сумме: err·x = " +
          fmt(termX, 4) +
          ", err = " +
          fmt(err, 4)
      );
    }
    const dw = (2 / n) * sumErrX;
    const db = (2 / n) * sumErr;
    const w1 = w0 - lr * dw;
    const b1 = b0 - lr * db;
    const mseAfter = mse(points, w1, b1);
    lines.push("");
    lines.push("После прохода по n=" + n + " точкам: Σ(err·x) = " + fmt(sumErrX, 6) + ", Σ(err) = " + fmt(sumErr, 6) + ".");
    lines.push(
      "Градиент MSE: dw = (2/n)·Σ(err·x) = " + fmt(dw, 6) + ", db = (2/n)·Σ(err) = " + fmt(db, 6) + "."
    );
    lines.push(
      "Обновление весов (в конце gradientStep): w := w − η·dw = " +
        fmt(w0, 4) +
        " − " +
        fmt(lr, 6) +
        "×" +
        fmt(dw, 6) +
        " = " +
        fmt(w1, 4) +
        "; b := b − η·db = " +
        fmt(b0, 4) +
        " − " +
        fmt(lr, 6) +
        "×" +
        fmt(db, 6) +
        " = " +
        fmt(b1, 4) +
        "."
    );
    lines.push("Выход из LRML.gradientStep: { w: " + fmt(w1, 4) + ", b: " + fmt(b1, 4) + " }.");
    lines.push(
      "Затем в LRLOGIC.runSteps вызывается LRML.mse(points, новые w, b) = " +
        fmt(mseAfter, 6) +
        " — это значение попадает в lossHistory."
    );
    return { w: w1, b: b1, dw, db, traceText: lines.join("\n") };
  }

  global.LRML = {
    rand,
    randomWeights,
    generateSyntheticDataset,
    mse,
    gradientStep,
    gradientStepTrace,
  };
})(typeof window !== "undefined" ? window : globalThis);
