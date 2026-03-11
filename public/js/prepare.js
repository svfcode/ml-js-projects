let isPreparing = false;

async function updatePrepareBtnText() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'tiny';
  const btn = document.getElementById('prepareBtn');
  if (!btn) return;
  try {
    const res = await fetch(`/api/prepared-list?mode=${mode}`);
    const data = await res.json();
    const hasData = (data.files?.length || 0) > 0;
    btn.textContent = hasData ? 'Пересоздать данные' : 'Приготовить данные';
  } catch {
    btn.textContent = 'Приготовить данные';
  }
}

async function prepareData() {
  if (isPreparing) return;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const btn = document.getElementById('prepareBtn');

  isPreparing = true;
  btn.disabled = true;
  log(`Приготовление данных (${mode})...`);

  try {
    const res = await fetch(`/api/prepare-data?mode=${mode}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    const skip = data.skipped ? `, пропущено ${data.skipped}` : '';
    log(`Готово: ${data.count} картинок в ${data.dir} (создано ${data.written}${skip})`);
    await updatePrepareBtnText();
  } catch (err) {
    log('Ошибка: ' + err.message, true);
  } finally {
    isPreparing = false;
    btn.disabled = false;
  }
}

const MODE_STORAGE_KEY = 'mnist-mode';

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(MODE_STORAGE_KEY);
  if (saved && ['tiny', 'medium', 'full'].includes(saved)) {
    const radio = document.querySelector(`input[name="mode"][value="${saved}"]`);
    if (radio) {
      radio.checked = true;
      if (typeof SAMPLES_INFO !== 'undefined') {
        document.getElementById('samplesInfo').textContent = SAMPLES_INFO[saved];
      }
    }
  }
  updatePrepareBtnText();
  document.querySelectorAll('input[name="mode"]').forEach(el => {
    el.addEventListener('change', () => {
      localStorage.setItem(MODE_STORAGE_KEY, el.value);
      updatePrepareBtnText();
    });
  });
});
