# TF01 foundation record

**TF01 complete, 2026-10-10.** The user authorized backup verification, retirement of the old implementation and tooling, and the minimal package foundation. Map rendering was outside this checkpoint. Later TF02 status is in the [TF02 record](tf02-shared-map.md).

## Backup and retirement

Before deletion, 39,686 implementation, tooling, and dependency entries were compared with `/Users/rob/code/mapbox-code/one-map-backup-2026-10-10`; file contents and symlink targets matched with zero differences. Markdown was excluded from that comparison because the reset planning documents had changed after the original snapshot. The current documents, contributor instructions, and READMEs were separately preserved under the backup's `planning-before-tf01/` directory before removal. The backup remains outside the repository.

The old package source, native bridge, custom reuse/lifecycle machinery, test suites, example/acceptance apps, generated artifacts, caches, and installed dependencies were removed. The previous acceptance runners, inventory/stage-ledger tooling, and native test configuration were retired. The old architecture, stage specification, test plan, implementation-status document, and operational refactor/comment handoffs were removed from active documentation.

The replacement keeps the requirements, stage plan, testing policy, style guides, API comparisons, versioned inventory inputs, and historical investigation records. The local style and GeoJSON fixtures remain as plain data. A post-reset comparison confirmed 37 preserved files (historical JSON records, the documentation style guide, and license) were unchanged from the backup. Historical decisions and evidence are labeled as research; they neither certify current behavior nor prescribe the retired machinery. The license, local environment file, and Git metadata were preserved. No commit, history rewrite, or remote publication was performed.

## Foundation

The package contains six small source files: portable selection types, the common type entry, and four explicit backend entries. Each backend entry exports its selection descriptor. The manifest provides `mapbox` and `maplibre` platform aliases, backend peers, and a narrow publication list. No wrapper, map component, provider, native bridge, or renderer lifecycle is implemented.

Development uses Bun 1.4.1, Node.js 24.14.0, TypeScript 7.0.2, and Biome 2.5.15. The exact renderer and host peers in the package manifest are candidate versions from the preserved research baseline, not a renewed support claim. The development installation contains the build/format tools and React; it does not install backend SDKs.

The remaining scripts build the TypeScript package, check documentation structure, and verify packed-package selection. `bun run validate` combines routine checks; it does not launch renderer acceptance. `bun run pack` builds a local tarball under `artifacts/`.

## Verification

| Check | Result and scope |
| --- | --- |
| Backup comparison | Passed: 39,686 entries matched before retirement; zero differences. |
| Formatting/lint | Passed with the retained style rules; historical JSON data is excluded from formatting. |
| Documentation | Passed paragraph, table, fence, and local-link checks; reviewed current status and historical qualifications. |
| Types and library build | Passed with strict TypeScript, no ambient backend or DOM types in the foundation. |
| Packed consumers | Passed 13 isolated selection cases through Node imports, TypeScript declarations, and Bun bundling. Publication includes compiled code, declarations, package metadata, README, and license. |
| Browser/native acceptance | Not run; no renderer exists at TF01, and the stage requires no renderer acceptance for scaffolding. |

The package checks extract the actual tarball into temporary consumers outside the workspace. They test the common entry, all four explicit entries, alias conditions including simultaneous browser/native conditions, and both mixed engine pairs. Consumers contain no peer packages; that establishes isolation for the current selection descriptors only. It does not test package-manager peer installation, wrapper loading, React context, Metro, or native linking. Generated consumers and test archives are removed by the check.

The tested package SHA-256 was `745737b9b5d9ed95fa0eee49e133ca044b65992e05a8f18847c897814b76fd88`. A separate `bun run pack` produced the same hash: 15 files, 6.70 KB unpacked and 2.65 KB packed. The generated local archive and temporary dependency download cache were removed after verification.

The [TF02 record](tf02-shared-map.md) describes the completed shared map. The [TF02 handoff](tf02-handoff.md) remains the original brief. Do not report historical S04 outcomes as acceptance of the replacement.
