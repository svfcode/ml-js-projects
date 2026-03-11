function showToast(msg, duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('toast-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.classList.remove('toast-visible');
  }, duration);
}

function log(msg, isError = false) {
  const s = document.getElementById('status');
  s.innerHTML = `<span class="${isError ? 'error' : 'log'}">${msg}</span><br>` + s.innerHTML;
  s.scrollTop = 0;
}

function setProgress(pct) {
  document.getElementById('progressFill').style.width = pct + '%';
}

function showResults(accuracy) {
  const results = document.getElementById('results');
  results.innerHTML = `<h3>Результат</h3><p>Точность на тестовой выборке: <strong>${(accuracy * 100).toFixed(2)}%</strong></p>`;
  results.classList.add('visible');
}

function resetUI() {
  document.getElementById('status').innerHTML = '';
  document.getElementById('status').style.color = '';
  document.getElementById('results').classList.remove('visible');
  setProgress(0);
}

function setTrainingState(isTraining) {
  const oneBtn = document.getElementById('trainOneBtn');
  const batchBtn = document.getElementById('trainBatchBtn');
  const autoBtn = document.getElementById('trainAutoBtn');
  if (oneBtn) oneBtn.disabled = isTraining;
  if (batchBtn) batchBtn.disabled = isTraining;
  if (autoBtn) autoBtn.disabled = isTraining;
}

function setAutoTrainingState(isActive) {
  const oneBtn = document.getElementById('trainOneBtn');
  const batchBtn = document.getElementById('trainBatchBtn');
  const autoBtn = document.getElementById('trainAutoBtn');
  const autoEpochsBtn = document.getElementById('trainAutoEpochsBtn');
  const epochsWrap = document.querySelector('.epochs-label');
  const stopBtn = document.getElementById('trainAutoStopBtn');
  const progressEl = document.getElementById('autoTrainProgress');
  if (oneBtn) oneBtn.disabled = isActive;
  if (batchBtn) batchBtn.disabled = isActive;
  if (autoBtn) {
    autoBtn.style.display = isActive ? 'none' : '';
    autoBtn.disabled = isActive;
  }
  if (autoEpochsBtn) {
    autoEpochsBtn.style.display = isActive ? 'none' : '';
    autoEpochsBtn.disabled = isActive;
  }
  if (epochsWrap) epochsWrap.style.display = isActive ? 'none' : '';
  if (stopBtn) {
    stopBtn.style.display = isActive ? '' : 'none';
    stopBtn.disabled = !isActive;
  }
  if (progressEl) progressEl.style.display = isActive ? '' : 'none';
  if (!isActive && progressEl) progressEl.textContent = '';
}

function setAutoTrainingProgress(current, total, epochCurrent, epochTotal) {
  const el = document.getElementById('autoTrainProgress');
  if (!el) return;
  if (epochCurrent != null && epochTotal != null) {
    el.textContent = `Эпоха ${epochCurrent}/${epochTotal}, батч ${current}/${total}`;
  } else {
    el.textContent = `Батч ${current} / ${total}`;
  }
}

function initModeSwitch() {
  document.querySelectorAll('input[name="mode"]').forEach(el => {
    el.addEventListener('change', () => {
      document.getElementById('samplesInfo').textContent = SAMPLES_INFO[el.value];
    });
  });
}
