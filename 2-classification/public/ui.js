/**
 * Визуализация: два класса точек + граница решения w₁·x + w₂·y + b = 0.
 */
(function (global) {
  "use strict";

  const Chart = global.Chart;
  if (!Chart) {
    console.error("Chart.js должен быть загружен до ui.js");
    return;
  }

  const DEFAULT_PLOT_BOUNDS = {
    xMin: -1.2,
    xMax: 1.2,
    yMin: -1.5,
    yMax: 1.5,
  };

  let plotBounds = { ...DEFAULT_PLOT_BOUNDS };

  const NEAREST_POINT_HIT_PX = 14;

  let dataChart = null;
  let lossChart = null;

  const COLOR_C0 = "#3dd6c6";
  const COLOR_C1 = "#e76f51";
  const COLOR_BOUNDARY = "#f4a261";

  const chartColors = {
    text: "#8b9aab",
    grid: "rgba(45, 58, 71, 0.55)",
    bg: "#121820",
    axisLabel: "#c5d0dc",
    axisLine: "#5a6d82",
    loss: "#e76f51",
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

  /** Ближайшая точка среди всех классов (по пикселям). */
  function findNearestClassPointIndex(points, clientX, clientY, chart) {
    if (!chart || !points.length) return -1;
    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;
    const sx = chart.scales.x;
    const sy = chart.scales.y;
    let best = -1;
    let bestD = NEAREST_POINT_HIT_PX * NEAREST_POINT_HIT_PX;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = sx.getPixelForValue(p.x);
      const py = sy.getPixelForValue(p.y);
      const dx = px - cx;
      const dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    return best;
  }

  function applyBoundsToDataChartScales() {
    if (!dataChart) return;
    dataChart.options.scales.x.min = plotBounds.xMin;
    dataChart.options.scales.x.max = plotBounds.xMax;
    dataChart.options.scales.y.min = plotBounds.yMin;
    dataChart.options.scales.y.max = plotBounds.yMax;
  }

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

  /**
   * Отрезок прямой w₁·x + w₂·y + b = 0 внутри прямоугольника plotBounds.
   */
  function decisionBoundarySegment(w1, w2, b, B) {
    const hits = [];
    const eps = 1e-9;
    if (Math.abs(w2) > eps) {
      for (const xv of [B.xMin, B.xMax]) {
        const yy = -(w1 * xv + b) / w2;
        if (yy >= B.yMin && yy <= B.yMax) {
          hits.push({ x: xv, y: yy });
        }
      }
    }
    if (Math.abs(w1) > eps) {
      for (const yv of [B.yMin, B.yMax]) {
        const xx = -(w2 * yv + b) / w1;
        if (xx >= B.xMin && xx <= B.xMax) {
          hits.push({ x: xx, y: yv });
        }
      }
    }
    const key = (p) => `${p.x.toFixed(8)},${p.y.toFixed(8)}`;
    const map = new Map();
    for (const p of hits) map.set(key(p), p);
    const uniq = [...map.values()];
    if (uniq.length >= 2) {
      let bestA = uniq[0];
      let bestB = uniq[1];
      let bestD = -1;
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const dx = uniq[i].x - uniq[j].x;
          const dy = uniq[i].y - uniq[j].y;
          const d = dx * dx + dy * dy;
          if (d > bestD) {
            bestD = d;
            bestA = uniq[i];
            bestB = uniq[j];
          }
        }
      }
      return [bestA, bestB];
    }
    if (Math.abs(w2) < eps && Math.abs(w1) > eps) {
      const xv = -b / w1;
      if (xv >= B.xMin && xv <= B.xMax) {
        return [
          { x: xv, y: B.yMin },
          { x: xv, y: B.yMax },
        ];
      }
    }
    return [];
  }

  function initCharts(dataCanvasEl, lossCanvasEl) {
    Chart.defaults.color = chartColors.text;
    Chart.defaults.borderColor = chartColors.grid;

    dataChart = new Chart(dataCanvasEl, {
      data: {
        datasets: [
          {
            type: "scatter",
            label: "Класс 0",
            data: [],
            backgroundColor: COLOR_C0,
            borderColor: COLOR_C0,
            pointRadius: 6,
            pointHoverRadius: 10,
            pointHitRadius: 12,
          },
          {
            type: "scatter",
            label: "Класс 1",
            data: [],
            backgroundColor: COLOR_C1,
            borderColor: COLOR_C1,
            pointRadius: 6,
            pointHoverRadius: 10,
            pointHitRadius: 12,
          },
          {
            type: "line",
            label: "Граница: w₁x+w₂y+b=0",
            data: [],
            borderColor: COLOR_BOUNDARY,
            backgroundColor: COLOR_BOUNDARY,
            borderWidth: 2.5,
            borderDash: [6, 4],
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
              return ctx.datasetIndex === 0 || ctx.datasetIndex === 1;
            },
            backgroundColor: "rgba(26, 34, 44, 0.95)",
            titleColor: chartColors.text,
            bodyColor: "#e8eef4",
            borderColor: "#2d3a47",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title(ctx) {
                return "Точка";
              },
              label(ctx) {
                const { x, y, label } = ctx.raw;
                return [
                  `x₁: ${Number(x).toFixed(3)}`,
                  `x₂: ${Number(y).toFixed(3)}`,
                  `класс: ${label}`,
                ];
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
              text: "Признак x₁",
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
              text: "Признак x₂",
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
            label: "Log-loss",
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
                return "Шаг " + items[0].parsed.x;
              },
              label(item) {
                return "Log-loss: " + Number(item.parsed.y).toFixed(6);
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
              text: "Шаг обучения",
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
              text: "Log-loss",
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

  function updateDataChart(points, w1, w2, b) {
    if (!dataChart) return;
    const c0 = [];
    const c1 = [];
    for (const p of points) {
      const d = { x: p.x, y: p.y, label: p.label };
      if (p.label === 1) c1.push(d);
      else c0.push(d);
    }
    dataChart.data.datasets[0].data = c0;
    dataChart.data.datasets[1].data = c1;
    const seg = decisionBoundarySegment(w1, w2, b, plotBounds);
    dataChart.data.datasets[2].data =
      seg.length === 2 ? seg : seg.length === 1 ? [seg[0], seg[0]] : [];
    dataChart.update("none");
  }

  function updateLossChart(lossHistory) {
    if (!lossChart) return;
    lossChart.data.datasets[0].data = lossHistory.map((L, i) => ({
      x: i + 1,
      y: L,
    }));
    lossChart.update("none");
  }

  function updateMetrics(els, w1, w2, b, logLossVal, acc, stepCount) {
    if (els.valW1) els.valW1.textContent = w1.toFixed(4);
    if (els.valW2) els.valW2.textContent = w2.toFixed(4);
    if (els.valB) els.valB.textContent = b.toFixed(4);
    if (els.valLoss) els.valLoss.textContent = logLossVal.toFixed(6);
    if (els.valAcc) els.valAcc.textContent = (acc * 100).toFixed(1) + "%";
    if (els.valStep) els.valStep.textContent = String(stepCount);
  }

  function applyModeChrome(els, state) {
    const { manual, running, pointsLength } = state;
    els.nPointsRow.hidden = manual;
    els.manualHint.hidden = !manual;
    if (els.classPickRow) els.classPickRow.hidden = !manual;
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
    findNearestClassPointIndex,
    updateMetrics,
    applyModeChrome,
    setRunningButtonState,
  };
})(typeof window !== "undefined" ? window : globalThis);
