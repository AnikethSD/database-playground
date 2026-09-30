# Authoring a mission

Missions live in [`src/data/missions.js`](../src/data/missions.js). A good mission reads like a cloud certification case study. It tells a realistic story and buries the real constraints among distractors. It then asks a question whose answer is a database configuration.

## Schema

```js
{
  id: 'warm',                    // unique, kebab/lowercase
  icon: '✈️',                    // one emoji, shown in a tile tinted by category
  n: 'Cold cache after failover',// title
  co: 'Kestrel Air',             // fictional company
  cat: 'oltp',                   // one of MISSION_CATS: oltp, analytics, ai, timeseries, storage, search, geo, reliability
  family: 'my',                  // 'pg' | 'my' | 'any' (the player chooses)
  lvl: 1,                        // 1 Associate · 2 Professional · 3 Expert
  brief: 'After every failover…',// one line for the mission list
  story: ['Company overview…', 'The situation…'],   // paragraphs
  reqs: ['…', '…'],              // business & technical requirements (include 1–2 red herrings)
  quote: { who: 'Name, Title', t: '…' },
  q: 'How should Kestrel Air configure InnoDB memory for fast warm-up?',
  checks: [                      // hidden goals, evaluated live against analyze() output
    { t: 'Buffer pool warm-up after restart', f: (r) => has(r, 'my_bpdump', 'pg_prewarm') },
    min('oltp', 'Transactions (OLTP)', 90),
    noErr,
  ],
  answer: { my: ['my_innodb', 'my_btree', 'my_bp', 'my_bpdump'] },  // reference build(s)
  debrief: 'Why the answer works…',
}
```

Two more sections are kept in lookup tables at the bottom of the file, keyed by mission `id`:

- `ENV[id]`: 3–5 bullets for the *existing technical environment*.
- `MORE[id]`: an optional extra story paragraph (timeline, politics, rejected options).

### Helpers for checks

| Helper | Meaning |
| :-- | :-- |
| `min(dim, label, v)` | `result.scores[dim] >= v` |
| `has(r, ...ids)` | at least one of the components is placed |
| `noErr` | no configuration errors |
| `noDanger` | no `fsync = off` / disabled redo log |

`r` is the full result of `analyze()`. Checks can also use `r.engine.id`, `r.errors`, `r.dangers`, `r.flavors`, `r.countIn(slot)` and so on.

## Writing checklist

- [ ] **Around 300 words** across story, environment, requirements, quote and question. The tests enforce at least 200.
- [ ] The constraints are **inferable from the story**. Don't write "use HNSW"; write "4-second queries over 10 M vectors".
- [ ] Include **at least one tempting trap** in the story (for example "a consultant suggests `fsync = off`") and make sure a check fails when it is used.
- [ ] Add **1–2 irrelevant requirements** ("the UI team is adopting dark mode").
- [ ] Every check should be **necessary**: the reference answer passes it, and a plausible wrong answer fails it.
- [ ] The **debrief** explains *why*, including why each trap is wrong.
- [ ] Use **fictional** companies and people.

## Verify

```bash
npm test          # missions.test.js proves every answer passes its checks with 0 errors
npm run test:ui   # optional: full UI flow
```

If you add a trap, consider adding an assertion to the *traps* test in [`tests/missions.test.js`](../tests/missions.test.js).
