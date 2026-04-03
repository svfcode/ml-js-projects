/**
 * Состояние: логистическая регрессия, датасет с метками 0/1.
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
      lossHistory.push(LRML.logLoss(points, w1, w2, b));
      lastStepTraceText = traced.traceText;
    }
  }

  function getStepLogText() {
    if (lastStepTraceText != null) return lastStepTraceText;
    if (!points.length) {
      return "Нет точек — обучение не запускается (LRLOGIC.runSteps выходит сразу).";
    }
    return (
      "Шагов ещё не было (step = 0).\n" +
      "Текущие веса: w₁=" +
      w1.toFixed(4) +
      ", w₂=" +
      w2.toFixed(4) +
      ", b=" +
      b.toFixed(4) +
      ".\n" +
      "LRML.logLoss = " +
      LRML.logLoss(points, w1, w2, b).toFixed(6) +
      ", LRML.accuracy = " +
      (LRML.accuracy(points, w1, w2, b) * 100).toFixed(1) +
      "%.\n" +
      "Нажмите «Один шаг» / «10 шагов» / «Обучать» — в этом блоке появится разбор шага (как в ml.js: gradientStepTrace)."
    );
  }

  function tryAddPoint(x, y, label) {
    if (points.length >= MAX_MANUAL_POINTS) return false;
    const L = label === 1 ? 1 : 0;
    points.push({ x, y, label: L });
    return true;
  }

  function removePointAtIndex(idx) {
    if (idx < 0 || idx >= points.length) return false;
    points.splice(idx, 1);
    return true;
  }

  function currentLogLoss() {
    return LRML.logLoss(points, w1, w2, b);
  }

  function currentAccuracy() {
    return LRML.accuracy(points, w1, w2, b);
  }

  global.LRLOGIC = {
    MAX_MANUAL_POINTS,
    generateSynthetic,
    clearForManualMode,
    resetAfterDatasetEdit,
    runSteps,
    getStepLogText,
    tryAddPoint,
    removePointAtIndex,
    currentLogLoss,
    currentAccuracy,
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
