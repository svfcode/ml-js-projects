/**
 * Состояние обучения: двухпризнаковая линейная регрессия (пробег + объём).
 */
(function (global) {
  "use strict";

  const LRML = global.LRML;
  if (!LRML) {
    console.error("LRML должен быть загружен до logic.js");
    return;
  }

  const MAX_MANUAL_POINTS = 200;

  let points = [];
  let w1 = 0;
  let w2 = 0;
  let b = 0;
  let lossHistory = [];
  let step = 0;
  let lastStepTraceText = null;

  function resetTrainingOnly() {
    lossHistory = [];
    step = 0;
    lastStepTraceText = null;
  }

  function generateSynthetic(n) {
    points = LRML.generateSyntheticDataset(n);
    const wb = LRML.randomWeights();
    w1 = wb.w1;
    w2 = wb.w2;
    b = wb.b;
    resetTrainingOnly();
  }

  function clearForManualMode() {
    points = [];
    const wb = LRML.randomWeights();
    w1 = wb.w1;
    w2 = wb.w2;
    b = wb.b;
    resetTrainingOnly();
  }

  function resetAfterDatasetEdit() {
    resetTrainingOnly();
  }

  function runSteps(n, lr) {
    if (!points.length || n < 1) return;
    for (let i = 0; i < n; i++) {
      const traced = LRML.gradientStepTrace(points, w1, w2, b, lr, step + 1);
      w1 = traced.w1;
      w2 = traced.w2;
      b = traced.b;
      step += 1;
      lossHistory.push(LRML.mse(points, w1, w2, b));
      lastStepTraceText = traced.traceText;
    }
  }

  function getStepLogText() {
    if (lastStepTraceText != null) return lastStepTraceText;
    if (!points.length) {
      return "Нет точек — LRLOGIC.runSteps не вызывает градиентный шаг.";
    }
    return (
      "Шагов обучения ещё не было (step=0).\n" +
      "Текущие веса: w₁=" +
      w1.toFixed(4) +
      ", w₂=" +
      w2.toFixed(4) +
      ", b=" +
      b.toFixed(4) +
      ".\n" +
      "LRML.mse = " +
      LRML.mse(points, w1, w2, b).toFixed(6) +
      ".\n" +
      "Нажмите «Один шаг» / «10 шагов» / «Обучать» для разбора шага."
    );
  }

  /**
   * @param {number} x пробег (десятки тыс. км)
   * @param {number} y цена (млн руб.)
   * @param {number} v объём двигателя (л)
   */
  function tryAddPoint(x, y, v) {
    if (points.length >= MAX_MANUAL_POINTS) return false;
    if (!Number.isFinite(v) || v <= 0) return false;
    points.push({ x, v, y });
    return true;
  }

  function removePointAtIndex(idx) {
    if (idx < 0 || idx >= points.length) return false;
    points.splice(idx, 1);
    return true;
  }

  function currentMse() {
    return LRML.mse(points, w1, w2, b);
  }

  function setModelParams(nextW1, nextW2, nextB) {
    if (
      !Number.isFinite(nextW1) ||
      !Number.isFinite(nextW2) ||
      !Number.isFinite(nextB)
    ) {
      return { ok: false };
    }
    w1 = nextW1;
    w2 = nextW2;
    b = nextB;
    return { ok: true };
  }

  global.LRLOGIC = {
    MAX_MANUAL_POINTS,
    resetTrainingOnly,
    generateSynthetic,
    clearForManualMode,
    resetAfterDatasetEdit,
    runSteps,
    getStepLogText,
    setModelParams,
    tryAddPoint,
    removePointAtIndex,
    currentMse,
    get points() {
      return points;
    },
    get w1() {
      return w1;
    },
    get w2() {
      return w2;
    },
    get b() {
      return b;
    },
    get lossHistory() {
      return lossHistory;
    },
    get step() {
      return step;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
