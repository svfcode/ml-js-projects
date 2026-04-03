/**
 * UI + Chart.js для минимального демо классификации:
 * - метрики и кнопки
 * - канвас с точками двух классов и границей решения
 * - клики / удаление ближайшей точки.
 */
(function (global) {
  "use strict";

  const Chart = global.Chart;
  if (!Chart) {
    console.error("Chart.js должен быть загружен до ui.js");
    return;
  }

  const HIT_PX2 = 14 * 14;

  /**
   * @type {{
   *   getModel: () => { w1:number, w2:number, b:number, step:number },
   *   getCanvas: () => { x0:number, x1:number, y0:number, y1:number, points:{x:number,y:number,label:0|1}[] },
   *   logLoss: () => number,
   *   accuracy: () => number,
   *   oneStep: () => void,
   *   resetStep: () => void,
   * } | null}
   */
  let cfg = null;

  let chart = null;
  let trainTimer = null;
  let trainRunning = false;

  function currentLr() {
    const v = parseFloat(document.getElementById("lr").value);
    return Number.isFinite(v) && v > 0 ? v : NaN;
  }

  function paintUi() {
    if (!cfg) return;
    const model = cfg.getModel();
    const canvas = cfg.getCanvas();
    const n = canvas.points.length;

    document.getElementById("vw1").textContent = model.w1.toFixed(4);
    document.getElementById("vw2").textContent = model.w2.toFixed(4);
    document.getElementById("vb").textContent = model.b.toFixed(4);
    document.getElementById("vloss").textContent = n
      ? cfg.logLoss().toFixed(5)
      : "—";
    document.getElementById("vacc").textContent = n
      ? (cfg.accuracy() * 100).toFixed(1) + "%"
      : "—";
    document.getElementById("vstep").textContent = String(model.step);
    document.getElementById("step").disabled = n === 0;
    document.getElementById("run").disabled = trainRunning || n === 0;
    document.getElementById("stop").disabled = !trainRunning;
  }

  function stopTrain() {
    if (trainTimer != null) {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    trainRunning = false;
  }

  function onDataChanged() {
    if (!cfg) return;
    stopTrain();
    cfg.resetStep();
    draw();
  }

  function inPlotArea(ev) {
    if (!chart || !chart.scales.x) return false;
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    const { left, right, top, bottom } = chart.chartArea;
    return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
  }

  function dataFromEvent(ev) {
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    return {
      x: chart.scales.x.getValueForPixel(pos.x),
      y: chart.scales.y.getValueForPixel(pos.y),
    };
  }

  function removeNearest(clientX, clientY) {
    if (!chart || !cfg) return;
    const canvasState = cfg.getCanvas();
    if (!canvasState.points.length) return;

    const c = chart.canvas;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    const cx = (clientX - rect.left) * sx;
    const cy = (clientY - rect.top) * sy;
    const xs = chart.scales.x;
    const ys = chart.scales.y;
    let best = -1;
    let bestD = HIT_PX2;
    for (let i = 0; i < canvasState.points.length; i++) {
      const p = canvasState.points[i];
      const px = xs.getPixelForValue(p.x);
      const py = ys.getPixelForValue(p.y);
      const dx = px - cx;
      const dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) {
      canvasState.points.splice(best, 1);
      onDataChanged();
    }
  }

  function onCanvasClick(ev) {
    if (!cfg || !chart || !inPlotArea(ev)) return;
    const canvasState = cfg.getCanvas();
    const pos = dataFromEvent(ev);
    const r = document.querySelector('input[name="pointClass"]:checked');
    const label = r && r.value === "1" ? 1 : 0;
    canvasState.points.push({ x: pos.x, y: pos.y, label });
    onDataChanged();
  }

  function onCanvasContext(ev) {
    ev.preventDefault();
    if (!cfg || !chart) return;
    const canvasState = cfg.getCanvas();
    if (!canvasState.points.length) return;
    removeNearest(ev.clientX, ev.clientY);
  }

  function draw() {
    if (!cfg) return;
    const model = cfg.getModel();
    const canvasState = cfg.getCanvas();
    paintUi();

    const pts0 = canvasState.points.filter((p) => p.label === 0);
    const pts1 = canvasState.points.filter((p) => p.label === 1);

    const { w1, w2, b } = model;
    const X0 = canvasState.x0;
    const X1 = canvasState.x1;
    const Y0 = canvasState.y0;
    const Y1 = canvasState.y1;

    let line;
    if (Math.abs(w2) > 1e-6) {
      line = [
        { x: X0, y: -(w1 * X0 + b) / w2 },
        { x: X1, y: -(w1 * X1 + b) / w2 },
      ];
    } else if (Math.abs(w1) > 1e-6) {
      const x = -b / w1;
      line = [
        { x, y: Y0 },
        { x, y: Y1 },
      ];
    } else {
      line = [
        { x: X0, y: 0 },
        { x: X1, y: 0 },
      ];
    }

    const data0 = pts0.map((p) => ({ x: p.x, y: p.y }));
    const data1 = pts1.map((p) => ({ x: p.x, y: p.y }));

    if (!chart) {
      chart = new Chart(document.getElementById("c"), {
        data: {
          datasets: [
            {
              type: "scatter",
              label: "класс 0",
              data: data0,
              backgroundColor: "#e76f51",
              borderColor: "#e76f51",
              pointRadius: 4,
            },
            {
              type: "scatter",
              label: "класс 1",
              data: data1,
              backgroundColor: "#3dd6c6",
              borderColor: "#3dd6c6",
              pointRadius: 4,
            },
            {
              type: "line",
              label: "граница решения",
              data: line,
              borderColor: "#f4a261",
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#8b9aab" } },
          },
          scales: {
            x: {
              type: "linear",
              min: X0,
              max: X1,
              border: { display: true, color: "#8b9aab" },
              grid: {
                color: (ctx) => {
                  const v = ctx.tick && ctx.tick.value;
                  return v === 0
                    ? "rgba(139,154,171,0.75)"
                    : "rgba(45,58,71,0.55)";
                },
              },
              ticks: {
                color: "#8b9aab",
                stepSize: 1,
                autoSkip: false,
              },
            },
            y: {
              min: Y0,
              max: Y1,
              border: { display: true, color: "#8b9aab" },
              grid: {
                color: (ctx) => {
                  const v = ctx.tick && ctx.tick.value;
                  return v === 0
                    ? "rgba(139,154,171,0.75)"
                    : "rgba(45,58,71,0.55)";
                },
              },
              ticks: {
                color: "#8b9aab",
                stepSize: 1,
                autoSkip: false,
              },
            },
          },
        },
      });
      chart.canvas.addEventListener("click", onCanvasClick);
      chart.canvas.addEventListener("contextmenu", onCanvasContext);
    } else {
      chart.data.datasets[0].data = data0;
      chart.data.datasets[1].data = data1;
      chart.data.datasets[2].data = line;
      chart.update("none");
    }
  }

  function bindControls() {
    document.getElementById("step").onclick = function () {
      if (!cfg) return;
      cfg.oneStep();
    };
    document.getElementById("run").onclick = function () {
      if (!cfg) return;
      const canvasState = cfg.getCanvas();
      const n = canvasState.points.length;
      const lr = currentLr();
      if (!n || trainRunning || !Number.isFinite(lr) || lr <= 0) return;
      trainRunning = true;
      paintUi();
      trainTimer = setInterval(cfg.oneStep, 55);
    };
    document.getElementById("stop").onclick = function () {
      stopTrain();
      paintUi();
    };
  }

  /**
   * Инициализация UI.
   * @param {Parameters<typeof init>[0]} config
   */
  function init(config) {
    cfg = config;
    bindControls();
    draw();
  }

  global.CLFMinUi = {
    init,
    onDataChanged,
    draw,
  };
})(window);

