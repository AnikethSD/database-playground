/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

// Content and solvability tests for the case-study missions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDBP, stateFrom } = require('./helpers/load-dbp');

const D = loadDBP();
const words = (s) => s.split(/\s+/).filter(Boolean).length;

test('there are at least 20 missions with unique ids', () => {
  assert.ok(D.MISSIONS.length >= 20, `found ${D.MISSIONS.length}`);
  assert.equal(new Set(D.MISSIONS.map((m) => m.id)).size, D.MISSIONS.length);
});

for (const m of D.MISSIONS) {
  test(`mission "${m.id}" is well-formed`, () => {
    assert.ok(D.MISSION_CATS[m.cat], `category ${m.cat}`);
    assert.ok(D.MISSION_LEVELS[m.lvl], `level ${m.lvl}`);
    assert.ok(['pg', 'my', 'any'].includes(m.family), `family ${m.family}`);
    for (const f of ['icon', 'n', 'co', 'brief', 'q', 'debrief']) assert.ok(m[f], `missing ${f}`);
    assert.ok(m.story.length >= 2 && m.reqs.length >= 3 && m.env.length >= 3, 'story / requirements / environment');
    assert.ok(m.quote && m.quote.who && m.quote.t, 'executive quote');
    assert.ok(m.checks.length >= 3, 'at least 3 hidden goals');

    const caseStudy = [...m.story, ...m.env, ...m.reqs, m.quote.t, m.q].join(' ');
    assert.ok(words(caseStudy) >= 200, `case study is only ${words(caseStudy)} words`);
  });

  test(`mission "${m.id}" is solvable by its reference answer`, () => {
    const fams = Object.keys(m.answer);
    assert.ok(fams.length >= 1, 'has a reference answer');
    if (m.family !== 'any') assert.deepEqual(fams, [m.family], 'answer matches mission family');
    for (const fam of fams) {
      const r = D.analyze(stateFrom(D, fam, m.answer[fam]));
      const failed = m.checks.filter((c) => !c.f(r)).map((c) => c.t);
      assert.deepEqual(failed, [], `${fam} answer fails goals`);
      assert.equal(r.errors, 0, `${fam} answer has configuration errors`);
    }
  });
}

test('the obvious traps fail the missions that warn about them', () => {
  const byId = Object.fromEntries(D.MISSIONS.map((m) => [m.id, m]));
  const fails = (id, base, ids) => {
    const r = D.analyze(stateFrom(D, base, ids));
    return byId[id].checks.some((c) => !c.f(r));
  };
  // Checkout: synchronous_commit = off breaks the "never lose an order" requirement.
  assert.ok(fails('checkout', 'pg', [...byId.checkout.answer.pg, 'pg_synccommit']));
  // Bulk load: fsync = off is the "nuclear option" the story rules out.
  assert.ok(fails('bulk', 'pg', [...byId.bulk.answer.pg, 'pg_fsyncoff']));
  // Harborline: full_page_writes = off removes torn-page protection.
  assert.ok(fails('harbor', 'pg', [...byId.harbor.answer.pg, 'pg_fpwoff']));
  // Coinvault: relaxed flushing violates RPO = 0.
  assert.ok(fails('ledger', 'my', [...byId.ledger.answer.my, 'my_flush2']));
});
