/**
 * Линейная регрессия с двумя признаками: ŷ = w₁·x + w₂·v + b.
 * x — пробег (десятки тыс. км), v — объём двигателя (л), y — цена (млн руб.).
 * Точки: { x, v, y }.
 */
(function (global) {
  "use strict";

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function predict(p, w1, w2, b) {
    return w1 * p.x + w2 * p.v + b;
  }

  function randomWeights() {
    return {
      w1: rand(-0.12, -0.02),
      w2: rand(0.05, 0.35),
      b: rand(2.0, 4.5),
    };
  }

  /** @param {number} n */
  function generateSyntheticDataset(n) {
    const trueW1 = -rand(0.06, 0.11);
    const trueW2 = rand(0.12, 0.42);
    const trueB = rand(2.4, 3.9);
    const points = [];
    for (let i = 0; i < n; i++) {
      const x = rand(0.5, 30);
      const v = rand(1.0, 3.5);
      const noise = rand(-0.22, 0.22);
      points.push({ x, v, y: trueW1 * x + trueW2 * v + trueB + noise });
    }
    return points;
  }

  /** @param {{x:number,v:number,y:number}[]} points */
  function mse(points, w1, w2, b) {
    const n = points.length;
    if (!n) return 0;
    let s = 0;
    for (const p of points) {
      const err = predict(p, w1, w2, b) - p.y;
      s += err * err;
    }
    return s / n;
  }

  /**
   * Один batch-шаг градиентного спуска по MSE.
   * @returns {{ w1: number, w2: number, b: number }}
   */
  function gradientStep(points, w1, w2, b, lr) {
    const n = points.length;
    if (!n) return { w1, w2, b };
    let dw1 = 0;
    let dw2 = 0;
    let db = 0;
    for (const p of points) {
      const err = predict(p, w1, w2, b) - p.y;
      dw1 += err * p.x;
      dw2 += err * p.v;
      db += err;
    }
    const k = 2 / n;
    dw1 *= k;
    dw2 *= k;
    db *= k;
    return {
      w1: w1 - lr * dw1,
      w2: w2 - lr * dw2,
      b: b - lr * db,
    };
  }

  function fmt(x, digits) {
    const d = digits === undefined ? 6 : digits;
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(d).replace(/\.?0+$/, "") || "0";
  }

  /**
   * Шаг + текстовая трассировка для UI.
   * @returns {{ w1: number, w2: number, b: number, traceText: string }}
   */
  function gradientStepTrace(points, w1, w2, b, lr, stepIndex) {
    const n = points.length;
    if (!n) {
      return {
        w1,
        w2,
        b,
        traceText:
          "Точек нет — LRML.gradientStep(points, w1, w2, b, lr) сразу возвращает исходные веса.",
      };
    }
    const a1 = w1;
    const a2 = w2;
    const a0 = b;
    const mseBefore = mse(points, a1, a2, a0);
    const lines = [];
    lines.push("=== Шаг обучения #" + stepIndex + " (полный батч, 2 признака) ===");
    lines.push(
      "Модель: ŷ = w₁·x + w₂·v + b (x — пробег, v — объём двигателя, л)."
    );
    lines.push(
      "Вход: w₁=" +
        fmt(a1, 4) +
        ", w₂=" +
        fmt(a2, 4) +
        ", b=" +
        fmt(a0, 4) +
        ", η=" +
        fmt(lr, 6) +
        "."
    );
    lines.push("LRML.mse до шага = " + fmt(mseBefore, 6) + ".");
    lines.push("");
    lines.push("По каждой точке: pred = w₁·x + w₂·v + b, err = pred − y.");
    let s1 = 0;
    let s2 = 0;
    let se = 0;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const pred = predict(p, a1, a2, a0);
      const err = pred - p.y;
      s1 += err * p.x;
      s2 += err * p.v;
      se += err;
      lines.push(
        "  [" +
          i +
          "] { x:" +
          fmt(p.x, 2) +
          ", v:" +
          fmt(p.v, 2) +
          ", y:" +
          fmt(p.y, 3) +
          " } → pred=" +
          fmt(pred, 3) +
          ", err=" +
          fmt(err, 3)
      );
    }
    const k = 2 / n;
    const dw1 = k * s1;
    const dw2 = k * s2;
    const db = k * se;
    const w1n = a1 - lr * dw1;
    const w2n = a2 - lr * dw2;
    const bn = a0 - lr * db;
    const mseAfter = mse(points, w1n, w2n, bn);
    lines.push("");
    lines.push(
      "dw₁=(2/n)·Σ(err·x)=" +
        fmt(dw1, 6) +
        ", dw₂=(2/n)·Σ(err·v)=" +
        fmt(dw2, 6) +
        ", db=(2/n)·Σ(err)=" +
        fmt(db, 6) +
        "."
    );
    lines.push(
      "w₁:=" +
        fmt(a1, 4) +
        "−η·dw₁=" +
        fmt(w1n, 4) +
        "; w₂:=" +
        fmt(a2, 4) +
        "−η·dw₂=" +
        fmt(w2n, 4) +
        "; b:=" +
        fmt(a0, 4) +
        "−η·db=" +
        fmt(bn, 4) +
        "."
    );
    lines.push("LRML.mse после шага = " + fmt(mseAfter, 6) + " (в lossHistory).");
    return { w1: w1n, w2: w2n, b: bn, traceText: lines.join("\n") };
  }

  global.LRML = {
    rand,
    randomWeights,
    generateSyntheticDataset,
    predict,
    mse,
    gradientStep,
    gradientStepTrace,
  };
})(typeof window !== "undefined" ? window : globalThis);
