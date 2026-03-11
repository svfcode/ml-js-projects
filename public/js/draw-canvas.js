/**
 * Canvas для рисования цифры 28×28 с предсказанием по модели
 */

const DRAW_THROTTLE_MS = 100;
let drawThrottleTimer = null;
let isDrawing = false;

function getDrawCanvasInput() {
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, 28, 28);
  const input = [];
  for (let i = 0; i < 784; i++) {
    input.push(data.data[i * 4] / 255);
  }
  return input;
}

function runDrawPrediction() {
  const canvases = window.modelCanvases;
  if (!canvases?.w1) return;
  const input = getDrawCanvasInput();
  if (!input) return;
  const out = forwardFromCanvases(canvases, input);
  const maxIdx = out.reduce((best, p, i) => p > out[best] ? i : best, 0);
  const table = document.getElementById('drawResultTable');
  if (!table) return;
  const outPct = out.map((p, i) => ({ digit: i, pct: (p * 100).toFixed(1) }));
  table.innerHTML = `
    <p class="viz-label">Распознано: ${maxIdx}</p>
    <table class="viz-table">
      <tr><th>Цифра</th>${[0,1,2,3,4,5,6,7,8,9].map(d=>`<td>${d}</td>`).join('')}</tr>
      <tr><th>%</th>${outPct.map((o,i)=>`<td class="${i===maxIdx?'viz-table-max':''}">${o.pct}%</td>`).join('')}</tr>
    </table>`;
}

function scheduleDrawPrediction() {
  if (drawThrottleTimer) return;
  drawThrottleTimer = setTimeout(() => {
    drawThrottleTimer = null;
    runDrawPrediction();
  }, DRAW_THROTTLE_MS);
}

function clearDrawCanvas() {
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 28, 28);
  scheduleDrawPrediction();
}

function initDrawCanvas() {
  const canvas = document.getElementById('drawCanvas');
  const clearBtn = document.getElementById('drawClearBtn');
  const accordionHeader = document.getElementById('drawAccordionHeader');
  const accordionBody = document.getElementById('drawAccordionBody');

  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 28, 28);

  function getCoord(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 28 / rect.width;
    const scaleY = 28 / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY)
    };
  }

  function drawAt(x, y) {
    ctx.fillStyle = '#fff';
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const px = x + dx, py = y + dy;
        if (px >= 0 && px < 28 && py >= 0 && py < 28) ctx.fillRect(px, py, 1, 1);
      }
    scheduleDrawPrediction();
  }

  function onPointerDown(e) {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getCoord(e);
    drawAt(x, y);
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoord(e);
    drawAt(x, y);
  }

  function onPointerUp(e) {
    e.preventDefault();
    isDrawing = false;
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerUp);

  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp, { passive: false });

  if (clearBtn) clearBtn.addEventListener('click', clearDrawCanvas);

  if (accordionHeader && accordionBody) {
    accordionHeader.addEventListener('click', () => {
      const parent = accordionHeader.closest('.draw-accordion');
      if (parent) parent.classList.toggle('expanded');
    });
  }
}

document.addEventListener('DOMContentLoaded', initDrawCanvas);
