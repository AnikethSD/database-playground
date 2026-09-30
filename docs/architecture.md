# Architecture

This document describes how the playground is put together. It covers the data model, the analysis algorithm and the design decisions behind them.

## Goals and constraints

| Constraint | Consequence |
| :-- | :-- |
| Runs by double-clicking `index.html` | Classic `<script>` tags that share one `window.DBP` namespace. ES modules are blocked on `file://`. |
| Fully offline, no third-party code | No frameworks, CDNs, fonts or analytics. Plain DOM APIs only. |
| Easy to extend with new content | All knowledge (components, workloads, missions) lives in declarative data files. |
| Testable without a browser | The analysis engine is a pure function of state and has no DOM access. |

## Module map

Scripts are loaded in this order by `index.html`. Each one adds to `window.DBP`.

| File | Adds to `DBP` | Depends on |
| :-- | :-- | :-- |
| `src/data/components.js` | `SLOTS`, `DIMS`, `COMPONENTS`, `SYNERGIES`, `byId`, `PG_VEC_IDX` | — |
| `src/data/workloads.js` | `WORKLOADS`, `ACHIEVEMENTS`, `PRESETS` | `SLOTS` |
| `src/data/missions.js` | `MISSIONS`, `MISSION_CATS`, `MISSION_LEVELS` | — |
| `src/core/engine.js` | `analyze(state)`, `ddlFor(workload, result)` | all of the above |
| `src/ui/app.js` | *(nothing; wires the DOM)* | all of the above |

## Data model

### Layers (`SLOTS`)

There are eight slots, grouped into six physical layers:

| Slot | Layer |
| :-- | :-- |
| pooler | 1 |
| exec | 2 |
| engine, index, types | 3 |
| memory | 4 |
| wal | 5 |
| storage | 6 |

Each slot has:
- a `color`, which drives the whole colour system in the UI;
- `multi`, which says whether the slot accepts several components or exactly one;
- `required`, which is set only on `engine`.

### Capability dimensions (`DIMS`)

There are eleven capability dimensions, each scored from 0 to 100:

- `oltp`, `analytics`, `writes`, `durability`, `efficiency`, `concurrency`
- `search`, `geo`, `timeseries`, `vector`, `tiering`

### Components

```js
{
  id: 'pg_hnsw',            // family prefix: pg_ | my_
  b: 'pg',                  // family
  slot: 'index',            // which layer it belongs to
  n: 'pgvector HNSW',       // display name
  d: 'Multi-layer proximity graph…',
  base: { … },              // engines only: starting score for every dimension
  fx: { vector: 50 },       // capability deltas while active
  needs: { any: ['pg_vector', 'pg_halfvec'], msg: '…' },   // prerequisite
  engines: ['pg_heap', 'pg_timescale'],                    // compatible engines
  conflicts: [{ id: 'pg_wallogical', msg: '…' }],
  flavors: ['MariaDB'],     // MySQL-family distributions that ship it
  note: { lvl: 'warn', t: '…' },                          // surfaced as a check
  caps: ['Approximate nearest-neighbour search'],        // "what it can do"
  conf: '…', sql: '…', preload: 'pgvector', clause: 'USING heap', post: '…',
}
```

### State

The state is persisted to `localStorage` under the key `dbp-playground-v1`:

```js
{
  base: 'pg' | 'my',
  slots: { pooler: [ids], exec: [ids], engine: [id], … },
  mission, completed, stars, hints, qShown,     // mission progress
  unlocked, usedBases, mistakes,                // achievements
  theme, learn, openGroup, tab, workload,       // UI preferences
}
```

## The analysis algorithm (`analyze(state)`)

1. **Collect** the placed components in layer order and find the engine.
2. **Start** each score from the engine's `base`. With no engine, everything is 0.
3. **Evaluate each component.** A component becomes **inactive**, and adds an `error` check, if:
   - none of its `needs.any` is present;
   - the chosen engine is not in its `engines`;
   - a component listed in its `conflicts` is present.

   Active components apply their `fx`, contribute `caps` and emit `conf`, `sql` and `preload` lines.
4. **Apply synergies:** pairs that are worth more together, such as GIN + `pg_trgm` or GiST + PostGIS.
5. **Apply family-specific rules** that add warnings and tips. Examples: "embeddings without a vector index", "hybrid search without a keyword side", "InnoDB with the default 128 MB buffer pool".
6. **Resolve the distribution** (MySQL family only). Intersect the `flavors` of every component. An empty intersection is an error.
7. **Clamp** every score to 0..100.
8. **Compute workload fit.** Fit is the weighted sum of scores. Workloads with an unmet `req` are multiplied by 0.35; workloads whose `req` is met get +8.
9. **Compute score and grade.** Score = best fit − 8·errors − 12·dangers. The grade is S/A/B/C/D.

The result object is consumed both by the UI and by mission checks (`check.f(result)`).

## UI architecture (`src/ui/app.js`)

- **Render loop.** `update()` calls `analyze`, then runs `renderPalette`, `renderStack`, `renderMission`, `checkAchievements` and `renderAnalysis`, then saves. Each renderer rebuilds its region with `replaceChildren`.
- **DOM helper `h(tag, attrs, …children)`.** Text is always set via `textContent` and text nodes, never `innerHTML` with data.
- **Drag and drop.** Uses native HTML5 DnD.
  - A drop on the wrong slot counts as a miss.
  - Dragging a placed chip back to the palette removes it.
  - With *Guide me* on, the body gets `.is-dragging.guide`, the matching slot gets `.target`, and CSS dims every other slot.
- **Hover card.** A single floating `#pop` element. It is positioned next to the anchor, flipped to the other side if there isn't room, and clamped to the viewport.
- **Mission board.** A native `<dialog>` with a filterable list and a case-study pane. Scroll positions are kept when the board re-renders.

## Styling

- **Design tokens.** `:root` holds the light theme and `[data-theme="dark"]` the dark theme.
- **Per-layer colour.** Every layer-related element gets `style="--c: <slot colour>"`. Tints are computed with `color-mix(in srgb, var(--c) N%, var(--panel))`, so both themes stay coherent without extra rules.
- **Mission categories.** These use the same technique with `--mc`.
