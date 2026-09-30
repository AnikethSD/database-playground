/**
 * @license
 * Copyright 2026 AnikethSD
 * SPDX-License-Identifier: Apache-2.0
 */
/* Database Engine Playground — component catalogue.
 * Facts follow the "Database Engine Playground" article (PostgreSQL + MySQL family internals).
 *
 * Component fields
 *   id, b ('pg' | 'my'), slot, n (name), icon, d (description)
 *   base      – engines only: starting capability scores
 *   fx        – capability deltas applied when the component is active
 *   needs     – { any: [ids], msg } prerequisite; fx not applied if unmet
 *   engines   – table engines this index/feature works with (unset = all)
 *   conflicts – [{ id, msg }]
 *   flavors   – MySQL-family distributions that ship it (unset = all)
 *   note      – { lvl: 'info' | 'warn' | 'danger', t }
 *   caps      – capability sentences unlocked when active
 *   conf      – config-file lines; sql – SQL lines; preload – shared_preload_libraries entry
 *   clause    – engines only: table DDL clause
 */
(function () {
  const SLOTS = [
    { id: 'pooler', color: '#0284c7',  layer: 1, n: 'Connection pooler',      multi: false, hint: 'Optional. Sits between clients and the server.' },
    { id: 'exec', color: '#7c3aed',    layer: 2, n: 'Planner & executor',     multi: true,  hint: 'Parallelism, JIT, query accelerators, AI query knobs.' },
    { id: 'engine', color: '#ea580c',  layer: 3, n: 'Table engine',           multi: false, hint: 'Required. How rows are stored. Pick exactly one.', required: true },
    { id: 'index', color: '#16a34a',   layer: 3, n: 'Indexes',                multi: true,  hint: 'How rows are found.' },
    { id: 'types', color: '#db2777',   layer: 3, n: 'Data types',             multi: true,  hint: 'What kind of values you can store and index.' },
    { id: 'memory', color: '#ca8a04',  layer: 4, n: 'Buffer cache & memory',  multi: true,  hint: 'Keep hot pages and index builds in RAM.' },
    { id: 'wal', color: '#0d9488',     layer: 5, n: 'WAL / redo & durability', multi: true, hint: 'Durability vs write speed.' },
    { id: 'storage', color: '#64748b', layer: 6, n: 'Disks, tiering & lake',  multi: true,  hint: 'Where bytes physically live.' },
  ];

  const DIMS = [
    { id: 'oltp',        n: 'Transactions (OLTP)' },
    { id: 'analytics',   n: 'Analytics scans' },
    { id: 'writes',      n: 'Write throughput' },
    { id: 'durability',  n: 'Crash safety' },
    { id: 'efficiency',  n: 'Storage efficiency' },
    { id: 'concurrency', n: 'Connections & concurrency' },
    { id: 'search',      n: 'Text & JSON search' },
    { id: 'geo',         n: 'Geo & ranges' },
    { id: 'timeseries',  n: 'Time-series' },
    { id: 'vector',      n: 'Vector / AI search' },
    { id: 'tiering',     n: 'Hot/cold & lakehouse' },
  ];

  const S = (o) => Object.assign({ oltp: 0, analytics: 0, writes: 0, durability: 0, efficiency: 0, concurrency: 0, search: 10, geo: 5, timeseries: 20, vector: 0, tiering: 10 }, o);
  const PG_VEC_IDX = ['pg_hnsw', 'pg_ivfflat', 'pg_diskann', 'pg_vchord'];
  const PG_VEC_TYPES = { any: ['pg_vector', 'pg_halfvec'], msg: 'needs a vector or halfvec column — add one in Data types.' };

  const C = [
    // ───────────────────────────── PostgreSQL ─────────────────────────────
    // Layer 1: pooler
    { id: 'pg_pgbouncer', b: 'pg', slot: 'pooler', n: 'PgBouncer', icon: '🚦', d: 'Lightweight pooler. Every Postgres connection is a process, so thousands of clients need one.', fx: { concurrency: 40 }, caps: ['Thousands of client connections'], conf: '# pgbouncer.ini\npool_mode = transaction\ndefault_pool_size = 20' },
    { id: 'pg_pgcat', b: 'pg', slot: 'pooler', n: 'PgCat', icon: '🐈', d: 'Pooling plus load balancing and sharding.', fx: { concurrency: 40 }, caps: ['Pooling + load balancing + sharding'], conf: '# pgcat.toml\npool_mode = "transaction"' },
    { id: 'pg_supavisor', b: 'pg', slot: 'pooler', n: 'Supavisor', icon: '☁️', d: 'Cloud-native, multi-tenant pooler.', fx: { concurrency: 35 }, caps: ['Multi-tenant cloud pooling'] },

    // Layer 2: executor
    { id: 'pg_parallel', b: 'pg', slot: 'exec', n: 'Parallel query', icon: '🧵', d: 'More CPU cores per query. Raise for analytics, keep low for high-concurrency OLTP.', fx: { analytics: 12, oltp: -2 }, caps: ['Parallel scans, joins & aggregates'], conf: 'max_parallel_workers_per_gather = 8\nmax_parallel_workers = 16' },
    { id: 'pg_jit', b: 'pg', slot: 'exec', n: 'JIT compilation', icon: '⚙️', d: 'Compiles expressions for big queries. Can cost more than it saves on medium OLTP queries.', fx: { analytics: 5, oltp: -4 }, conf: 'jit = on\njit_above_cost = 100000' },
    { id: 'pg_stats', b: 'pg', slot: 'exec', n: 'CREATE STATISTICS', icon: '📐', d: 'Teaches the planner about correlated columns (city + zip).', fx: { analytics: 4, oltp: 2 }, caps: ['Better estimates on correlated columns'], sql: 'CREATE STATISTICS s (dependencies) ON city, zip FROM addresses;' },
    { id: 'pg_duckdb', b: 'pg', slot: 'exec', n: 'pg_duckdb', icon: '🦆', d: 'Embeds DuckDB\'s vectorised engine: fast analytics over tables and lake files.', fx: { analytics: 25, tiering: 10 }, preload: 'pg_duckdb', caps: ['DuckDB vectorised execution', 'Query Parquet / CSV / Iceberg / Delta files'], sql: 'SET duckdb.force_execution = true;', note: { lvl: 'info', t: 'A different execution engine, so SQL semantics can differ in edge cases.' } },
    { id: 'pg_statstatements', b: 'pg', slot: 'exec', n: 'pg_stat_statements', icon: '🔭', d: 'Top queries by total time. The first extension to install.', fx: {}, preload: 'pg_stat_statements', caps: ['Top-query observability'], sql: 'CREATE EXTENSION pg_stat_statements;' },
    { id: 'pg_efsearch', b: 'pg', slot: 'exec', n: 'hnsw.ef_search', icon: '🎚️', d: 'HNSW recall knob (default 40). Higher = better recall, slower.', fx: { vector: 5 }, needs: { any: ['pg_hnsw'], msg: 'only affects HNSW indexes — add pgvector HNSW.' }, sql: 'SET LOCAL hnsw.ef_search = 100;' },
    { id: 'pg_iterscan', b: 'pg', slot: 'exec', n: 'Iterative index scans', icon: '🔁', d: 'pgvector 0.8+: keeps scanning until enough rows pass your WHERE filter.', fx: { vector: 5 }, needs: { any: ['pg_hnsw', 'pg_ivfflat'], msg: 'needs an HNSW or IVFFlat index.' }, caps: ['Filtered vector search keeps LIMIT full'], sql: 'SET hnsw.iterative_scan = relaxed_order;\nSET hnsw.max_scan_tuples = 20000;' },
    { id: 'pg_rrf', b: 'pg', slot: 'exec', n: 'Hybrid search (RRF)', icon: '🔀', d: 'Fuse vector and keyword rankings: score = Σ 1/(60 + rank).', fx: { vector: 5, search: 10 }, needs: { any: PG_VEC_IDX, msg: 'needs a vector index to fuse with keyword results.' }, caps: ['Hybrid semantic + keyword ranking'] },
    { id: 'pg_mlint', b: 'pg', slot: 'exec', n: 'google_ml_integration', icon: '🧠', d: 'Generate embeddings and predictions from SQL.', fx: { vector: 8 }, caps: ['Generate embeddings in SQL'], sql: "SELECT embedding('text-embedding-005', 'hello');", note: { lvl: 'info', t: 'google_ml_integration is available on AlloyDB and Cloud SQL only.' } },

    // Layer 3: table engines
    { id: 'pg_heap', b: 'pg', slot: 'engine', n: 'heap', icon: '🧱', d: 'Default row store: 8 KB slotted pages, MVCC, TOAST. The safe default.', base: S({ oltp: 70, analytics: 35, writes: 55, durability: 85, efficiency: 35, concurrency: 25, timeseries: 25 }), clause: 'USING heap', caps: ['ACID transactions', 'MVCC row versions', 'Cheap UPDATE / DELETE', 'TOAST for large values'] },
    { id: 'pg_columnar', b: 'pg', slot: 'engine', n: 'Citus columnar', icon: '🏛️', d: 'Compressed column store. Designed as append-only.', base: S({ oltp: 10, analytics: 80, writes: 40, durability: 85, efficiency: 90, concurrency: 25, timeseries: 45, tiering: 20 }), clause: 'USING columnar', caps: ['Compressed column store', 'Reads only the columns a query needs'], sql: 'CREATE EXTENSION citus_columnar;', note: { lvl: 'warn', t: 'Citus columnar is append-only: UPDATE and DELETE are unsupported.' } },
    { id: 'pg_orioledb', b: 'pg', slot: 'engine', n: 'OrioleDB', icon: '🌀', d: 'Undo-log MVCC and row-level WAL: write-heavy OLTP without VACUUM bloat.', base: S({ oltp: 80, analytics: 35, writes: 75, durability: 80, efficiency: 50, concurrency: 30 }), clause: 'USING orioledb', preload: 'orioledb', caps: ['Undo-log MVCC (no VACUUM bloat)', 'Row-level WAL'], note: { lvl: 'warn', t: 'OrioleDB is beta and needs a patched PostgreSQL. Not for production yet.' } },
    { id: 'pg_timescale', b: 'pg', slot: 'engine', n: 'TimescaleDB', icon: '⏱️', d: 'Hypertables: automatic time partitioning plus a columnstore.', base: S({ oltp: 60, analytics: 65, writes: 70, durability: 85, efficiency: 75, concurrency: 25, timeseries: 85, tiering: 30 }), clause: '', post: "SELECT create_hypertable('{{table}}', 'ts');", preload: 'timescaledb', caps: ['Automatic time partitioning (hypertables)', 'Columnstore compression of old chunks'], note: { lvl: 'info', t: 'TimescaleDB columnstore features are under the Timescale License, not Apache 2.' } },
    { id: 'pg_lake', b: 'pg', slot: 'engine', n: 'pg_lake (Iceberg)', icon: '🏞️', d: 'Transactional Apache Iceberg tables on object storage.', base: S({ oltp: 10, analytics: 70, writes: 35, durability: 80, efficiency: 85, concurrency: 25, timeseries: 35, tiering: 85 }), clause: 'USING iceberg', caps: ['Transactional Iceberg tables on object storage', 'Postgres as the Iceberg catalog'], note: { lvl: 'info', t: 'pg_lake needs the companion pgduck_server process.' } },

    // Layer 3: indexes
    { id: 'pg_btree', b: 'pg', slot: 'index', n: 'B-tree', icon: '🌳', d: 'Default index: equality, ranges, sorting, uniqueness. Dedup (PG13), skip scan (PG18).', fx: { oltp: 8, analytics: 2 }, engines: ['pg_heap', 'pg_columnar', 'pg_orioledb', 'pg_timescale'], caps: ['Equality, range, sort & unique lookups'], sql: 'CREATE INDEX ON orders (customer_id) INCLUDE (total);' },
    { id: 'pg_hash', b: 'pg', slot: 'index', n: 'Hash', icon: '#️⃣', d: 'Equality only, on long keys.', fx: { oltp: 2 }, engines: ['pg_heap', 'pg_columnar', 'pg_timescale'], sql: 'CREATE INDEX ON sessions USING hash (token);' },
    { id: 'pg_gin', b: 'pg', slot: 'index', n: 'GIN', icon: '🧺', d: 'Inverted index for JSONB, arrays, full-text and trigrams.', fx: { search: 5 }, needs: { any: ['pg_jsonb', 'pg_tsvector', 'pg_trgm', 'pg_arrays'], msg: 'has nothing to index — add jsonb, tsvector, pg_trgm or arrays.' }, engines: ['pg_heap', 'pg_timescale'], sql: 'CREATE INDEX ON products USING gin (doc jsonb_path_ops);' },
    { id: 'pg_gist', b: 'pg', slot: 'index', n: 'GiST', icon: '🗺️', d: 'Geometry, ranges, nearest-neighbour, exclusion constraints.', fx: { geo: 5 }, needs: { any: ['pg_postgis', 'pg_ranges'], msg: 'needs PostGIS or range types to index.' }, engines: ['pg_heap', 'pg_timescale'], sql: 'CREATE INDEX ON stores USING gist (location);' },
    { id: 'pg_rum', b: 'pg', slot: 'index', n: 'RUM', icon: '🥃', d: 'Full-text search ranked inside the index. Slower to build than GIN.', fx: { search: 12 }, needs: { any: ['pg_tsvector'], msg: 'needs a tsvector column.' }, engines: ['pg_heap', 'pg_timescale'], caps: ['Ranked full-text inside the index'], sql: 'CREATE EXTENSION rum;\nCREATE INDEX ON articles USING rum (body_tsv rum_tsvector_ops);' },
    { id: 'pg_brin', b: 'pg', slot: 'index', n: 'BRIN', icon: '📏', d: 'Min/max per block range: kilobytes where a B-tree would be gigabytes.', fx: { timeseries: 10, analytics: 6, efficiency: 3 }, engines: ['pg_heap', 'pg_timescale'], caps: ['Tiny block-range index for ordered data'], sql: 'CREATE INDEX ON metrics USING brin (ts) WITH (pages_per_range = 32);' },
    { id: 'pg_hnsw', b: 'pg', slot: 'index', n: 'pgvector HNSW', icon: '🕸️', d: 'Multi-layer proximity graph. Best speed/recall; slower, memory-hungry build.', fx: { vector: 50 }, needs: PG_VEC_TYPES, engines: ['pg_heap', 'pg_timescale'], caps: ['Approximate nearest-neighbour search (graph)'], sql: 'CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)\n  WITH (m = 16, ef_construction = 64);' },
    { id: 'pg_ivfflat', b: 'pg', slot: 'index', n: 'IVFFlat', icon: '🗂️', d: 'k-means lists. Faster build; build after loading data.', fx: { vector: 40 }, needs: PG_VEC_TYPES, engines: ['pg_heap', 'pg_timescale'], caps: ['Approximate nearest-neighbour search (clusters)'], sql: "CREATE INDEX ON chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 1000);\nSET ivfflat.probes = 32;", note: { lvl: 'info', t: 'Build IVFFlat after loading data; start with lists = rows / 1000.' } },
    { id: 'pg_diskann', b: 'pg', slot: 'index', n: 'DiskANN (pgvectorscale)', icon: '💽', d: 'Disk-friendly StreamingDiskANN with label filtering inside the search.', fx: { vector: 47, efficiency: 5 }, needs: PG_VEC_TYPES, engines: ['pg_heap'], caps: ['Disk-friendly ANN', 'Label filtering inside the graph search'], sql: 'CREATE EXTENSION vectorscale CASCADE;\nCREATE INDEX ON chunks USING diskann (embedding vector_cosine_ops);' },
    { id: 'pg_vchord', b: 'pg', slot: 'index', n: 'VectorChord', icon: '🎼', d: 'IVF plus RaBitQ quantization and re-ranking; fast large builds.', fx: { vector: 47 }, needs: PG_VEC_TYPES, engines: ['pg_heap'], caps: ['IVF + RaBitQ quantized ANN'], sql: 'CREATE INDEX ON chunks USING vchordrq (embedding vector_l2_ops);' },

    // Layer 3: data types
    { id: 'pg_jsonb', b: 'pg', slot: 'types', n: 'jsonb', icon: '📄', d: 'Parsed binary JSON: fast to query and indexable.', fx: { search: 10 }, caps: ['Binary JSON documents'] },
    { id: 'pg_arrays', b: 'pg', slot: 'types', n: 'Arrays', icon: '🔢', d: 'Many values in one column; containment and overlap queries.', fx: { search: 3 }, caps: ['Multi-value columns'] },
    { id: 'pg_tsvector', b: 'pg', slot: 'types', n: 'tsvector', icon: '🔤', d: 'Built-in full-text search with stemming and ranking.', fx: { search: 10 }, caps: ['Full-text search with stemming'] },
    { id: 'pg_trgm', b: 'pg', slot: 'types', n: 'pg_trgm', icon: '🔍', d: "Makes LIKE '%foo%', ILIKE and fuzzy similarity() indexable.", fx: { search: 10 }, caps: ['Typo-tolerant fuzzy matching'], sql: 'CREATE EXTENSION pg_trgm;' },
    { id: 'pg_postgis', b: 'pg', slot: 'types', n: 'PostGIS', icon: '🌍', d: 'Geometry and geography, spatial joins, distance queries.', fx: { geo: 40 }, caps: ['Geometry & geography types'], sql: 'CREATE EXTENSION postgis;' },
    { id: 'pg_ranges', b: 'pg', slot: 'types', n: 'Range types', icon: '📅', d: 'Time periods and numeric ranges, plus exclusion constraints.', fx: { geo: 12 }, caps: ['Range & multirange types'] },
    { id: 'pg_vector', b: 'pg', slot: 'types', n: 'vector', icon: '🧮', d: 'pgvector float32 embeddings; up to 2,000 dims in an index.', fx: { vector: 18 }, caps: ['Store embeddings (float32)'], sql: 'CREATE EXTENSION vector;' },
    { id: 'pg_halfvec', b: 'pg', slot: 'types', n: 'halfvec', icon: '½', d: 'float16 embeddings: half the storage, up to 4,000 dims indexed.', fx: { vector: 15, efficiency: 5 }, caps: ['Half-precision embeddings'], sql: 'CREATE EXTENSION vector;' },

    // Layer 4: memory
    { id: 'pg_sb', b: 'pg', slot: 'memory', n: 'shared_buffers = 25% RAM', icon: '🧠', d: 'Postgres\' page cache. The OS page cache holds the rest. Restart.', fx: { oltp: 5, analytics: 3 }, conf: 'shared_buffers = 16GB\neffective_cache_size = 48GB' },
    { id: 'pg_workmem', b: 'pg', slot: 'memory', n: 'Big work_mem', icon: '🧮', d: 'Per sort/hash operation, per worker: one query can use it many times.', fx: { analytics: 10 }, conf: 'work_mem = 256MB\nhash_mem_multiplier = 4.0', note: { lvl: 'info', t: 'work_mem applies per sort or hash operation, per worker. Raise it per session rather than globally.' } },
    { id: 'pg_mwm', b: 'pg', slot: 'memory', n: 'Big maintenance_work_mem', icon: '🏗️', d: 'VACUUM and CREATE INDEX memory. HNSW builds are much faster when the graph fits.', fx: { vector: 5 }, caps: ['Fast index builds'], conf: 'maintenance_work_mem = 8GB\nmax_parallel_maintenance_workers = 7' },
    { id: 'pg_huge', b: 'pg', slot: 'memory', n: 'huge_pages = on', icon: '📦', d: 'Worth it when shared_buffers ≥ 8 GB. Restart.', fx: { oltp: 3 }, conf: 'huge_pages = on' },
    { id: 'pg_prewarm', b: 'pg', slot: 'memory', n: 'pg_prewarm', icon: '🔥', d: 'Autoprewarm reloads cached blocks after a restart.', fx: { oltp: 3 }, preload: 'pg_prewarm', caps: ['Warm cache after restart'] },

    // Layer 5: WAL
    { id: 'pg_synccommit', b: 'pg', slot: 'wal', n: 'synchronous_commit = off', icon: '🏃', d: 'Commit returns before the WAL flush. Settable per transaction.', fx: { writes: 15, durability: -12 }, conf: 'synchronous_commit = off   # or SET LOCAL per transaction', note: { lvl: 'info', t: 'synchronous_commit = off: a crash can lose the last few hundred ms of commits, but never corrupts data.' } },
    { id: 'pg_walcomp', b: 'pg', slot: 'wal', n: 'wal_compression = lz4', icon: '🗜️', d: 'Compress full-page images. CPU for less WAL volume.', fx: { writes: 5, efficiency: 3 }, conf: 'wal_compression = lz4' },
    { id: 'pg_checkpoints', b: 'pg', slot: 'wal', n: 'Fewer checkpoints', icon: '⏳', d: 'Fewer full-page writes, at the cost of longer crash recovery.', fx: { writes: 8, durability: -2 }, conf: 'checkpoint_timeout = 15min\nmax_wal_size = 16GB' },
    { id: 'pg_walminimal', b: 'pg', slot: 'wal', n: 'wal_level = minimal', icon: '🪶', d: 'Least WAL for standalone bulk loads. No replicas or PITR.', fx: { writes: 8 }, conf: 'wal_level = minimal\nmax_wal_senders = 0\narchive_mode = off', conflicts: [{ id: 'pg_wallogical', msg: 'pick one wal_level.' }, { id: 'pg_quorum', msg: 'replication needs wal_level ≥ replica.' }] },
    { id: 'pg_wallogical', b: 'pg', slot: 'wal', n: 'wal_level = logical', icon: '📡', d: 'Needed for CDC and logical replication. Restart.', fx: { tiering: 5 }, caps: ['Logical replication & CDC'], conf: 'wal_level = logical' },
    { id: 'pg_quorum', b: 'pg', slot: 'wal', n: 'Quorum sync replication', icon: '🛡️', d: 'Wait for ANY 1 of N replicas, so one slow standby doesn\'t stall commits.', fx: { durability: 12, writes: -8 }, caps: ['Quorum synchronous replication'], conf: "synchronous_standby_names = 'ANY 1 (replica_a, replica_b)'" },
    { id: 'pg_unlogged', b: 'pg', slot: 'wal', n: 'UNLOGGED tables', icon: '📝', d: 'Skip WAL entirely: much faster writes.', fx: { writes: 25, durability: -40 }, sql: 'ALTER TABLE staging SET UNLOGGED;', note: { lvl: 'warn', t: 'UNLOGGED tables are emptied after a crash and not replicated.' } },
    { id: 'pg_fpwoff', b: 'pg', slot: 'wal', n: 'full_page_writes = off', icon: '📃', d: 'Only safe if storage guarantees atomic 8 KB writes.', fx: { writes: 8, durability: -20 }, conf: 'full_page_writes = off', note: { lvl: 'warn', t: 'full_page_writes = off risks torn pages unless storage writes 8 KB atomically.' } },
    { id: 'pg_fsyncoff', b: 'pg', slot: 'wal', n: 'fsync = off', icon: '💀', d: 'The nuclear option. Throwaway loads only.', fx: { writes: 30, durability: -80 }, conf: 'fsync = off   # !!!', note: { lvl: 'danger', t: 'fsync = off risks UNRECOVERABLE corruption on a crash.' } },

    // Layer 6: storage
    { id: 'pg_nvme', b: 'pg', slot: 'storage', n: 'NVMe: random_page_cost 1.1', icon: '⚡', d: 'The default 4.0 assumes spinning disks.', fx: { oltp: 4, analytics: 4 }, conf: 'random_page_cost = 1.1\neffective_io_concurrency = 256' },
    { id: 'pg_aio', b: 'pg', slot: 'storage', n: 'Async I/O (io_uring)', icon: '🚀', d: 'PG18 io_method: backends queue many reads at once. Restart.', fx: { analytics: 8, writes: 4 }, caps: ['Asynchronous reads (PG18)'], conf: 'io_method = io_uring   # PG18' },
    { id: 'pg_tablespaces', b: 'pg', slot: 'storage', n: 'Tablespaces (hot/cold disks)', icon: '🗄️', d: 'Hot tables on NVMe, archive on cheap disks.', fx: { tiering: 15 }, caps: ['Place tables on different disks'], sql: "CREATE TABLESPACE fast LOCATION '/nvme/pg' WITH (random_page_cost = 1.1);\nCREATE TABLESPACE slow LOCATION '/hdd/pg';" },
    { id: 'pg_partitioning', b: 'pg', slot: 'storage', n: 'Partitioning', icon: '🧩', d: 'RANGE / LIST / HASH with pruning; detach old partitions concurrently.', fx: { timeseries: 10, tiering: 12, analytics: 4 }, engines: ['pg_heap', 'pg_columnar', 'pg_orioledb'], caps: ['Partition pruning', 'Detach old partitions without blocking'], sql: 'CREATE TABLE events (...) PARTITION BY RANGE (ts);' },
    { id: 'pg_partman', b: 'pg', slot: 'storage', n: 'pg_partman', icon: '🤖', d: 'Creates future partitions and applies retention automatically.', fx: { tiering: 8, timeseries: 5 }, needs: { any: ['pg_partitioning'], msg: 'needs Partitioning.' }, caps: ['Automatic partition creation & retention'], sql: 'CREATE EXTENSION pg_partman;' },
    { id: 'pg_s3', b: 'pg', slot: 'storage', n: 'Parquet / Iceberg on S3', icon: '🪣', d: 'Keep hot rows in Postgres, cold rows in the lake — still queryable.', fx: { tiering: 30, efficiency: 10 }, needs: { any: ['pg_duckdb', 'pg_lake'], msg: 'needs pg_duckdb (executor) or pg_lake (engine) to read lake files.' }, caps: ['Query cold data on object storage'], sql: "SELECT * FROM read_parquet('s3://bucket/events/*.parquet');" },
    { id: 'pg_checksums', b: 'pg', slot: 'storage', n: 'Data checksums', icon: '✅', d: 'Detect silent disk corruption. On by default in PG18 initdb.', fx: { durability: 5 }, caps: ['Detect silent corruption'] },

    // ───────────────────────────── MySQL family ─────────────────────────────
    // Layer 1
    { id: 'my_threadpool', b: 'my', slot: 'pooler', n: 'Thread pool', icon: '🚦', d: 'Handles thousands of connections efficiently.', fx: { concurrency: 35 }, flavors: ['Percona', 'MariaDB', 'HeatWave'], caps: ['Thousands of client connections'], conf: 'thread_handling = pool-of-threads' },

    // Layer 2
    { id: 'my_hashjoin', b: 'my', slot: 'exec', n: 'Hash join', icon: '🔗', d: 'Replaced block nested-loop (8.0.18) for joins without usable indexes.', fx: { analytics: 10 }, caps: ['Hash joins'], conf: 'join_buffer_size = 4M' },
    { id: 'my_histograms', b: 'my', slot: 'exec', n: 'Histograms', icon: '📊', d: 'Data distributions for the optimizer without an index\'s write cost.', fx: { analytics: 5, oltp: 2 }, caps: ['Better estimates without extra indexes'], sql: 'ANALYZE TABLE t UPDATE HISTOGRAM ON col WITH 64 BUCKETS;' },
    { id: 'my_rewrite', b: 'my', slot: 'exec', n: 'Query Rewrite plugin', icon: '✏️', d: 'Rewrites bad queries server-side without changing application code.', fx: {}, caps: ['Rewrite queries server-side'] },
    { id: 'my_heatwave', b: 'my', slot: 'exec', n: 'HeatWave (GenAI + AutoML)', icon: '🔥', d: 'In-memory columnar accelerator plus ML_TRAIN, ML_EMBED_ROW, ML_RAG.', fx: { analytics: 40, vector: 25, tiering: 10 }, flavors: ['HeatWave'], caps: ['In-memory columnar scale-out', 'AutoML & GenAI in SQL (ML_TRAIN, ML_RAG)'], sql: "CALL sys.ML_TRAIN('shop.churn', 'churned', JSON_OBJECT('task', 'classification'), @model);", note: { lvl: 'info', t: 'HeatWave is a managed Oracle service, not part of MySQL Community.' } },
    { id: 'my_mhnswef', b: 'my', slot: 'exec', n: 'mhnsw_ef_search', icon: '🎚️', d: 'MariaDB Vector recall vs speed.', fx: { vector: 5 }, flavors: ['MariaDB'], needs: { any: ['my_vidx'], msg: 'only affects a MariaDB VECTOR INDEX.' }, sql: 'SET SESSION mhnsw_ef_search = 40;' },
    { id: 'my_rrf', b: 'my', slot: 'exec', n: 'Hybrid search (RRF)', icon: '🔀', d: 'FULLTEXT + vector results fused with Reciprocal Rank Fusion in SQL.', fx: { vector: 5, search: 10 }, needs: { any: ['my_vidx', 'my_heatwave'], msg: 'needs vector search (MariaDB VECTOR INDEX or HeatWave).' }, caps: ['Hybrid semantic + keyword ranking'] },

    // Layer 3: engines
    { id: 'my_innodb', b: 'my', slot: 'engine', n: 'InnoDB', icon: '🧱', d: 'Default: ACID, row locks, MVCC, rows clustered by primary key.', base: S({ oltp: 75, analytics: 30, writes: 55, durability: 85, efficiency: 35, concurrency: 45, timeseries: 25 }), clause: 'ENGINE=InnoDB', caps: ['ACID transactions', 'Row-level locking & MVCC', 'Clustered primary key', 'Foreign keys'] },
    { id: 'my_myisam', b: 'my', slot: 'engine', n: 'MyISAM', icon: '🦕', d: 'No transactions, table-level locks. Legacy.', base: S({ oltp: 20, analytics: 35, writes: 40, durability: 10, efficiency: 40, concurrency: 30 }), clause: 'ENGINE=MyISAM', caps: ['Simple read-mostly tables'], note: { lvl: 'warn', t: 'MyISAM is not crash-safe and has no transactions.' } },
    { id: 'my_memory', b: 'my', slot: 'engine', n: 'MEMORY', icon: '💨', d: 'RAM only, hash indexes by default.', base: S({ oltp: 45, analytics: 25, writes: 75, durability: 0, efficiency: 10, concurrency: 35, timeseries: 10 }), clause: 'ENGINE=MEMORY', caps: ['In-RAM lookup tables'], note: { lvl: 'warn', t: 'MEMORY tables are emptied on restart; size capped by max_heap_table_size.' } },
    { id: 'my_archive', b: 'my', slot: 'engine', n: 'ARCHIVE', icon: '📦', d: 'zlib-compressed rows. INSERT and SELECT only.', base: S({ oltp: 5, analytics: 20, writes: 45, durability: 60, efficiency: 85, concurrency: 30, timeseries: 30, tiering: 45 }), clause: 'ENGINE=ARCHIVE', caps: ['Heavily compressed append-only rows'], note: { lvl: 'info', t: 'ARCHIVE supports INSERT and SELECT only — no UPDATE/DELETE, almost no indexes.' } },
    { id: 'my_myrocks', b: 'my', slot: 'engine', n: 'MyRocks (RocksDB LSM)', icon: '🪨', d: 'Write-heavy, bigger than RAM, much better compression than InnoDB.', base: S({ oltp: 65, analytics: 30, writes: 88, durability: 80, efficiency: 85, concurrency: 45, timeseries: 45, tiering: 20 }), clause: 'ENGINE=ROCKSDB', flavors: ['Percona', 'MariaDB'], caps: ['LSM-tree writes', 'Per-level compression (LZ4 / ZSTD)', 'Less flash wear'], conf: 'plugin-load-add = rocksdb=ha_rocksdb.so\ndefault-storage-engine = ROCKSDB\nbinlog_format = ROW\ntransaction_isolation = READ-COMMITTED', note: { lvl: 'info', t: 'MyRocks: no foreign keys, no FULLTEXT/SPATIAL, requires binlog_format=ROW.' } },
    { id: 'my_columnstore', b: 'my', slot: 'engine', n: 'ColumnStore', icon: '🏛️', d: 'MariaDB columnar analytics (OLAP), optional object storage.', base: S({ oltp: 10, analytics: 85, writes: 40, durability: 80, efficiency: 85, concurrency: 35, timeseries: 45, tiering: 30 }), clause: 'ENGINE=ColumnStore', flavors: ['MariaDB'], caps: ['Columnar analytics'] },
    { id: 'my_s3', b: 'my', slot: 'engine', n: 'S3 engine', icon: '🪣', d: 'Read-only archive tables stored on S3.', base: S({ oltp: 0, analytics: 25, writes: 0, durability: 75, efficiency: 80, concurrency: 30, timeseries: 20, tiering: 90 }), clause: 'ENGINE=S3', flavors: ['MariaDB'], caps: ['Read-only tables on object storage'], note: { lvl: 'info', t: 'S3 engine tables are read-only. Move data there with ALTER TABLE ... ENGINE=S3.' } },

    // Layer 3: indexes
    { id: 'my_btree', b: 'my', slot: 'index', n: 'B-tree (secondary)', icon: '🌳', d: 'Everything. Secondary indexes store the primary key as the row pointer.', fx: { oltp: 8, analytics: 2 }, caps: ['Equality, range, sort & unique lookups'], sql: 'CREATE INDEX idx_customer ON orders (customer_id);' },
    { id: 'my_fulltext', b: 'my', slot: 'index', n: 'FULLTEXT', icon: '🔤', d: 'Natural-language search. WITH PARSER ngram for CJK.', fx: { search: 30 }, engines: ['my_innodb', 'my_myisam'], caps: ['Natural-language full-text search'], sql: 'ALTER TABLE articles ADD FULLTEXT (title, body);' },
    { id: 'my_spatial', b: 'my', slot: 'index', n: 'SPATIAL (R-tree)', icon: '🗺️', d: 'Geo queries. Column needs NOT NULL and an SRID.', fx: { geo: 30 }, needs: { any: ['my_geo'], msg: 'needs a spatial column — add Spatial types.' }, engines: ['my_innodb', 'my_myisam'], caps: ['Spatial R-tree lookups'], sql: 'ALTER TABLE stores ADD SPATIAL INDEX (location);' },
    { id: 'my_mvi', b: 'my', slot: 'index', n: 'Multi-valued index', icon: '🧺', d: 'Index arrays inside JSON (MEMBER OF, JSON_OVERLAPS).', fx: { search: 12 }, needs: { any: ['my_json'], msg: 'needs a JSON column.' }, engines: ['my_innodb'], caps: ['Indexed arrays inside JSON'], sql: "CREATE INDEX idx_tags ON products ((CAST(doc->'$.tags' AS CHAR(32) ARRAY)));" },
    { id: 'my_functional', b: 'my', slot: 'index', n: 'Functional index', icon: 'ƒ', d: 'Index an expression such as LOWER(email).', fx: { oltp: 3, search: 3 }, caps: ['Index expressions'], sql: 'CREATE INDEX idx_email ON users ((LOWER(email)));' },
    { id: 'my_invisible', b: 'my', slot: 'index', n: 'Invisible index', icon: '👻', d: 'Still maintained but ignored by the optimizer: test dropping an index safely.', fx: {}, caps: ['Safe index-drop experiments'], sql: 'ALTER TABLE t ALTER INDEX i INVISIBLE;' },
    { id: 'my_vidx', b: 'my', slot: 'index', n: 'MariaDB VECTOR INDEX', icon: '🕸️', d: 'Modified HNSW (mHNSW), open source, MariaDB 11.7+ (11.8 LTS).', fx: { vector: 50 }, flavors: ['MariaDB'], needs: { any: ['my_vector'], msg: 'needs a VECTOR column.' }, engines: ['my_innodb', 'my_myisam'], caps: ['Approximate nearest-neighbour search (mHNSW)'], sql: 'ALTER TABLE chunks ADD VECTOR INDEX (embedding) M=16 DISTANCE=cosine;' },

    // Layer 3: types
    { id: 'my_json', b: 'my', slot: 'types', n: 'JSON', icon: '📄', d: 'Optimised binary JSON with partial in-place updates.', fx: { search: 10 }, caps: ['Binary JSON documents'] },
    { id: 'my_geo', b: 'my', slot: 'types', n: 'Spatial types', icon: '🌍', d: 'POINT, POLYGON… with SRIDs and geographic maths.', fx: { geo: 12 }, caps: ['Geometry types with SRIDs'] },
    { id: 'my_enum', b: 'my', slot: 'types', n: 'ENUM', icon: '🏷️', d: 'Stores a string as a 1–2 byte integer.', fx: { efficiency: 3 }, caps: ['Compact status columns'] },
    { id: 'my_vector', b: 'my', slot: 'types', n: 'VECTOR(N)', icon: '🧮', d: 'Embedding column (MySQL 9.0+ and MariaDB 11.7+).', fx: { vector: 15 }, flavors: ['MySQL', 'MariaDB', 'HeatWave'], caps: ['Store embeddings'] },

    // Layer 4: memory
    { id: 'my_bp', b: 'my', slot: 'memory', n: 'Buffer pool = 70–75% RAM', icon: '🧠', d: 'The single most important knob. Resizable online.', engines: ['my_innodb'], fx: { oltp: 8, analytics: 4 }, conf: 'innodb_buffer_pool_size = 48G' },
    { id: 'my_dedicated', b: 'my', slot: 'memory', n: 'innodb_dedicated_server', icon: '🖥️', d: 'Sizes buffer pool and redo log from RAM and CPU count.', engines: ['my_innodb'], fx: { oltp: 3 }, conf: 'innodb_dedicated_server = ON' },
    { id: 'my_bpdump', b: 'my', slot: 'memory', n: 'Buffer pool dump / load', icon: '🔥', d: 'Save hot pages at shutdown, reload at startup.', engines: ['my_innodb'], fx: { oltp: 3 }, caps: ['Warm cache after restart'], conf: 'innodb_buffer_pool_dump_at_shutdown = ON\ninnodb_buffer_pool_load_at_startup = ON' },
    { id: 'my_ahi', b: 'my', slot: 'memory', n: 'Adaptive hash index', icon: '#️⃣', d: 'In-memory hash over hot pages. OFF by default in 8.4.', engines: ['my_innodb'], fx: { oltp: 3 }, conf: 'innodb_adaptive_hash_index = ON' },
    { id: 'my_rockscache', b: 'my', slot: 'memory', n: 'RocksDB block cache', icon: '🪨', d: 'MyRocks\' main cache; shrink the InnoDB buffer pool when MyRocks is the default engine.', engines: ['my_myrocks'], fx: { oltp: 6, analytics: 3 }, flavors: ['Percona', 'MariaDB'], conf: 'rocksdb_block_cache_size = 32G\ninnodb_buffer_pool_size = 1G' },
    { id: 'my_mhnswcache', b: 'my', slot: 'memory', n: 'mhnsw_max_cache_size', icon: '🕸️', d: 'Memory for the MariaDB vector index. Keep the graph in RAM.', fx: { vector: 5 }, flavors: ['MariaDB'], needs: { any: ['my_vidx'], msg: 'only matters with a MariaDB VECTOR INDEX.' }, conf: 'mhnsw_max_cache_size = 4G' },

    // Layer 5: durability
    { id: 'my_flush2', b: 'my', slot: 'wal', n: 'flush_log_at_trx_commit = 2', icon: '🏃', d: 'Write at commit, flush ~once per second.', engines: ['my_innodb'], fx: { writes: 15, durability: -12 }, conf: 'innodb_flush_log_at_trx_commit = 2', note: { lvl: 'warn', t: 'innodb_flush_log_at_trx_commit = 2: an OS crash can lose ~1 s of commits.' } },
    { id: 'my_syncbinlog0', b: 'my', slot: 'wal', n: 'sync_binlog = 0', icon: '📜', d: 'Leave binlog flushing to the OS.', fx: { writes: 6, durability: -10 }, conf: 'sync_binlog = 0', note: { lvl: 'warn', t: 'sync_binlog = 0 can lose binlog events on an OS crash.' } },
    { id: 'my_redocap', b: 'my', slot: 'wal', n: 'Big redo log capacity', icon: '⏳', d: 'Fewer forced flushes, longer recovery. Resizable at runtime (8.0.30+).', engines: ['my_innodb'], fx: { writes: 8, durability: -2 }, flavors: ['MySQL', 'Percona', 'HeatWave'], conf: 'innodb_redo_log_capacity = 8G' },
    { id: 'my_dblwroff', b: 'my', slot: 'wal', n: 'Doublewrite off', icon: '📃', d: 'Removes torn-page protection.', engines: ['my_innodb'], fx: { writes: 8, durability: -20 }, conf: 'innodb_doublewrite = OFF', note: { lvl: 'warn', t: 'innodb_doublewrite = OFF is unsafe on crash (torn pages can\'t be repaired).' } },
    { id: 'my_binlogcomp', b: 'my', slot: 'wal', n: 'Binlog compression', icon: '🗜️', d: 'zstd-compressed binlog that stays compressed on replicas.', fx: { efficiency: 5 }, conf: 'binlog_transaction_compression = ON' },
    { id: 'my_cdc', b: 'my', slot: 'wal', n: 'Binlog ROW + FULL (CDC)', icon: '📡', d: 'What Debezium needs to stream changes to a lake.', fx: { tiering: 5 }, caps: ['CDC via Debezium / Kafka'], conf: 'binlog_format = ROW\nbinlog_row_image = FULL\ngtid_mode = ON\nenforce_gtid_consistency = ON' },
    { id: 'my_grouprep', b: 'my', slot: 'wal', n: 'Group Replication', icon: '🛡️', d: 'Multi-node, consensus-based high availability.', fx: { durability: 12, writes: -8, concurrency: 5 }, caps: ['Multi-node consensus HA'] },
    { id: 'my_noredo', b: 'my', slot: 'wal', n: 'DISABLE INNODB REDO_LOG', icon: '💀', d: 'Instance-wide. Only for loading a brand-new instance.', engines: ['my_innodb'], fx: { writes: 30, durability: -80 }, flavors: ['MySQL', 'Percona'], sql: 'ALTER INSTANCE DISABLE INNODB REDO_LOG;', note: { lvl: 'danger', t: 'Redo log disabled: a crash can leave the ENTIRE instance unrecoverable.' } },

    // Layer 6: storage
    { id: 'my_odirect', b: 'my', slot: 'storage', n: 'O_DIRECT', icon: '➡️', d: 'Bypass the OS page cache so data isn\'t cached twice (8.4 default).', engines: ['my_innodb'], fx: { oltp: 3 }, conf: 'innodb_flush_method = O_DIRECT' },
    { id: 'my_iocap', b: 'my', slot: 'storage', n: 'High innodb_io_capacity', icon: '⚡', d: 'IOPS budget for background flushing on NVMe.', engines: ['my_innodb'], fx: { writes: 8 }, conf: 'innodb_io_capacity = 10000\ninnodb_io_capacity_max = 20000' },
    { id: 'my_datadir', b: 'my', slot: 'storage', n: 'DATA DIRECTORY / tablespaces', icon: '🗄️', d: 'Place a table\'s .ibd file on another disk.', fx: { tiering: 15 }, engines: ['my_innodb'], caps: ['Place tables on different disks'], sql: "CREATE TABLESPACE ts_cold ADD DATAFILE '/mnt/hdd/ts_cold.ibd' ENGINE=InnoDB;" },
    { id: 'my_partitioning', b: 'my', slot: 'storage', n: 'Partitioning', icon: '🧩', d: 'RANGE / LIST / HASH / KEY with pruning.', fx: { timeseries: 10, tiering: 12, analytics: 4 }, engines: ['my_innodb', 'my_myrocks'], caps: ['Partition pruning'], sql: 'ALTER TABLE events PARTITION BY RANGE (YEAR(ts)) (...);' },
    { id: 'my_exchange', b: 'my', slot: 'storage', n: 'EXCHANGE PARTITION archiving', icon: '🔄', d: 'Instantly swap an old partition out into its own table.', fx: { tiering: 15 }, needs: { any: ['my_partitioning'], msg: 'needs Partitioning.' }, caps: ['Instant partition archiving'], sql: 'ALTER TABLE orders EXCHANGE PARTITION p2019 WITH TABLE orders_2019;' },
    { id: 'my_pagecomp', b: 'my', slot: 'storage', n: 'Page compression', icon: '🗜️', d: "COMPRESSION='lz4' with hole punching (ext4, XFS).", fx: { efficiency: 15 }, engines: ['my_innodb'], sql: "ALTER TABLE logs COMPRESSION='lz4';" },
    { id: 'my_rockscomp', b: 'my', slot: 'storage', n: 'RocksDB per-level compression', icon: '🗜️', d: 'LZ4 on upper levels, ZSTD at the bottom: usually the best ratio of the lot.', engines: ['my_myrocks'], fx: { efficiency: 10 }, flavors: ['Percona', 'MariaDB'], conf: 'rocksdb_default_cf_options = "compression=kLZ4Compression;bottommost_compression=kZSTD"' },
    { id: 'my_hwlake', b: 'my', slot: 'storage', n: 'HeatWave Lakehouse', icon: '🏞️', d: 'Query Parquet/CSV/JSON in object storage and join with InnoDB.', fx: { tiering: 30, analytics: 10 }, flavors: ['HeatWave'], caps: ['Query files in object storage'] },
  ];

  const SYNERGIES = [
    { all: ['pg_gin', 'pg_jsonb'], fx: { search: 15 }, cap: 'Indexed JSON containment (@>)' },
    { all: ['pg_gin', 'pg_tsvector'], fx: { search: 15 }, cap: 'Indexed full-text search' },
    { all: ['pg_gin', 'pg_trgm'], fx: { search: 15 }, cap: "Indexed fuzzy LIKE '%x%' and similarity()" },
    { all: ['pg_gin', 'pg_arrays'], fx: { search: 5 }, cap: 'Indexed array containment' },
    { all: ['pg_gist', 'pg_postgis'], fx: { geo: 25 }, cap: 'Spatial joins & nearest-neighbour' },
    { all: ['pg_gist', 'pg_ranges'], fx: { geo: 15 }, cap: 'No-overlap exclusion constraints' },
    { all: ['pg_brin', 'pg_partitioning'], fx: { timeseries: 5 } },
    { all: ['pg_duckdb', 'pg_s3'], fx: { analytics: 5 } },
  ];

  const byId = Object.fromEntries(C.map((c) => [c.id, c]));
  window.DBP = { SLOTS, DIMS, COMPONENTS: C, SYNERGIES, byId, PG_VEC_IDX };
})();
