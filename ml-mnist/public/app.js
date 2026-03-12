initModeSwitch();
initBatchNav();

document.getElementById('batchAccordionHeader').addEventListener('click', () => {
  document.querySelector('.batch-accordion').classList.toggle('expanded');
});
