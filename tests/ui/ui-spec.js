/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Browser UI spec. Injected after src/ui/app.js by run-ui-tests.mjs and executed
 * in headless Chrome. Results are appended to the page as a TESTLOG <pre> of PASS/FAIL lines.
 */
(function () {
  'use strict';

  const results = [];
  const expect = (condition, name) => results.push(`${condition ? 'PASS' : 'FAIL'} ${name}`);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const chip = (name) => $$('#palette .chip').find((c) => c.textContent.includes(name));
  const slot = (id) => $(`.slot[data-slot="${id}"]`);
  const saved = () => JSON.parse(localStorage.getItem('dbp-playground-v1'));
  const button = (root, text) => $$('button', root).find((b) => b.textContent.includes(text));

  function dragAndDrop(source, target) {
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
  }

  window.confirm = () => true; // auto-accept "switching family clears your stack"

  // ── Building a stack ────────────────────────────────────────────────
  expect($('.empty-state'), 'empty analysis state is shown');
  expect($('.back').hidden, 'hub back-link is hidden when not opened from the hub');

  dragAndDrop(chip('PgBouncer'), slot('engine'));
  expect($('#statMistakes').textContent.includes('1'), 'wrong-layer drop is counted as a miss');
  expect(!slot('engine').textContent.includes('PgBouncer'), 'wrong-layer drop is rejected');

  dragAndDrop(chip('PgBouncer'), slot('pooler'));
  expect(slot('pooler').textContent.includes('PgBouncer'), 'correct-layer drop places the component');

  chip('heap').click();
  expect(slot('engine').textContent.includes('heap'), 'click-to-add places a component');
  expect($('.summary'), 'analysis renders once an engine is present');

  dragAndDrop(chip('TimescaleDB'), slot('engine'));
  expect(slot('engine').textContent.includes('TimescaleDB') && !$('.pchip', slot('engine')).textContent.includes('heap'),
    'single-slot layer swaps the engine');

  chip('pgvector HNSW').click();
  expect($('.pchip.inactive', slot('index')), 'HNSW without a vector type is marked inactive');
  expect($$('.checks li.error').some((li) => li.textContent.includes('vector or halfvec')), 'prerequisite error is listed');
  chip('halfvec').click();
  expect(!$('.pchip.inactive', slot('index')), 'HNSW becomes active once halfvec is added');

  dragAndDrop($('.pchip', slot('pooler')), $('.palette-col'));
  expect(!slot('pooler').textContent.includes('PgBouncer'), 'dragging back to the palette removes a component');
  $('.pchip button', slot('index')).click();
  expect(!slot('index').textContent.includes('HNSW'), 'the × button removes a component');

  // ── Theme, analysis tabs and persistence ────────────────────────────
  const themeBefore = document.documentElement.dataset.theme;
  $('#themeBtn').click();
  expect(document.documentElement.dataset.theme !== themeBefore, 'theme toggles');

  $('.tabs button[data-tab="data"]').click();
  expect($$('.fit').length >= 1, 'best-fit workload cards are shown');
  expect($('.tab-body table tbody tr'), 'sample rows are rendered');
  expect($('.tab-body pre').textContent.includes('create_hypertable'), 'TimescaleDB DDL contains create_hypertable');
  expect(saved().slots.engine[0] === 'pg_timescale', 'state is persisted to localStorage');

  // ── Colour coding and guidance ──────────────────────────────────────
  const colorOf = (el) => getComputedStyle(el).getPropertyValue('--c').trim();
  expect(window.DBP.SLOTS.every((s) => colorOf($(`.group[data-slot="${s.id}"]`)) === colorOf(slot(s.id))),
    'palette group colours match stack slot colours');

  const dt = new DataTransfer();
  const dragged = chip('PgBouncer');
  dragged.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  expect(slot('pooler').classList.contains('target') && document.body.classList.contains('guide'),
    'guide mode highlights the matching layer while dragging');
  dragged.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  expect(!$('.slot.target'), 'highlight is cleared on dragend');

  $('.group[data-slot="wal"] .group-head').click();
  expect($('.group[data-slot="wal"]').classList.contains('open'), 'accordion opens a palette group');
  $('.slot-head', slot('storage')).click();
  expect($('.group[data-slot="storage"]').classList.contains('open'), 'clicking a layer opens its palette group');

  // ── Missions ────────────────────────────────────────────────────────
  const D = window.DBP;
  const dlg = $('#missionDlg');
  expect(D.MISSIONS.length >= 20, `mission catalogue has ${D.MISSIONS.length} case studies`);

  button($('#mission'), 'Case study').click();
  expect(dlg.open, 'mission board dialog opens');
  expect($$('.mcard', dlg).length === D.MISSIONS.length, 'board lists every mission');

  button($('.seg.fams', dlg), 'MySQL').click();
  expect($$('.mcard', dlg).length === D.MISSIONS.filter((m) => m.family === 'my').length, 'family filter narrows the list');

  $('.mcard[data-id="warm"]', dlg).click();
  expect($('.cs-head h3', dlg).textContent.includes('Cold cache'), 'selecting a card shows its case study');
  expect($$('.cs-sec', dlg).length >= 4 && $('.cs-quote', dlg), 'case study sections and quote are rendered');

  expect($('.cs-q.locked', dlg), 'the question is hidden initially');
  $('.cs-q.locked', dlg).click();
  expect(!$('.cs-q.locked', dlg) && $('.cs-q', dlg).textContent.includes('Question'), 'the question can be revealed');

  button($('.hint-row', dlg), 'goals').click();
  expect($('.goal-list', dlg) && saved().hints.warm === 1, 'revealing goals records a hint');

  button($('.cs-foot', dlg), 'Start').click();
  expect(!dlg.open && $('#baseSeg button.on').dataset.base === 'my', 'starting a MySQL mission switches family');
  expect($$('#mission .checkpills li:not(.secret)').length > 0, 'goal pills are visible after the hint');

  $('#mission .btn.primary').click();
  button($('.hint-row', dlg), 'answer').click();
  expect($('.answer', dlg), 'reference answer is shown');
  $('.answer .btn', dlg).click();
  expect(saved().completed.includes('warm') && saved().stars.warm === 1, 'loading the answer completes the mission with 1 star');
  expect($('#mission.done'), 'mission card shows completion');

  $('#mission .btn.primary').click();
  $$('.cs-foot button', dlg).find((b) => b.textContent === 'Free play').click();
  expect($('#mission.free'), 'free play mode can be selected');

  const pre = document.createElement('pre');
  pre.id = 'TESTLOG';
  pre.textContent = results.join('\n');
  document.body.append(pre);
})();