/**
 * Состояние обучения и операции над датасетом и весами.
 * Зависит только от LRML; DOM и canvas — в ux.js / ui.js.
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
  let w = 0;
  let b = 0;
  let lossHistory = [];
  let step = 0;
  /** Текст подробного лога только последнего шага; null — показывать заглушку в UI */
  let lastStepTraceText = null;

  function resetTrainingOnly() {
    lossHistory = [];
    step = 0;
    lastStepTraceText = null;
  }

  function generateSynthetic(n) {
    points = LRML.generateSyntheticDataset(n);
    const wb = LRML.randomWeights();
    w = wb.w;
    b = wb.b;
    resetTrainingOnly();
  }

  function clearForManualMode() {
    points = [];
    const wb = LRML.randomWeights();
    w = wb.w;
    b = wb.b;
    resetTrainingOnly();
  }

  /** После ручного добавления/удаления точки — новая серия шагов и графика MSE. */
  function resetAfterDatasetEdit() {
    resetTrainingOnly();
  }

  /**
   * @param {number} n
   * @param {number} lr — уже приведённая скорость обучения (см. ux.getLearningRate)
   */
  function runSteps(n, lr) {
    if (!points.length || n < 1) return;
    for (let i = 0; i < n; i++) {
      const traced = LRML.gradientStepTrace(points, w, b, lr, step + 1);
      w = traced.w;
      b = traced.b;
      step += 1;
      lossHistory.push(LRML.mse(points, w, b));
      lastStepTraceText = traced.traceText;
    }
  }

  function getStepLogText() {
    if (lastStepTraceText != null) return lastStepTraceText;
    if (!points.length) {
      return "Нет точек в points — LRLOGIC.runSteps не вызывает LRML.gradientStep.";
    }
    return (
      "Шагов обучения ещё не было (step=0).\n" +
      "Текущие веса: w=" +
      w.toFixed(4) +
      ", b=" +
      b.toFixed(4) +
      ".\n" +
      "LRML.mse(points, w, b) = " +
      LRML.mse(points, w, b).toFixed(6) +
      ".\n" +
      "Нажмите «Один шаг» / «10 шагов» / «Обучать», чтобы увидеть пошаговый разбор вызовов LRML.gradientStep."
    );
  }

  function tryAddPoint(x, y) {
    if (points.length >= MAX_MANUAL_POINTS) return false;
    points.push({ x, y });
    return true;
  }

  function removePointAtIndex(idx) {
    if (idx < 0 || idx >= points.length) return false;
    points.splice(idx, 1);
    return true;
  }

  function currentMse() {
    return LRML.mse(points, w, b);
  }

  /**
   * Ручная установка параметров модели из UI.
   * @param {number} nextW
   * @param {number} nextB
   * @returns {{ ok: true } | { ok: false }}
   */
  function setModelParams(nextW, nextB) {
    if (!Number.isFinite(nextW) || !Number.isFinite(nextB)) {
      return { ok: false };
    }
    w = nextW;
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
    get w() {
      return w;
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
