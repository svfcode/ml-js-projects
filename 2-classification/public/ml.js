/**
 * Бинарная логистическая регрессия в 2D: P(y=1|x) = σ(w₁·x + w₂·y + b).
 * Точки: { x, y, label } где label ∈ {0, 1}; x,y — признаки на плоскости.
 */
(function (global) {
  "use strict";

  const LOG_EPS = 1e-12;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function sigmoid(z) {
    if (z > 35) return 1;
    if (z < -35) return 0;
    return 1 / (1 + Math.exp(-z));
  }

  function randomWeights() {
    return {
      w1: rand(-0.4, 0.4),
      w2: rand(-0.4, 0.4),
      b: rand(-0.2, 0.2),
    };
  }

  function gauss2(cx, cy, sigma) {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const mag = sigma * Math.sqrt(-2 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    const z1 = mag * Math.sin(2 * Math.PI * v);
    return { x: cx + z0, y: cy + z1 };
  }

  /**
   * @param {number} n всего точек (примерно поровну на класс 0 и 1)
   * @returns {{x:number,y:number,label:0|1}[]}
   */
  function generateSyntheticDataset(n) {
    const n0 = Math.floor(n / 2);
    const n1 = n - n0;
    const points = [];
    for (let i = 0; i < n0; i++) {
      const p = gauss2(-0.48, -0.38, 0.22);
      points.push({ x: p.x, y: p.y, label: 0 });
    }
    for (let i = 0; i < n1; i++) {
      const p = gauss2(0.52, 0.42, 0.22);
      points.push({ x: p.x, y: p.y, label: 1 });
    }
    return points;
  }

  function linearPart(p, w1, w2, b) {
    return w1 * p.x + w2 * p.y + b;
  }

  /** Средняя бинарная кросс-энтропия. */
  function logLoss(points, w1, w2, b) {
    const n = points.length;
    if (!n) return 0;
    let s = 0;
    for (const p of points) {
      const a = sigmoid(linearPart(p, w1, w2, b));
      const y = p.label;
      const t = Math.min(1 - LOG_EPS, Math.max(LOG_EPS, a));
      s += -(y * Math.log(t) + (1 - y) * Math.log(1 - t));
    }
    return s / n;
  }

  /** Доля верных предсказаний при пороге 0.5. */
  function accuracy(points, w1, w2, b) {
    const n = points.length;
    if (!n) return 0;
    let c = 0;
    for (const p of points) {
      const a = sigmoid(linearPart(p, w1, w2, b));
      const pred = a >= 0.5 ? 1 : 0;
      if (pred === p.label) c += 1;
    }
    return c / n;
  }

  /**
   * Градиентный шаг по среднему log-loss.
   * @returns {{ w1: number, w2: number, b: number }}
   */
  function gradientStep(points, w1, w2, b, lr) {
    const n = points.length;
    if (!n) return { w1, w2, b };
    let g1 = 0;
    let g2 = 0;
    let gb = 0;
    for (const p of points) {
      const a = sigmoid(linearPart(p, w1, w2, b));
      const err = a - p.label;
      g1 += err * p.x;
      g2 += err * p.y;
      gb += err;
    }
    const k = 1 / n;
    g1 *= k;
    g2 *= k;
    gb *= k;
    return {
      w1: w1 - lr * g1,
      w2: w2 - lr * g2,
      b: b - lr * gb,
    };
  }

  function fmt(x, digits) {
    const d = digits === undefined ? 6 : digits;
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(d).replace(/\.?0+$/, "") || "0";
  }

  /**
   * Один шаг градиентного спуска + текстовая трассировка (для панели «Лог» в UI).
   */
  function gradientStepTrace(points, w1, w2, b, lr, stepIndex) {
    const n = points.length;
    if (!n) {
      return {
        w1,
        w2,
        b,
        traceText: "Нет точек — LRML.gradientStep не меняет веса.",
      };
    }
    const a1 = w1;
    const a2 = w2;
    const a0 = b;
    const lossBefore = logLoss(points, a1, a2, a0);
    const lines = [];
    lines.push("=== Шаг обучения #" + stepIndex + " (логистическая регрессия, полный батч) ===");
    lines.push(
      "Модель: z = w₁·x₁ + w₂·x₂ + b,  a = σ(z) = P(y=1), см. LRML.sigmoid и LRML.linearPart в ml.js."
    );
    lines.push(
      "До шага: w₁=" +
        fmt(a1, 4) +
        ", w₂=" +
        fmt(a2, 4) +
        ", b=" +
        fmt(a0, 4) +
        ", η=" +
        fmt(lr, 4) +
        "."
    );
    lines.push("LRML.logLoss (средняя кросс-энтропия) до шага = " + fmt(lossBefore, 6) + ".");
    lines.push("");
    lines.push("По каждой точке: z → σ(z)=a → err = a − y_true → вклад в градиент среднего log-loss.");
    let g1 = 0;
    let g2 = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const z = linearPart(p, a1, a2, a0);
      const a = sigmoid(z);
      const err = a - p.label;
      g1 += err * p.x;
      g2 += err * p.y;
      gb += err;
      lines.push(
        "  [" +
          i +
          "] (x₁,x₂)=(" +
          fmt(p.x, 3) +
          "," +
          fmt(p.y, 3) +
          "), y=" +
          p.label +
          " → z=" +
          fmt(z, 4) +
          ", a=" +
          fmt(a, 4) +
          ", err=" +
          fmt(err, 4)
      );
    }
    const k = 1 / n;
    const gw1 = k * g1;
    const gw2 = k * g2;
    const gwb = k * gb;
    const w1n = a1 - lr * gw1;
    const w2n = a2 - lr * gw2;
    const bn = a0 - lr * gwb;
    const lossAfter = logLoss(points, w1n, w2n, bn);
    lines.push("");
    lines.push(
      "Градиент среднего log-loss: ∂L/∂w₁ ≈ (1/n)·Σ err·x₁ = " +
        fmt(gw1, 6) +
        ", аналогично w₂ и b."
    );
    lines.push(
      "Обновление (LRML.gradientStep): w₁ := " +
        fmt(w1n, 4) +
        ", w₂ := " +
        fmt(w2n, 4) +
        ", b := " +
        fmt(bn, 4) +
        "."
    );
    lines.push("LRML.logLoss после шага = " + fmt(lossAfter, 6) + " — точка на графике «Log-loss по шагам».");
    lines.push(
      "LRML.accuracy при пороге 0.5: " +
        fmt(accuracy(points, w1n, w2n, bn) * 100, 2) +
        "% (см. метрику accuracy в интерфейсе)."
    );
    return { w1: w1n, w2: w2n, b: bn, traceText: lines.join("\n") };
  }

  global.LRML = {
    rand,
    randomWeights,
    generateSyntheticDataset,
    sigmoid,
    linearPart,
    logLoss,
    accuracy,
    gradientStep,
    gradientStepTrace,
  };
})(typeof window !== "undefined" ? window : globalThis);
