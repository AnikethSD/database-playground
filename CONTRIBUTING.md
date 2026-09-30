# Contributing

Thanks for your interest in improving the Database Engine Playground! Corrections to component facts, new case-study missions and UI polish are all welcome.

## Ground rules

1. **Stay static.** No network calls, CDNs, frameworks or build steps. The app must keep working when `index.html` is opened from disk.
2. **Keep engine logic pure.** `src/core/engine.js` must not touch the DOM. UI code goes in `src/ui/app.js`.
3. **Keep the DOM safe.** Create elements with the `h()` helper and set text through `textContent`. Never use `innerHTML` with data.
4. **Put knowledge in data.** New components, workloads and missions go in `src/data/*`, not in UI code.
5. **Back facts with sources.** When you change a component's behaviour or availability, cite the documentation or release notes in your pull request.

## Development

```bash
npm start          # serve at http://localhost:8000 (or just open index.html)
npm run test:all   # syntax check + unit tests + headless UI tests
```

Node.js ≥ 20 is required for the tests. The UI tests need Chrome or Chromium. Set `CHROME_BIN` if it is not on your `PATH`.

## Style

- Two-space indentation and LF line endings. See `.editorconfig`.
- Every source file starts with the Apache 2.0 SPDX header.
- Prefer small, named functions and short comments that explain *why*.
- Keep UI copy calm and concise. Avoid emoji in controls; icons belong to missions and workloads.

## Adding things

| To add | Edit | Then |
| :-- | :-- | :-- |
| A component | `src/data/components.js` | `npm test` (catalogue integrity checks references) |
| A workload | `src/data/workloads.js` | weights must sum to 1; sample rows must match columns |
| A mission | `src/data/missions.js` | follow [docs/authoring-missions.md](docs/authoring-missions.md) |

## Commits and pull requests

- Use imperative, scoped commit subjects, for example `missions: add CDC case study` or `engine: penalise fsync=off harder`.
- Keep pull requests focused, and include a screenshot for UI changes.
- CI (syntax check, unit tests and UI tests) must pass.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
