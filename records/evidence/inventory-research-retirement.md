# Inventory research snapshot retirement

Recorded on October 16, 2026 against commit 241816e73eb12a38a4b4b729757986500eb2a950. This checkpoint removes the remaining JSON inventory snapshots from the working tree. The [API coverage checklist](../../docs/api-coverage.md) remains the sole coverage record; [upstream research notes](../../docs/upstream-research.md) preserve useful historical findings and primary-source citations without implementation or verification statuses.

## Removed snapshots

The original bytes remain recoverable in the [pinned Git tree](https://github.com/RobJacobson/one-map-react/tree/241816e73eb12a38a4b4b729757986500eb2a950/records/inventory-inputs). Counts identify the retired input files; they are not current coverage targets.

| Removed file | Historical entries | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `maplibre-native.json` | 1,953 | 2,042,828 | `0360ccc973027b35f373c50cbd20efe84cbbc4781a0bcf4defc062e38c03057a` |
| `release-additions.json` | 20 | 17,848 | `830bcad55ba2c0dd9b6d6279bd6699686773cc9ae67ca6bc3484248da866460e` |
| `rnmapbox.json` | 2,799 | 2,844,213 | `dc427abb2414c0104c40b969b728791aad3258cd5fb3344c59075659889ddcc0` |
| `web.json` | 7,379 | 4,405,934 | `4539afdec244fc205b59cc6f1a964de8780050acdf86b90a549d74f2cc1eb5b2` |

## Storage scope

Removed 9,310,823 bytes of inventory snapshots. The research digest is 21,569 bytes; the checklist remains the existing 68-row coverage record. These sizes measure working-tree files, not Git history, which preserves the original snapshots.

## Preservation review

- Reviewed all 38 baseline notes and the endpoint reconciliation note. Kept source provenance, methodological limits and material findings; obsolete stages, proposed mappings, support targets and old verification cells remain in Git only.
- Reviewed flagged RNMapbox declaration caveats and ref investigations. Retained platform/deprecation, styling/expression, TileJSON, camera, permission, callback timing, logging, snapshot and build constraints in the Markdown digest, with primary-source links and links to the existing focused investigations.
- Grouped the 20 endpoint names into five readable API groups with the original versioned citations. Checked RNMapbox 10.3.8 function, callback and model shapes against the installed source. The retired supplement incorrectly attached setConnected signatures to the two language functions and an outdated no-argument callback to the error payload. The digest uses the actual source shapes instead.
- Kept all 68 checklist row identifiers and review states. Repointed research links and maintenance guidance; no public API, source code, tests, dependency, build configuration or coverage decision changed.
- Preserved existing audit, repair, acceptance and checklist-migration evidence without modification. Their references to removed files describe their original commits and artifacts. Historical documentation points to Git when a removed snapshot is needed.
- Updated the documentation index, records index, requirements and stage plan to distinguish historical research from the single coverage record. No replacement extraction, parser, generated inventory or parallel status table was introduced.

## Routine verification

- `bun run validate`: passed formatting/lint, documentation structure and local links (37 documents, 34 SDK comparison tables), four TypeScript projects, 657 source tests, 219 mocked native tests, fixture checks, library builds/declarations and 13 isolated package selections. Inspected the aggregate chain before execution; no acceptance runner was invoked.
- `bun run typecheck:apps`: passed shared example tests and both application TypeScript projects after the library build.
- `git diff --check`: passed. All 68 checklist row identifiers and checked/unchecked states match the starting commit. The digest retains every exact-version endpoint source citation; no live Markdown link targets a deleted snapshot.
- Package SHA-256 remained `75d3d4ae43f120712574500061cc4d2a7e00bf77ee18be538030cea4cd9a2c93`, matching the repaired archive. Production code, declarations, exports, peers, scripts, tests, examples and build configuration were unchanged. The package checker removed its temporary archive and consumers.
- Existing React Compiler diagnostics remain at 17; Bun moduleSuffixes and experimental TypeScript build-API warnings remain visible. No lifecycle or compiler changes were made.
- Reviewed the digest against the removed research and existing investigations. Preserved primary citations rather than re-fetching remote sources. Checked the corrected RNMapbox endpoint shapes directly in the installed 10.3.8 source. Historical JSON evidence, including the audit, repair and previous migration record, remains byte-identical to the starting commit.
- Compiled suites, peer endpoint installations and example-resolution suites were not repeated because this checkpoint changes only documentation and removes unused research data. No acceptance tests, renderer flows, native builds/installations, publication or commit ran. Current renderer behavior remains unverified.
- Retained these compact outcomes and Git recovery identities; removed temporary migration scripts and raw routine logs.
