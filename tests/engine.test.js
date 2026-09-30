/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

// Behavioural tests for the pure analysis engine (DBP.analyze / DBP.ddlFor).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDBP, stateFrom } = require('./helpers/load-dbp');

const D = loadDBP();
const analyze = (base, ids) => D.analyze(stateFrom(D, base, ids));
const levels = (r, lvl) => r.checks.filter((c) => c.lvl === lvl).map((c) => c.t);

test('an empty stack has no engine, zero scores and a prompt to add one', () => {
  const r = analyze('pg', []);
  assert.equal(r.engine, null);
  assert.equal(r.score, 0);
  assert.equal(r.grade, '–');
  assert.ok(Object.values(r.scores).every((v) => v === 0));
  assert.ok(levels(r, 'info').some((t) => t.includes('table engine')));
});

test('scores are always clamped to 0..100', () => {
  const r = analyze('pg', ['pg_heap', 'pg_unlogged', 'pg_fsyncoff', 'pg_synccommit', 'pg_fpwoff']);
  for (const [k, v] of Object.entries(r.scores)) assert.ok(v >= 0 && v <= 100, `${k}=${v}`);
  assert.equal(r.scores.durability, 0);
  assert.equal(r.scores.writes, 100);
});

test('a component with an unmet prerequisite is inactive and reported as an error', () => {
  const r = analyze('pg', ['pg_heap', 'pg_hnsw']);
  assert.ok(r.inactive.has('pg_hnsw'));
  assert.equal(r.scores.vector, 0, 'inactive components contribute nothing');
  assert.ok(levels(r, 'error').some((t) => t.includes('vector or halfvec')));

  const fixed = analyze('pg', ['pg_heap', 'pg_halfvec', 'pg_hnsw']);
  assert.ok(!fixed.inactive.has('pg_hnsw'));
  assert.ok(fixed.scores.vector >= 65);
});

test('an engine-specific component on the wrong engine is inactive', () => {
  const r = analyze('pg', ['pg_columnar', 'pg_gin', 'pg_jsonb']);
  assert.ok(r.inactive.has('pg_gin'));
  assert.ok(levels(r, 'error').some((t) => t.includes("doesn't apply")));
});

test('conflicting components are both flagged', () => {
  const r = analyze('pg', ['pg_heap', 'pg_walminimal', 'pg_wallogical']);
  assert.ok(r.inactive.has('pg_walminimal'));
  assert.ok(r.errors >= 1);
});

test('dangerous settings are penalised harder than errors', () => {
  const safe = analyze('pg', ['pg_heap', 'pg_btree']);
  const risky = analyze('pg', ['pg_heap', 'pg_btree', 'pg_fsyncoff']);
  assert.equal(risky.dangers, 1);
  assert.ok(risky.score < safe.score);
});

test('synergies add capability when both parts are active', () => {
  const without = analyze('pg', ['pg_heap', 'pg_postgis']);
  const withGist = analyze('pg', ['pg_heap', 'pg_postgis', 'pg_gist']);
  assert.equal(withGist.scores.geo - without.scores.geo, 5 + 25, 'GiST fx + PostGIS synergy');
});

test('MySQL-family components narrow the list of distributions', () => {
  const r = analyze('my', ['my_myrocks', 'my_btree']);
  assert.deepEqual(r.flavors.map((f) => f.split(' ')[0]).sort(), ['MariaDB', 'Percona']);

  const impossible = analyze('my', ['my_myrocks', 'my_heatwave']);
  assert.equal(impossible.flavors.length, 0);
  assert.ok(levels(impossible, 'error').some((t) => t.includes('No single MySQL distribution')));
});

test('workload fit ranks the obvious workload first', () => {
  const ts = analyze('pg', ['pg_timescale', 'pg_brin', 'pg_walcomp']);
  assert.equal(ts.fits[0].w.id, 'timeseries');

  const rag = analyze('pg', D.PRESETS.pg.find((p) => p.n.includes('RAG')).ids);
  assert.equal(rag.fits[0].w.id, 'rag');
});

test('grades follow the documented thresholds', () => {
  const r = analyze('pg', D.PRESETS.pg[0].ids);
  const expected = r.score >= 90 ? 'S' : r.score >= 80 ? 'A' : r.score >= 65 ? 'B' : r.score >= 50 ? 'C' : 'D';
  assert.equal(r.grade, expected);
});

test('ddlFor injects the engine clause and post-create statements', () => {
  const r = analyze('pg', ['pg_timescale']);
  const w = D.WORKLOADS.find((x) => x.id === 'timeseries');
  const ddl = D.ddlFor(w, r);
  assert.ok(!ddl.includes('{{engine}}'));
  assert.ok(ddl.includes('create_hypertable'));

  const my = analyze('my', ['my_myrocks']);
  assert.ok(D.ddlFor(D.WORKLOADS[0], my).includes('ENGINE=ROCKSDB'));
});

test('generated config lists preload libraries and SQL for active components', () => {
  const r = analyze('pg', ['pg_heap', 'pg_halfvec', 'pg_hnsw', 'pg_statstatements']);
  assert.match(r.config, /shared_preload_libraries/);
  assert.match(r.config, /-- ── SQL ──/);
});
