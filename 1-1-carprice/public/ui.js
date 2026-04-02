/**
 * Визуализация: Chart.js, метрики, состояние контролов.
 */
(function (global) {
  "use strict";

  const Chart = global.Chart;
  if (!Chart) {
    console.error("Chart.js должен быть загружен до ui.js");
    return;
  }

  const DEFAULT_PLOT_BOUNDS = {
    xMin: 0,
    xMax: 35,
    yMin: 0,
    yMax: 4.5,
  };

  /** Текущие границы графика данных (оси x, y). */
  let plotBounds = { ...DEFAULT_PLOT_BOUNDS };

  /** Радиус попадания в точку (px canvas) для удаления по ПКМ */
  const NEAREST_POINT_HIT_PX = 14;

  let dataChart = null;
  let lossChart = null;

  function getDataChart() {
    return dataChart;
  }

  function inPlotChart(ev, chart) {
    if (!chart || !chart.scales.x) return false;
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    const { left, right, top, bottom } = chart.chartArea;
    return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
  }

  function dataCoordsFromEvent(ev, chart) {
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    return {
      x: chart.scales.x.getValueForPixel(pos.x),
      y: chart.scales.y.getValueForPixel(pos.y),
    };
  }

  function findNearestPointIndex(points, clientX, clientY, chart) {
    if (!chart || !points.length) return -1;
    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;
    let best = -1;
    let bestD = NEAREST_POINT_HIT_PX * NEAREST_POINT_HIT_PX;
    const meta = chart.getDatasetMeta(0);
    for (let i = 0; i < points.length; i++) {
      const el = meta.data[i];
      if (!el || el.skip) continue;
      const dx = el.x - cx;
      const dy = el.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    return best;
  }

  const chartColors = {
    text: "#8b9aab",
    grid: "rgba(45, 58, 71, 0.55)",
    bg: "#121820",
    accent: "#3dd6c6",
    line: "#f4a261",
    loss: "#e76f51",
    axisLabel: "#c5d0dc",
    axisLine: "#5a6d82",
  };

  const axisTitleStyle = {
    display: true,
    color: chartColors.axisLabel,
    font: { size: 13, weight: "600", family: "system-ui, sans-serif" },
  };

  const axisLine = {
    display: true,
    color: chartColors.axisLine,
    width: 1,
  };

  const tickFont = { size: 11, family: "system-ui, sans-serif" };

  function applyBoundsToDataChartScales() {
    if (!dataChart) return;
    dataChart.options.scales.x.min = plotBounds.xMin;
    dataChart.options.scales.x.max = plotBounds.xMax;
    dataChart.options.scales.y.min = plotBounds.yMin;
    dataChart.options.scales.y.max = plotBounds.yMax;
  }

  /**
   * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} b
   * @returns {{ ok: true } | { ok: false }}
   */
  function setPlotBounds(b) {
    const xMin = Number(b.xMin);
    const xMax = Number(b.xMax);
    const yMin = Number(b.yMin);
    const yMax = Number(b.yMax);
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) {
      return { ok: false };
    }
    if (xMin >= xMax || yMin >= yMax) {
      return { ok: false };
    }
    const maxSpan = 1e6;
    if (
      xMax - xMin > maxSpan ||
      yMax - yMin > maxSpan ||
      Math.abs(xMin) > maxSpan ||
      Math.abs(xMax) > maxSpan ||
      Math.abs(yMin) > maxSpan ||
      Math.abs(yMax) > maxSpan
    ) {
      return { ok: false };
    }
    plotBounds = { xMin, xMax, yMin, yMax };
    applyBoundsToDataChartScales();
    if (dataChart) dataChart.update("none");
    return { ok: true };
  }

  function getPlotBounds() {
    return { ...plotBounds };
  }

  function resetPlotBounds() {
    plotBounds = { ...DEFAULT_PLOT_BOUNDS };
    applyBoundsToDataChartScales();
    if (dataChart) dataChart.update("none");
  }

  function initCharts(dataCanvasEl, lossCanvasEl) {
    Chart.defaults.color = chartColors.text;
    Chart.defaults.borderColor = chartColors.grid;

    dataChart = new Chart(dataCanvasEl, {
      data: {
        datasets: [
          {
            type: "scatter",
            label: "Автомобили",
            data: [],
            backgroundColor: chartColors.accent,
            borderColor: chartColors.accent,
            pointRadius: 5,
            pointHoverRadius: 9,
            pointHitRadius: 12,
          },
          {
            type: "line",
            label: "Оценка цены: ŷ = w·x + b",
            data: [],
            borderColor: chartColors.line,
            backgroundColor: chartColors.line,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: {
            labels: { color: chartColors.text, boxWidth: 12 },
          },
          tooltip: {
            filter(ctx) {
              return ctx.datasetIndex === 0;
            },
            backgroundColor: "rgba(26, 34, 44, 0.95)",
            titleColor: chartColors.text,
            bodyColor: "#e8eef4",
            borderColor: "#2d3a47",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title(ctx) {
                if (ctx[0].datasetIndex === 0) return "Автомобиль в выборке";
                return ctx[0].dataset.label || "";
              },
              label(ctx) {
                if (ctx.datasetIndex === 0) {
                  const { x, y } = ctx.raw;
                  return [
                    `Пробег: ${Number(x).toFixed(2)} × 10 000 км`,
                    `Цена: ${Number(y).toFixed(3)} млн руб.`,
                  ];
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            min: plotBounds.xMin,
            max: plotBounds.xMax,
            border: axisLine,
            title: {
              ...axisTitleStyle,
              text: "Пробег (x), десятки тыс. км",
              padding: { top: 10 },
            },
            grid: { color: chartColors.grid },
            ticks: {
              color: chartColors.text,
              font: tickFont,
              maxTicksLimit: 10,
              callback(v) {
                return Number(v).toFixed(1);
              },
            },
          },
          y: {
            min: plotBounds.yMin,
            max: plotBounds.yMax,
            border: axisLine,
            title: {
              ...axisTitleStyle,
              text: "Цена (y), млн руб.",
              padding: { bottom: 10 },
            },
            grid: { color: chartColors.grid },
            ticks: {
              color: chartColors.text,
              font: tickFont,
              maxTicksLimit: 10,
              callback(v) {
                return Number(v).toFixed(1);
              },
            },
          },
        },
      },
    });

    lossChart = new Chart(lossCanvasEl, {
      type: "line",
      data: {
        datasets: [
          {
            label: "MSE",
            data: [],
            borderColor: chartColors.loss,
            backgroundColor: "rgba(231, 111, 81, 0.12)",
            fill: true,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHitRadius: 16,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "nearest", axis: "x" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26, 34, 44, 0.95)",
            titleColor: chartColors.text,
            bodyColor: "#e8eef4",
            borderColor: "#2d3a47",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title(items) {
                const s = items[0].parsed.x;
                return "Шаг " + s;
              },
              label(item) {
                return "MSE: " + Number(item.parsed.y).toFixed(6);
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            border: axisLine,
            title: {
              ...axisTitleStyle,
              text: "Ось x — номер шага обучения",
              padding: { top: 10 },
            },
            grid: { color: chartColors.grid },
            ticks: {
              color: chartColors.text,
              font: tickFont,
              maxTicksLimit: 14,
              callback(v) {
                return Math.round(v);
              },
            },
          },
          y: {
            border: axisLine,
            title: {
              ...axisTitleStyle,
              text: "Ось y — MSE (среднеквадратичная ошибка)",
              padding: { bottom: 10 },
            },
            grid: { color: chartColors.grid },
            ticks: {
              color: chartColors.text,
              font: tickFont,
              maxTicksLimit: 8,
              callback(v) {
                const n = Number(v);
                if (Math.abs(n) < 1e-3 || Math.abs(n) >= 1e4) return n.toExponential(1);
                return n.toPrecision(3);
              },
            },
            beginAtZero: false,
          },
        },
      },
    });
  }

  function updateDataChart(points, w, b) {
    if (!dataChart) return;
    dataChart.data.datasets[0].data = points.map((p) => ({ x: p.x, y: p.y }));
    const x0 = plotBounds.xMin;
    const x1 = plotBounds.xMax;
    dataChart.data.datasets[1].data = [
      { x: x0, y: w * x0 + b },
      { x: x1, y: w * x1 + b },
    ];
    dataChart.update("none");
  }

  function updateLossChart(lossHistory) {
    if (!lossChart) return;
    lossChart.data.datasets[0].data = lossHistory.map((mse, i) => ({
      x: i + 1,
      y: mse,
    }));
    lossChart.update("none");
  }

  function updateMetrics(els, w, b, loss, stepCount) {
    els.valW.textContent = w.toFixed(4);
    els.valB.textContent = b.toFixed(4);
    els.valLoss.textContent = loss.toFixed(6);
    els.valStep.textContent = String(stepCount);
  }

  /**
   * @param {object} els — DOM-элементы панели режима и кнопок
   * @param {{ manual: boolean, running: boolean, pointsLength: number }} state
   */
  function applyModeChrome(els, state) {
    const { manual, running, pointsLength } = state;
    els.nPointsRow.hidden = manual;
    els.manualHint.hidden = !manual;
    const wrap = els.dataChartShell;
    if (wrap) wrap.classList.toggle("chart-shell--clickable", manual);
    els.btnReset.textContent = manual ? "Очистить точки" : "Сгенерировать";
    if (!running) {
      els.btnRun.disabled = !pointsLength;
      els.btnStep.disabled = !pointsLength;
      if (els.btnStep10) els.btnStep10.disabled = !pointsLength;
    }
  }

  function setRunningButtonState(els, running, pointsLength) {
    els.btnRun.disabled = running || !pointsLength;
    els.btnPause.disabled = !running;
    els.btnStep.disabled = running || !pointsLength;
    if (els.btnStep10) els.btnStep10.disabled = running || !pointsLength;
  }

  global.LRUI = {
    NEAREST_POINT_HIT_PX,
    DEFAULT_PLOT_BOUNDS,
    initCharts,
    setPlotBounds,
    getPlotBounds,
    resetPlotBounds,
    updateDataChart,
    updateLossChart,
    getDataChart,
    inPlotChart,
    dataCoordsFromEvent,
    findNearestPointIndex,
    updateMetrics,
    applyModeChrome,
    setRunningButtonState,
  };
})(typeof window !== "undefined" ? window : globalThis);
