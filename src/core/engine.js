/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
/* Analysis engine: turns the placed components into scores, checks, capabilities,
 * workload fit and generated config. Pure function of state — no DOM, no network. */
(function () {
  const { SLOTS, DIMS, SYNERGIES, byId, WORKLOADS, PG_VEC_IDX } = window.DBP;
  const FLAVORS = ['MySQL', 'Percona', 'MariaDB', 'HeatWave'];
  const FLAVOR_NAMES = { MySQL: 'MySQL Community 8.4 / 9.x', Percona: 'Percona Server', MariaDB: 'MariaDB', HeatWave: 'MySQL HeatWave (managed)' };
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  function analyze(state) {
    const placed = SLOTS.flatMap((s) => (state.slots[s.id] || []).map((id) => byId[id]).filter(Boolean));
    const ids = new Set(placed.map((c) => c.id));
    const has = (id) => ids.has(id);
    const hasAny = (arr) => arr.some(has);
    const engine = placed.find((c) => c.slot === 'engine') || null;

    const checks = [];
    const caps = new Set();
    const conf = [];
    const sql = [];
    const preload = [];
    const add = (lvl, t) => checks.push({ lvl, t });
    const inactive = new Set();

    const scores = Object.fromEntries(DIMS.map((d) => [d.id, 0]));
    if (engine) Object.assign(scores, engine.base);
    const apply = (fx) => Object.entries(fx || {}).forEach(([k, v]) => { scores[k] += v; });

    placed.forEach((c) => {
      let ok = true;
      if (c.needs && !hasAny(c.needs.any)) { ok = false; add('error', `${c.n} ${c.needs.msg}`); }
      if (engine && c.engines && !c.engines.includes(engine.id)) { ok = false; add('error', `${c.n} doesn't apply to the ${engine.n} engine.`); }
      (c.conflicts || []).forEach((x) => { if (has(x.id)) { ok = false; add('error', `${c.n} ✕ ${byId[x.id].n}: ${x.msg}`); } });
      if (c.note) add(c.note.lvl, c.note.t);
      if (!ok) { inactive.add(c.id); return; }
      if (c.slot !== 'engine') apply(c.fx);
      (c.caps || []).forEach((x) => caps.add(x));
      if (c.conf) conf.push(`# ${c.n}\n${c.conf}`);
      if (c.sql) sql.push(`-- ${c.n}\n${c.sql}`);
      if (c.preload && !preload.includes(c.preload)) preload.push(c.preload);
    });

    SYNERGIES.forEach((s) => {
      if (s.all.every((id) => has(id) && !inactive.has(id))) {
        apply(s.fx);
        if (s.cap) caps.add(s.cap);
      }
    });

    // ── Custom rules ──────────────────────────────────────────────
    if (!engine) add('info', 'Drop a table engine into layer 3 to bring your database to life.');
    if (state.base === 'pg') {
      if (hasAny(['pg_vector', 'pg_halfvec']) && !hasAny(PG_VEC_IDX)) add('warn', 'You store embeddings but have no vector index: every similarity query is an exact full scan. Add HNSW.');
      if (hasAny(['pg_hnsw', 'pg_ivfflat']) && !has('pg_mwm')) add('tip', 'Raise maintenance_work_mem so the vector index build fits in memory (Buffer cache layer).');
      if (has('pg_hnsw') && !hasAny(['pg_iterscan', 'pg_diskann', 'pg_partitioning'])) add('tip', 'Filtered vector queries (WHERE tenant = 42) can return fewer rows than LIMIT. Add iterative index scans.');
      if (has('pg_rrf') && !(has('pg_gin') && hasAny(['pg_tsvector', 'pg_trgm'])) && !has('pg_rum')) add('warn', 'Hybrid search needs a keyword side too: add tsvector + GIN (or RUM).');
      if (!state.slots.pooler?.length && engine && ['pg_heap', 'pg_orioledb', 'pg_timescale'].includes(engine.id)) add('tip', 'Each Postgres connection is a process. Add PgBouncer if you expect many clients.');
      if (has('pg_jit') && engine && ['pg_heap', 'pg_orioledb'].includes(engine.id) && !has('pg_parallel')) add('tip', 'Many OLTP systems set jit = off: compiling can cost more than a medium query.');
      if (has('pg_brin') && !(engine?.id === 'pg_timescale' || has('pg_partitioning'))) add('tip', 'BRIN only helps when the table is naturally ordered by the column (e.g. insert time).');
      if (engine?.id === 'pg_columnar' && hasAny(['pg_unlogged'])) add('info', 'Columnar + UNLOGGED: fine for scratch analytics, but data vanishes after a crash.');
    } else {
      if (has('my_vector') && !hasAny(['my_vidx', 'my_heatwave'])) add('warn', 'Community MySQL has the VECTOR type but no vector index, and DISTANCE() is HeatWave-only. Use MariaDB VECTOR INDEX or HeatWave.');
      if (has('my_rrf') && !has('my_fulltext')) add('warn', 'Hybrid search needs a keyword side too: add a FULLTEXT index.');
      if (engine?.id === 'my_innodb' && !has('my_bp')) add('tip', 'Size the InnoDB buffer pool (≈70–75% of RAM): the default is only 128 MB.');
    }

    // Distribution resolution (MySQL family)
    let flavors = null;
    if (state.base === 'my') {
      flavors = FLAVORS.slice();
      const need = [];
      placed.forEach((c) => {
        if (c.flavors) { flavors = flavors.filter((f) => c.flavors.includes(f)); need.push(c); }
      });
      if (!flavors.length) {
        const detail = need.map((c) => `${c.n} → ${c.flavors.join('/')}`).join('; ');
        add('error', `No single MySQL distribution ships all of these: ${detail}.`);
      }
    }

    DIMS.forEach((d) => { scores[d.id] = engine ? clamp(scores[d.id]) : 0; });

    // Workload fit
    const r0 = { has, scores };
    const fits = WORKLOADS.map((w) => {
      let fit = Object.entries(w.w).reduce((s, [k, v]) => s + v * scores[k], 0);
      const gated = w.req && !w.req(r0);
      if (gated) fit *= 0.35;
      else if (w.req) fit += 8; // has the specialised pieces this workload needs
      const dims = Object.entries(w.w).map(([k, wt]) => ({ k, v: scores[k], c: wt * scores[k] }));
      const strong = dims.slice().sort((a, b) => b.c - a.c)[0];
      const weak = dims.slice().sort((a, b) => a.v - b.v)[0];
      return { w, fit: engine ? clamp(fit) : 0, gated, strong, weak };
    }).sort((a, b) => b.fit - a.fit);

    const errors = checks.filter((c) => c.lvl === 'error').length;
    const dangers = checks.filter((c) => c.lvl === 'danger').length;
    const best = fits[0]?.fit || 0;
    const score = engine ? clamp(best - errors * 8 - dangers * 12) : 0;
    const grade = !engine ? '–' : score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';

    // Config output
    const lines = [];
    const isPg = state.base === 'pg';
    lines.push(isPg ? '# ── postgresql.conf ──' : '# ── my.cnf ──\n[mysqld]');
    if (isPg && preload.length) lines.push(`shared_preload_libraries = '${preload.join(',')}'   # restart`);
    if (!isPg && engine && !(engine.conf || '').includes('default-storage-engine')) lines.push(`default_storage_engine = ${engine.clause.replace('ENGINE=', '')}`);
    conf.forEach((c) => lines.push(c));
    if (sql.length) { lines.push('', '-- ── SQL ──'); sql.forEach((s) => lines.push(s)); }
    const config = engine ? lines.join('\n') : '';

    const order = { danger: 0, error: 1, warn: 2, info: 3, tip: 4 };
    checks.sort((a, b) => order[a.lvl] - order[b.lvl]);

    return {
      base: state.base, engine, placed, has, inactive, scores, checks, caps: [...caps], fits, score, grade, errors, dangers, config,
      flavors: flavors && flavors.map((f) => FLAVOR_NAMES[f]),
      filledSlots: SLOTS.filter((s) => (state.slots[s.id] || []).length).length,
      countIn: (slot) => (state.slots[slot] || []).length,
    };
  }

  function ddlFor(workload, result) {
    const e = result.engine;
    let clause = e && e.clause ? ' ' + e.clause : '';
    let ddl = workload.ddl[result.base].replace('{{engine}}', clause);
    if (e && e.post) ddl += '\n' + e.post.replace('{{table}}', workload.table);
    return ddl;
  }

  window.DBP.analyze = analyze;
  window.DBP.ddlFor = ddlFor;
})();
