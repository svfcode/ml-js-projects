const LOAD_INTERVAL_MS = 2000;
const LOAD_HISTORY_MAX = 60;
let loadIntervalId = null;
let loadHistory = [];
let loadChart = null;

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function getPageMemoryMb() {
  if (performance?.memory?.usedJSHeapSize != null) {
    return performance.memory.usedJSHeapSize / 1024 / 1024;
  }
  return null;
}

function getPageMemory() {
  const mb = getPageMemoryMb();
  return mb != null ? formatBytes(mb * 1024 * 1024) + ' heap' : '— (только Chrome)';
}

async function updateSystemLoad() {
  const pageHeap = getPageMemoryMb();
  document.getElementById('loadPage').textContent = getPageMemory();

  try {
    const res = await fetch('/api/system-load');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('loadCpu').textContent = `${data.cpu}% CPU`;
    document.getElementById('loadRam').textContent =
      `${formatBytes(data.ramUsed)} / ${formatBytes(data.ramTotal)} RAM`;
    document.getElementById('loadProcess').textContent =
      `${data.processHeap} МБ процесс`;

    const ramPct = data.ramTotal ? (data.ramUsed / data.ramTotal * 100) : 0;
    loadHistory.push({
      t: Date.now(),
      cpu: data.cpu,
      ramPct: Math.round(ramPct),
      process: data.processHeap,
      page: pageHeap != null ? Math.round(pageHeap * 10) / 10 : null
    });
    if (loadHistory.length > LOAD_HISTORY_MAX) loadHistory.shift();

    if (loadChart) updateLoadChart();
  } catch {
    document.getElementById('loadCpu').textContent = '— % CPU';
    document.getElementById('loadRam').textContent = '— RAM';
    document.getElementById('loadProcess').textContent = '— процесс';
  }
}

function initLoadChart() {
  const ctx = document.getElementById('loadChart').getContext('2d');
  loadChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'CPU %', data: [], borderColor: '#e94560', backgroundColor: 'rgba(233,69,96,0.1)', fill: true, tension: 0.3, yAxisID: 'y' },
        { label: 'RAM %', data: [], borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', fill: true, tension: 0.3, yAxisID: 'y' },
        { label: 'Страница МБ', data: [], borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', fill: true, tension: 0.3, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#eee', font: { size: 11 } } }
      },
      scales: {
        x: { ticks: { color: '#888', maxTicksLimit: 8 } },
        y: { position: 'left', ticks: { color: '#888' }, min: 0, max: 100 },
        y1: { position: 'right', ticks: { color: '#60a5fa' }, min: 0, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function updateLoadChart() {
  if (!loadChart || loadHistory.length === 0) return;
  const labels = loadHistory.map((_, i) => {
    const d = new Date(loadHistory[i].t);
    return d.toLocaleTimeString('ru', { minute: '2-digit', second: '2-digit' });
  });
  loadChart.data.labels = labels;
  loadChart.data.datasets[0].data = loadHistory.map(h => h.cpu);
  loadChart.data.datasets[1].data = loadHistory.map(h => h.ramPct);
  loadChart.data.datasets[2].data = loadHistory.map(h => h.page ?? 0);
  loadChart.update('none');
}

function toggleLoadAccordion() {
  const accordion = document.querySelector('.load-accordion');
  const body = document.getElementById('loadAccordionBody');
  const isOpen = accordion.classList.toggle('expanded');
  body.classList.toggle('open', isOpen);

  if (isOpen) {
    if (!loadChart) {
      setTimeout(() => {
        initLoadChart();
        if (loadHistory.length > 0) updateLoadChart();
        loadChart?.resize();
      }, 350);
    } else {
      setTimeout(() => {
        loadChart?.resize();
        updateLoadChart();
      }, 350);
    }
  }
}

function startSystemLoadUpdates() {
  if (loadIntervalId) return;
  updateSystemLoad();
  loadIntervalId = setInterval(updateSystemLoad, LOAD_INTERVAL_MS);
}

function stopSystemLoadUpdates() {
  if (loadIntervalId) {
    clearInterval(loadIntervalId);
    loadIntervalId = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  startSystemLoadUpdates();
  document.getElementById('systemLoad').addEventListener('click', toggleLoadAccordion);
});
