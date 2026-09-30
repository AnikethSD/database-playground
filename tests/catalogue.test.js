/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

// Integrity tests for the component catalogue, workloads and presets.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDBP, stateFrom } = require('./helpers/load-dbp');

const D = loadDBP();
const DIM_IDS = new Set(D.DIMS.map((d) => d.id));
const SLOT_IDS = new Set(D.SLOTS.map((s) => s.id));

test('has 8 colour-coded layers with exactly one required slot', () => {
  assert.equal(D.SLOTS.length, 8);
  for (const s of D.SLOTS) assert.match(s.color, /^#[0-9a-f]{6}$/i, `slot ${s.id} colour`);
  assert.deepEqual(D.SLOTS.filter((s) => s.required).map((s) => s.id), ['engine']);
});

test('component ids are unique and prefixed by database family', () => {
  const seen = new Set();
  for (const c of D.COMPONENTS) {
    assert.ok(!seen.has(c.id), `duplicate id ${c.id}`);
    seen.add(c.id);
    assert.ok(['pg', 'my'].includes(c.b), `${c.id} family`);
    assert.ok(c.id.startsWith(`${c.b}_`), `${c.id} prefix`);
    assert.ok(SLOT_IDS.has(c.slot), `${c.id} slot ${c.slot}`);
    assert.ok(c.n && c.d, `${c.id} needs a name and description`);
  }
  assert.ok(D.COMPONENTS.length >= 100, `catalogue size ${D.COMPONENTS.length}`);
});

test('engines define a full base score; other components only use known dimensions', () => {
  for (const c of D.COMPONENTS) {
    if (c.slot === 'engine') {
      assert.ok(c.base, `${c.id} base`);
      for (const k of DIM_IDS) assert.equal(typeof c.base[k], 'number', `${c.id} base.${k}`);
      assert.equal(typeof c.clause, 'string', `${c.id} DDL clause`);
    }
    for (const k of Object.keys(c.fx || {})) assert.ok(DIM_IDS.has(k), `${c.id} fx.${k}`);
  }
});

test('needs / engines / conflicts reference components of the same family', () => {
  for (const c of D.COMPONENTS) {
    const refs = [...(c.needs ? c.needs.any : []), ...(c.engines || []), ...(c.conflicts || []).map((x) => x.id)];
    for (const id of refs) {
      const ref = D.byId[id];
      assert.ok(ref, `${c.id} references unknown ${id}`);
      assert.equal(ref.b, c.b, `${c.id} references other-family ${id}`);
    }
    for (const e of c.engines || []) assert.equal(D.byId[e].slot, 'engine', `${c.id}.engines → ${e}`);
  }
});

test('every workload has weights summing to 1 and sample data matching its columns', () => {
  for (const w of D.WORKLOADS) {
    const sum = Object.values(w.w).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${w.id} weights sum ${sum}`);
    for (const k of Object.keys(w.w)) assert.ok(DIM_IDS.has(k), `${w.id} weight ${k}`);
    for (const row of w.rows) assert.equal(row.length, w.cols.length, `${w.id} row width`);
    assert.ok(w.ddl.pg.includes('{{engine}}') && w.ddl.my.includes('{{engine}}'), `${w.id} DDL placeholder`);
  }
});

test('every preset loads without configuration errors', () => {
  for (const base of ['pg', 'my']) {
    for (const p of D.PRESETS[base]) {
      const r = D.analyze(stateFrom(D, base, p.ids));
      const errs = r.checks.filter((c) => c.lvl === 'error' || c.lvl === 'danger').map((c) => c.t);
      assert.deepEqual(errs, [], `${base} preset "${p.n}"`);
      assert.ok(r.engine, `${base} preset "${p.n}" has an engine`);
    }
  }
});
