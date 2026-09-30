/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
/* Workload archetypes (with sample data), achievements and presets. Missions live in missions.js. */
(function () {
  const has = (r, ...ids) => ids.some((id) => r.has(id));

  const WORKLOADS = [
    {
      id: 'oltp', icon: '🛒', n: 'Transactional app data', blurb: 'Orders, users, payments: many small reads and writes that must never be lost.',
      w: { oltp: 0.4, durability: 0.3, concurrency: 0.2, writes: 0.1 },
      table: 'orders',
      ddl: {
        pg: 'CREATE TABLE orders (\n  order_id    bigint PRIMARY KEY,\n  customer_id bigint NOT NULL,\n  status      text   NOT NULL,\n  total       numeric(10,2),\n  created_at  timestamptz DEFAULT now()\n){{engine}};',
        my: 'CREATE TABLE orders (\n  order_id    BIGINT PRIMARY KEY,\n  customer_id BIGINT NOT NULL,\n  status      VARCHAR(16) NOT NULL,\n  total       DECIMAL(10,2),\n  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP\n){{engine}};',
      },
      cols: ['order_id', 'customer_id', 'status', 'total', 'created_at'],
      rows: [
        [10231, 88, 'paid', '129.90', '2026-09-29 10:02'],
        [10232, 17, 'pending', '18.50', '2026-09-29 10:02'],
        [10233, 88, 'shipped', '342.00', '2026-09-29 10:03'],
        [10234, 409, 'refunded', '59.99', '2026-09-29 10:05'],
      ],
    },
    {
      id: 'analytics', icon: '📊', n: 'Analytics & reporting', blurb: 'Wide fact tables scanned and aggregated by dashboards.',
      w: { analytics: 0.55, efficiency: 0.25, tiering: 0.1, concurrency: 0.1 },
      table: 'page_views',
      ddl: {
        pg: 'CREATE TABLE page_views (\n  day     date,\n  country text,\n  device  text,\n  views   bigint,\n  avg_ms  int\n){{engine}};',
        my: 'CREATE TABLE page_views (\n  day     DATE,\n  country CHAR(2),\n  device  VARCHAR(16),\n  views   BIGINT,\n  avg_ms  INT\n){{engine}};',
      },
      cols: ['day', 'country', 'device', 'views', 'avg_ms'],
      rows: [
        ['2026-09-28', 'IN', 'mobile', '1,204,332', 412],
        ['2026-09-28', 'US', 'desktop', '883,120', 298],
        ['2026-09-28', 'DE', 'mobile', '311,904', 377],
        ['2026-09-29', 'IN', 'mobile', '1,251,870', 405],
      ],
    },
    {
      id: 'timeseries', icon: '📈', n: 'Time-series & IoT metrics', blurb: 'Append-heavy readings, queried by time range, old data compressed or dropped.',
      w: { timeseries: 0.4, writes: 0.25, efficiency: 0.2, analytics: 0.15 },
      table: 'metrics',
      ddl: {
        pg: 'CREATE TABLE metrics (\n  ts        timestamptz NOT NULL,\n  device_id int         NOT NULL,\n  metric    text,\n  value     double precision\n){{engine}};',
        my: 'CREATE TABLE metrics (\n  ts        DATETIME(3) NOT NULL,\n  device_id INT NOT NULL,\n  metric    VARCHAR(32),\n  value     DOUBLE\n){{engine}};',
      },
      cols: ['ts', 'device_id', 'metric', 'value'],
      rows: [
        ['2026-09-30 04:00:00.120', 7001, 'temp_c', 21.4],
        ['2026-09-30 04:00:00.180', 7002, 'temp_c', 22.9],
        ['2026-09-30 04:00:01.004', 7001, 'humidity', 48.2],
        ['2026-09-30 04:00:01.090', 7003, 'co2_ppm', 611],
      ],
    },
    {
      id: 'documents', icon: '📄', n: 'JSON documents & catalogs', blurb: 'Semi-structured product or profile documents queried by nested fields.',
      w: { search: 0.4, oltp: 0.3, durability: 0.2, concurrency: 0.1 },
      req: (r) => has(r, 'pg_jsonb', 'my_json'), reqMsg: 'needs a JSON / jsonb column type',
      table: 'products',
      ddl: {
        pg: 'CREATE TABLE products (\n  id  bigint PRIMARY KEY,\n  doc jsonb NOT NULL\n){{engine}};',
        my: 'CREATE TABLE products (\n  id  BIGINT PRIMARY KEY,\n  doc JSON NOT NULL\n){{engine}};',
      },
      cols: ['id', 'doc'],
      rows: [
        [1, '{"name":"Trail shoe","tags":["running","waterproof"],"price":89}'],
        [2, '{"name":"Rain jacket","tags":["hiking"],"sizes":["S","M","L"]}'],
        [3, '{"name":"Headlamp","tags":["camping","usb-c"],"lumens":400}'],
      ],
    },
    {
      id: 'search', icon: '🔎', n: 'Full-text & fuzzy search', blurb: 'Articles, tickets or product names searched by words, with ranking.',
      w: { search: 0.6, oltp: 0.2, concurrency: 0.2 },
      req: (r) => (r.has('pg_gin') && has(r, 'pg_tsvector', 'pg_trgm')) || r.has('pg_rum') || r.has('my_fulltext'), reqMsg: 'needs an indexed text search (GIN + tsvector/pg_trgm, RUM, or FULLTEXT)',
      table: 'articles',
      ddl: {
        pg: "CREATE TABLE articles (\n  id    bigint PRIMARY KEY,\n  title text,\n  body  text,\n  tsv   tsvector GENERATED ALWAYS AS\n        (to_tsvector('english', title || ' ' || body)) STORED\n){{engine}};",
        my: 'CREATE TABLE articles (\n  id    BIGINT PRIMARY KEY,\n  title VARCHAR(200),\n  body  TEXT,\n  FULLTEXT (title, body)\n){{engine}};',
      },
      cols: ['id', 'title', 'body'],
      rows: [
        [501, 'Tuning autovacuum on big tables', 'Lower the scale factor per table so vacuum keeps up…'],
        [502, 'Why is my query slow?', 'Start with pg_stat_statements and EXPLAIN (ANALYZE, BUFFERS)…'],
        [503, 'Choosing a primary key', 'Random UUIDs split pages all over the B-tree…'],
      ],
    },
    {
      id: 'geo', icon: '🗺️', n: 'Geo & bookings', blurb: 'Stores near me, delivery zones, "no overlapping bookings".',
      w: { geo: 0.6, oltp: 0.2, durability: 0.2 },
      req: (r) => has(r, 'pg_postgis', 'pg_ranges', 'my_geo'), reqMsg: 'needs PostGIS, range types or spatial types',
      table: 'stores',
      ddl: {
        pg: 'CREATE TABLE stores (\n  id       bigint PRIMARY KEY,\n  name     text,\n  location geography(Point, 4326)\n){{engine}};',
        my: 'CREATE TABLE stores (\n  id       BIGINT PRIMARY KEY,\n  name     VARCHAR(100),\n  location POINT NOT NULL SRID 4326\n){{engine}};',
      },
      cols: ['id', 'name', 'location'],
      rows: [
        [1, 'Indiranagar', 'POINT(77.6408 12.9784)'],
        [2, 'Koramangala', 'POINT(77.6271 12.9352)'],
        [3, 'Whitefield', 'POINT(77.7500 12.9698)'],
      ],
    },
    {
      id: 'rag', icon: '🤖', n: 'RAG & vector search', blurb: 'Document chunks with embeddings for semantic search and LLM prompts.',
      w: { vector: 0.6, search: 0.25, concurrency: 0.1, oltp: 0.05 },
      req: (r) => has(r, ...window.DBP.PG_VEC_IDX, 'my_vidx', 'my_heatwave'), reqMsg: 'needs a vector index (HNSW, IVFFlat, DiskANN, VectorChord, MariaDB VECTOR INDEX) or HeatWave',
      table: 'chunks',
      ddl: {
        pg: 'CREATE TABLE chunks (\n  id        bigserial PRIMARY KEY,\n  tenant_id int  NOT NULL,\n  content   text NOT NULL,\n  embedding halfvec(1536) NOT NULL\n){{engine}};',
        my: 'CREATE TABLE chunks (\n  id        BIGINT AUTO_INCREMENT PRIMARY KEY,\n  tenant_id INT  NOT NULL,\n  content   TEXT NOT NULL,\n  embedding VECTOR(1536) NOT NULL\n){{engine}};',
      },
      cols: ['id', 'tenant_id', 'content', 'embedding'],
      rows: [
        [1, 42, 'Refunds are processed within 5 business days…', '[0.012, -0.044, 0.091, … ×1536]'],
        [2, 42, 'To reset your password, open Settings → Security…', '[0.087, 0.003, -0.020, … ×1536]'],
        [3, 7, 'Our SLA guarantees 99.95% monthly uptime…', '[-0.031, 0.066, 0.014, … ×1536]'],
      ],
    },
    {
      id: 'staging', icon: '⚡', n: 'Staging & bulk ETL', blurb: 'Raw loads you can re-run: speed matters more than crash safety.',
      w: { writes: 0.7, analytics: 0.2, efficiency: 0.1 },
      table: 'raw_events',
      ddl: {
        pg: 'CREATE UNLOGGED TABLE raw_events (\n  line_no bigint,\n  source  text,\n  payload text\n){{engine}};\n-- COPY raw_events FROM \'/data/events.csv\' (FORMAT csv);',
        my: "CREATE TABLE raw_events (\n  line_no BIGINT,\n  source  VARCHAR(32),\n  payload TEXT\n){{engine}};\n-- LOAD DATA INFILE '/data/events.csv' INTO TABLE raw_events;",
      },
      cols: ['line_no', 'source', 'payload'],
      rows: [
        [1, 'web', '2026-09-29T23:59:58Z,click,/pricing,u_8812'],
        [2, 'ios', '2026-09-29T23:59:59Z,view,/home,u_1203'],
        [3, 'web', '2026-09-30T00:00:00Z,signup,/join,u_9931'],
      ],
    },
    {
      id: 'archive', icon: '🧊', n: 'Cold archive & lakehouse', blurb: 'Years of history kept cheaply, rarely read, still queryable.',
      w: { tiering: 0.5, efficiency: 0.4, analytics: 0.1 },
      table: 'audit_log_2019',
      ddl: {
        pg: 'CREATE TABLE audit_log_2019 (\n  id     bigint,\n  actor  text,\n  action text,\n  at     timestamptz\n){{engine}};',
        my: 'CREATE TABLE audit_log_2019 (\n  id     BIGINT,\n  actor  VARCHAR(64),\n  action VARCHAR(64),\n  at     DATETIME\n){{engine}};',
      },
      cols: ['id', 'actor', 'action', 'at'],
      rows: [
        [90001, 'svc-billing', 'invoice.issued', '2019-03-02 11:20'],
        [90002, 'alice@corp', 'role.granted', '2019-03-02 11:24'],
        [90003, 'svc-backup', 'snapshot.created', '2019-03-02 12:00'],
      ],
    },
  ];

  const ACHIEVEMENTS = [
    { id: 'foundation', icon: '🧱', n: 'Foundation', d: 'Place a table engine.', f: (r) => !!r.engine },
    { id: 'fullstack', icon: '🏗️', n: 'Full stack', d: 'Fill every layer.', f: (r) => r.filledSlots === window.DBP.SLOTS.length },
    { id: 'polyglot', icon: '🧬', n: 'Polyglot', d: 'Use 4+ data types.', f: (r) => r.countIn('types') >= 4 },
    { id: 'ai', icon: '🤖', n: 'AI ready', d: 'Vector / AI search ≥ 75.', f: (r) => r.scores.vector >= 75 },
    { id: 'lake', icon: '🧊', n: 'Lakehouse architect', d: 'Hot/cold & lakehouse ≥ 85.', f: (r) => r.scores.tiering >= 85 },
    { id: 'speed', icon: '⚡', n: 'Speed demon', d: 'Write throughput ≥ 90.', f: (r) => r.scores.writes >= 90 },
    { id: 'danger', icon: '💀', n: 'Living dangerously', d: 'Use fsync = off or disable the redo log.', f: (r) => r.dangers > 0 },
    { id: 'grand', icon: '🏆', n: 'Grand architect', d: 'Reach grade S.', f: (r) => r.grade === 'S' },
    { id: 'bilingual', icon: '🔀', n: 'Bilingual', d: 'Build on both PostgreSQL and MySQL.', f: () => false },
  ];

  const PRESETS = {
    pg: [
      { n: '🛒 OLTP starter', ids: ['pg_pgbouncer', 'pg_heap', 'pg_btree', 'pg_statstatements', 'pg_sb', 'pg_prewarm', 'pg_walcomp', 'pg_checkpoints', 'pg_nvme', 'pg_checksums'] },
      { n: '📊 Analytics', ids: ['pg_columnar', 'pg_btree', 'pg_duckdb', 'pg_parallel', 'pg_jit', 'pg_workmem', 'pg_aio', 'pg_nvme', 'pg_s3'] },
      { n: '📈 IoT metrics', ids: ['pg_timescale', 'pg_btree', 'pg_brin', 'pg_sb', 'pg_walcomp', 'pg_checkpoints', 'pg_aio'] },
      { n: '🤖 RAG / AI', ids: ['pg_pgbouncer', 'pg_heap', 'pg_btree', 'pg_gin', 'pg_tsvector', 'pg_halfvec', 'pg_hnsw', 'pg_efsearch', 'pg_iterscan', 'pg_rrf', 'pg_sb', 'pg_mwm', 'pg_nvme'] },
      { n: '⚡ Bulk load', ids: ['pg_heap', 'pg_parallel', 'pg_workmem', 'pg_mwm', 'pg_unlogged', 'pg_synccommit', 'pg_walminimal', 'pg_checkpoints'] },
    ],
    my: [
      { n: '🛒 OLTP starter', ids: ['my_threadpool', 'my_innodb', 'my_btree', 'my_bp', 'my_bpdump', 'my_redocap', 'my_odirect', 'my_iocap', 'my_binlogcomp'] },
      { n: '🪨 Write-heavy (MyRocks)', ids: ['my_threadpool', 'my_myrocks', 'my_btree', 'my_rockscache', 'my_partitioning', 'my_rockscomp', 'my_cdc', 'my_binlogcomp'] },
      { n: '📊 Analytics (MariaDB)', ids: ['my_columnstore', 'my_hashjoin', 'my_histograms'] },
      { n: '🤖 RAG (MariaDB)', ids: ['my_innodb', 'my_btree', 'my_fulltext', 'my_vector', 'my_vidx', 'my_mhnswef', 'my_rrf', 'my_bp', 'my_mhnswcache'] },
      { n: '🧊 Cold archive (S3)', ids: ['my_s3', 'my_btree', 'my_binlogcomp'] },
    ],
  };

  Object.assign(window.DBP, { WORKLOADS, ACHIEVEMENTS, PRESETS });
})();
