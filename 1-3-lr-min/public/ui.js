/**
 * DOM: метрики, кнопки, η, цикл «Обучать», Chart.js и клики по графику.
 */
(function (global) {
  "use strict";

  const HIT_PX = 14;
  const HIT_PX2 = HIT_PX * HIT_PX;

  let trainTimer = null;
  let trainRunning = false;
  /** @type {{ getPointCount: () => number, oneStep: () => void } | null} */
  let trainApi = null;

  let chart = null;
  let canvasHooks = false;

  /**
   * @type {{
   *   getW: () => number,
   *   getB: () => number,
   *   getPoints: () => { x: number, y: number }[],
   *   getMse: () => number,
   *   getStep: () => number,
   *   resetStep: () => void,
   *   x0: number, x1: number, y0: number, y1: number,
   *   canvasId?: string,
   * } | null}
   */
  let model = null;

  function getLr() {
    const el = document.getElementById("lr");
    return el ? parseFloat(el.value) : NaN;
  }

  function stopTrainAnim() {
    if (trainTimer != null) {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    trainRunning = false;
  }

  function setRun(on) {
    if (!trainApi) return;
    const n = trainApi.getPointCount();
    if (on && n === 0) return;
    if (!on) {
      stopTrainAnim();
      paintUi();
      return;
    }
    stopTrainAnim();
    trainRunning = true;
    paintUi();
    trainTimer = setInterval(trainApi.oneStep, 55);
  }

  function paintUi() {
    if (!model) return;
    render({
      w: model.getW(),
      b: model.getB(),
      mse: model.getMse(),
      step: model.getStep(),
      pointCount: model.getPoints().length,
    });
  }

  function onDataChanged() {
    stopTrainAnim();
    model.resetStep();
    draw();
  }

  function inPlotArea(ev) {
    if (!chart || !chart.scales.x) return false;
    const Chart = global.Chart;
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    const { left, right, top, bottom } = chart.chartArea;
    return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
  }

  function dataFromEvent(ev) {
    const Chart = global.Chart;
    const pos = Chart.helpers.getRelativePosition(ev, chart);
    return {
      x: chart.scales.x.getValueForPixel(pos.x),
      y: chart.scales.y.getValueForPixel(pos.y),
    };
  }

  function removeNearest(clientX, clientY) {
    if (!chart || !model) return;
    const points = model.getPoints();
    if (!points.length) return;
    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;
    const sx = chart.scales.x;
    const sy = chart.scales.y;
    let best = -1;
    let bestD = HIT_PX2;
    for (let i = 0; i < points.length; i++) {
      const px = sx.getPixelForValue(points[i].x);
      const py = sy.getPixelForValue(points[i].y);
      const dx = px - cx;
      const dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) {
      points.splice(best, 1);
      onDataChanged();
    }
  }

  function onCanvasClick(ev) {
    if (!chart || !model || !inPlotArea(ev)) return;
    const p = dataFromEvent(ev);
    model.getPoints().push({ x: p.x, y: p.y });
    onDataChanged();
  }

  function onCanvasContext(ev) {
    ev.preventDefault();
    if (!chart || !model || !model.getPoints().length) return;
    removeNearest(ev.clientX, ev.clientY);
  }

  /**
   * @param {object} s
   * @param {number} s.w
   * @param {number} s.b
   * @param {number} s.mse
   * @param {number} s.step
   * @param {number} s.pointCount
   */
  function render(s) {
    document.getElementById("vw").textContent = s.w.toFixed(4);
    document.getElementById("vb").textContent = s.b.toFixed(4);
    document.getElementById("vm").textContent =
      s.pointCount > 0 ? s.mse.toFixed(5) : "—";
    document.getElementById("vs").textContent = String(s.step);
    const n = s.pointCount;
    document.getElementById("step").disabled = n === 0;
    document.getElementById("run").disabled = trainRunning || n === 0;
    document.getElementById("stop").disabled = !trainRunning;
  }

  function draw() {
    if (!model) return;
    const Chart = global.Chart;
    if (!Chart) {
      console.error("Chart.js должен быть загружен до вызова LRMinUi.draw");
      return;
    }

    paintUi();

    const w = model.getW();
    const b = model.getB();
    const points = model.getPoints();
    const X0 = model.x0,
      X1 = model.x1,
      Y0 = model.y0,
      Y1 = model.y1;

    const line = [
      { x: X0, y: w * X0 + b },
      { x: X1, y: w * X1 + b },
    ];
    const scatter = points.map((p) => ({ x: p.x, y: p.y }));
    const canvasId = model.canvasId || "c";

    if (!chart) {
      chart = new Chart(document.getElementById(canvasId), {
        data: {
          datasets: [
            {
              type: "scatter",
              label: "точки",
              data: scatter,
              backgroundColor: "#3dd6c6",
              borderColor: "#3dd6c6",
              pointRadius: 4,
            },
            {
              type: "line",
              label: "ŷ",
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
                color: function (ctx) {
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
                color: function (ctx) {
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
      if (!canvasHooks) {
        canvasHooks = true;
        chart.canvas.addEventListener("click", onCanvasClick);
        chart.canvas.addEventListener("contextmenu", onCanvasContext);
      }
    } else {
      chart.data.datasets[0].data = scatter;
      chart.data.datasets[1].data = line;
      chart.update("none");
    }
  }

  /**
   * @param {{
   *   getW: () => number,
   *   getB: () => number,
   *   getPoints: () => { x: number, y: number }[],
   *   getMse: () => number,
   *   getStep: () => number,
   *   resetStep: () => void,
   *   x0: number, x1: number, y0: number, y1: number,
   *   canvasId?: string,
   * }} cfg
   */
  function initView(cfg) {
    if (!global.Chart) {
      console.error("Chart.js должен быть загружен до LRMinUi.initView");
      return;
    }
    model = cfg;
  }

  /**
   * @param {{ getPointCount: () => number, oneStep: () => void }} api
   */
  function bindControls(api) {
    trainApi = {
      getPointCount: api.getPointCount,
      oneStep: api.oneStep,
    };
    document.getElementById("step").onclick = api.oneStep;
    document.getElementById("run").onclick = function () {
      setRun(true);
    };
    document.getElementById("stop").onclick = function () {
      setRun(false);
    };
  }

  global.LRMinUi = {
    getLr,
    render,
    bindControls,
    stopTrainAnim,
    initView,
    draw,
  };
})(window);
