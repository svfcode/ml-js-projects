/**
 * Сценарии использования: DOM, события, цикл «Обучать».
 * Склеивает LRLOGIC (обучение) и LRUI (отрисовка).
 */
(function () {
  "use strict";

  const { LRUI, LRLOGIC } = window;
  if (!LRUI || !LRLOGIC) {
    console.error("LRUI и LRLOGIC должны быть загружены до ux.js");
    return;
  }

  const STEP_INTERVAL_MS = 55;
  const LR_MIN = 0.00001;
  const LR_SLIDER_STEP = 0.00001;

  const dataChartEl = document.getElementById("dataChart");
  const lossChartEl = document.getElementById("lossChart");

  const els = {
    valW1: document.getElementById("valW1"),
    valW2: document.getElementById("valW2"),
    valB: document.getElementById("valB"),
    valLoss: document.getElementById("valLoss"),
    valStep: document.getElementById("valStep"),
    lrInput: document.getElementById("lr"),
    lrNumber: document.getElementById("lrNumber"),
    nPointsInput: document.getElementById("nPoints"),
    nPointsRow: document.getElementById("nPointsRow"),
    nPointsVal: document.getElementById("nPointsVal"),
    manualW1: document.getElementById("manualW1"),
    manualW2: document.getElementById("manualW2"),
    manualB: document.getElementById("manualB"),
    manualMse: document.getElementById("manualMse"),
    btnApplyParams: document.getElementById("btnApplyParams"),
    manualEngineRow: document.getElementById("manualEngineRow"),
    manualEngineVol: document.getElementById("manualEngineVol"),
    btnReset: document.getElementById("btnReset"),
    btnStep: document.getElementById("btnStep"),
    btnStep10: document.getElementById("btnStep10"),
    btnRun: document.getElementById("btnRun"),
    btnPause: document.getElementById("btnPause"),
    manualHint: document.getElementById("manualHint"),
    dataChartShell: document.getElementById("dataChartShell"),
    plotXMin: document.getElementById("plotXMin"),
    plotXMax: document.getElementById("plotXMax"),
    plotYMin: document.getElementById("plotYMin"),
    plotYMax: document.getElementById("plotYMax"),
    btnPlotScaleReset: document.getElementById("btnPlotScaleReset"),
    logStepText: document.getElementById("logStepText"),
  };

  LRUI.initCharts(dataChartEl, lossChartEl);

  function syncPlotInputsFromChart() {
    const b = LRUI.getPlotBounds();
    els.plotXMin.value = String(b.xMin);
    els.plotXMax.value = String(b.xMax);
    els.plotYMin.value = String(b.yMin);
    els.plotYMax.value = String(b.yMax);
  }

  function applyPlotScaleFromInputs() {
    const r = LRUI.setPlotBounds({
      xMin: parseFloat(els.plotXMin.value, 10),
      xMax: parseFloat(els.plotXMax.value, 10),
      yMin: parseFloat(els.plotYMin.value, 10),
      yMax: parseFloat(els.plotYMax.value, 10),
    });
    if (!r.ok) {
      syncPlotInputsFromChart();
      return;
    }
    drawAll();
  }

  ["plotXMin", "plotXMax", "plotYMin", "plotYMax"].forEach((id) => {
    els[id].addEventListener("change", applyPlotScaleFromInputs);
  });

  els.btnPlotScaleReset.addEventListener("click", () => {
    LRUI.resetPlotBounds();
    syncPlotInputsFromChart();
    drawAll();
  });

  const modeRadios = document.querySelectorAll('input[name="dataMode"]');

  let animId = null;
  let running = false;
  let lastTick = 0;

  function getDataMode() {
    const c = document.querySelector('input[name="dataMode"]:checked');
    return c ? c.value : "generate";
  }

  function clampLr(v) {
    if (!Number.isFinite(v)) return LR_MIN;
    return Math.max(LR_MIN, v);
  }

  function formatLrForInput(v) {
    const t = (+v).toFixed(6).replace(/\.?0+$/, "");
    return t === "" ? "0" : t;
  }

  function syncLrFromSlider() {
    const v = clampLr(+els.lrInput.value);
    els.lrInput.value = String(
      Math.round(v / LR_SLIDER_STEP) * LR_SLIDER_STEP
    );
    els.lrNumber.value = formatLrForInput(+els.lrInput.value);
    refreshStepLog();
  }

  function syncLrFromNumberField() {
    const raw = parseFloat(els.lrNumber.value, 10);
    if (Number.isNaN(raw)) {
      syncLrFromSlider();
      return;
    }
    const v = clampLr(raw);
    els.lrNumber.value = formatLrForInput(v);
    const sliderMax = +els.lrInput.max;
    const snapped = Math.round(v / LR_SLIDER_STEP) * LR_SLIDER_STEP;
    const forSlider = Number.isFinite(sliderMax)
      ? Math.min(Math.max(snapped, LR_MIN), sliderMax)
      : Math.max(snapped, LR_MIN);
    els.lrInput.value = String(forSlider);
    refreshStepLog();
  }

  function getLearningRate() {
    const fromNum = parseFloat(els.lrNumber.value, 10);
    if (!Number.isNaN(fromNum)) return clampLr(fromNum);
    return clampLr(+els.lrInput.value);
  }

  function refreshStepLog() {
    if (!els.logStepText) return;
    els.logStepText.textContent = LRLOGIC.getStepLogText();
  }

  function syncViz3d() {
    const api = window.CarPrice3DViz;
    if (api && typeof api.sync === "function") api.sync();
  }

  function drawAll() {
    LRUI.updateDataChart(LRLOGIC.points, LRLOGIC.w1, LRLOGIC.w2, LRLOGIC.b);
    LRUI.updateLossChart(LRLOGIC.lossHistory);
    refreshStepLog();
    syncViz3d();
  }

  function syncMetrics() {
    const currentMse = LRLOGIC.currentMse();
    LRUI.updateMetrics(
      els,
      LRLOGIC.w1,
      LRLOGIC.w2,
      LRLOGIC.b,
      currentMse,
      LRLOGIC.step
    );
    if (els.manualW1 && document.activeElement !== els.manualW1) {
      els.manualW1.value = LRLOGIC.w1.toFixed(4);
    }
    if (els.manualW2 && document.activeElement !== els.manualW2) {
      els.manualW2.value = LRLOGIC.w2.toFixed(4);
    }
    if (els.manualB && document.activeElement !== els.manualB) {
      els.manualB.value = LRLOGIC.b.toFixed(4);
    }
    if (els.manualMse) els.manualMse.value = currentMse.toFixed(6);
  }

  function syncManualParamsFromState() {
    if (els.manualW1) els.manualW1.value = LRLOGIC.w1.toFixed(4);
    if (els.manualW2) els.manualW2.value = LRLOGIC.w2.toFixed(4);
    if (els.manualB) els.manualB.value = LRLOGIC.b.toFixed(4);
  }

  function applyManualModelParams() {
    const nextW1 = parseFloat(els.manualW1.value, 10);
    const nextW2 = parseFloat(els.manualW2.value, 10);
    const nextB = parseFloat(els.manualB.value, 10);
    const r = LRLOGIC.setModelParams(nextW1, nextW2, nextB);
    if (!r.ok) {
      syncManualParamsFromState();
      syncMetrics();
      return;
    }
    setRunning(false);
    syncMetrics();
    drawAll();
    updateModeUI();
  }

  function updateModeUI() {
    LRUI.applyModeChrome(els, {
      manual: getDataMode() === "manual",
      running,
      pointsLength: LRLOGIC.points.length,
    });
  }

  function generateData() {
    LRLOGIC.generateSynthetic(+els.nPointsInput.value);
    syncMetrics();
    drawAll();
    updateModeUI();
  }

  function clearManualPoints() {
    LRLOGIC.clearForManualMode();
    syncMetrics();
    drawAll();
    updateModeUI();
  }

  function onDatasetChanged() {
    setRunning(false);
    LRLOGIC.resetAfterDatasetEdit();
    syncMetrics();
    drawAll();
    updateModeUI();
  }

  function runTrainingSteps(n) {
    LRLOGIC.runSteps(n, getLearningRate());
    syncMetrics();
    drawAll();
  }

  function tick(now) {
    if (!running) return;
    if (now - lastTick >= STEP_INTERVAL_MS) {
      lastTick = now;
      runTrainingSteps(1);
    }
    animId = requestAnimationFrame(tick);
  }

  function setRunning(on) {
    running = on;
    LRUI.setRunningButtonState(els, on, LRLOGIC.points.length);
    if (on) {
      lastTick = performance.now();
      animId = requestAnimationFrame(tick);
    } else if (animId != null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  modeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      setRunning(false);
      if (getDataMode() === "generate") {
        generateData();
      } else {
        clearManualPoints();
      }
    });
  });

  dataChartEl.addEventListener("click", (ev) => {
    if (getDataMode() !== "manual") return;
    const chart = LRUI.getDataChart();
    if (!chart) return;
    if (!LRUI.inPlotChart(ev, chart)) return;
    const p = LRUI.dataCoordsFromEvent(ev, chart);
    const v = parseFloat(els.manualEngineVol.value, 10);
    if (!LRLOGIC.tryAddPoint(p.x, p.y, v)) return;
    onDatasetChanged();
  });

  dataChartEl.addEventListener("contextmenu", (ev) => {
    if (getDataMode() !== "manual") return;
    ev.preventDefault();
    const chart = LRUI.getDataChart();
    if (!chart) return;
    const idx = LRUI.findNearestPointIndex(
      LRLOGIC.points,
      ev.clientX,
      ev.clientY,
      chart
    );
    if (idx < 0) return;
    if (!LRLOGIC.removePointAtIndex(idx)) return;
    onDatasetChanged();
  });

  els.lrInput.addEventListener("input", syncLrFromSlider);
  els.lrNumber.addEventListener("change", syncLrFromNumberField);
  els.lrNumber.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      els.lrNumber.blur();
    }
  });
  els.nPointsInput.addEventListener("input", () => {
    els.nPointsVal.textContent = els.nPointsInput.value;
  });
  els.btnApplyParams.addEventListener("click", applyManualModelParams);
  [els.manualW1, els.manualW2, els.manualB].forEach((el) => {
    if (!el) return;
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        applyManualModelParams();
      }
    });
  });

  els.btnReset.addEventListener("click", () => {
    setRunning(false);
    if (getDataMode() === "generate") {
      generateData();
    } else {
      clearManualPoints();
    }
  });
  els.btnStep.addEventListener("click", () => {
    runTrainingSteps(1);
  });
  els.btnStep10.addEventListener("click", () => {
    runTrainingSteps(10);
  });
  els.btnRun.addEventListener("click", () => setRunning(true));
  els.btnPause.addEventListener("click", () => setRunning(false));

  syncLrFromSlider();
  els.nPointsVal.textContent = els.nPointsInput.value;
  generateData();
  syncManualParamsFromState();
  updateModeUI();
})();
