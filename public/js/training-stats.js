/** Сбор и отправка статистики обучения */

let statsStart = null;

function getPageHeapMb() {
  if (typeof performance !== 'undefined' && performance.memory?.usedJSHeapSize != null) {
    return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
  }
  return null;
}

async function getSystemLoad() {
  try {
    const res = await fetch('/api/system-load');
    const data = await res.json();
    return res.ok ? { cpu: data.cpu, processHeap: data.processHeap } : null;
  } catch {
    return null;
  }
}

function reportTrainingStart() {
  statsStart = {
    t: Date.now(),
    pageHeapMb: getPageHeapMb()
  };
  return statsStart;
}

async function reportTrainingEnd(entry) {
  if (!statsStart) return;
  entry.durationMs = Date.now() - statsStart.t;
  entry.pageHeapMbStart = statsStart.pageHeapMb;
  entry.pageHeapMbEnd = getPageHeapMb();
  const sysEnd = await getSystemLoad();
  if (sysEnd) {
    entry.cpuEnd = sysEnd.cpu;
    entry.processHeapMbEnd = sysEnd.processHeap;
  }
  statsStart = null;
  try {
    await fetch('/api/training-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch (_) {}
}
