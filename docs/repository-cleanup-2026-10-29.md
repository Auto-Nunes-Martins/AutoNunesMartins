# Repository cleanup — 29 October 2026

The owner delegated assessment and execution across the repository. The audit inspected 1,954 files (358,247,950 bytes), imports, routes, Vite asset manifests, generators, package scripts, documentation, provenance, licenses and binary hashes. Dependency directories, caches, Git internals, worktrees and private configuration were excluded from traversal; real environment file contents were not read. This is a repository maintenance change, not publication approval.

## Remote versus local

399 files totalling **80,339,380 bytes** leave the current Git tree. **Every local file remains in place with its original SHA-256**; nothing is physically deleted or moved. Exact paths, categories, hashes and retained image sources are in [the inventory](repository-cleanup-2026-10-29.json). Absolute paths and validated ancestor/link records remain in the ignored local audit under artifacts/cleanup-audit/. The files remain recoverable from commit `611a3d7dfe68d0b3c11cf31d52c1ed3ba4402ae8`; this does not rewrite repository history or shrink existing Git objects.

| Category                              | Files |      Bytes | Decision                                                                                                                                                                                                                                               |
| ------------------------------------- | ----: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superseded brand SVG copies           |    28 |     96,228 | Keep the canonical CRM copies used by the shared resolver; preserve website license/provenance files. The built manifest includes 215 canonical logos and zero old website-brand paths.                                                                |
| Historical favicon raster/ICO outputs |   253 |  2,475,294 | Local/generated only. Retain SVG artwork, generators, HTML studies, JSON provenance, active-selection.json, all selected-light-26 assets and the old PNG consumed by create-refined-stacked-favicons.mjs.                                              |
| Smaller historical image derivatives  |    89 | 77,572,030 | Local only. Each retains its largest sibling; original/native masters, active imports and all explicit generator inputs remain tracked. All 89 have matching aspect ratios and a mean 64×64 RGB difference below 1/255 from the retained larger image. |
| Superseded UI prototype code          |    22 |    165,136 | Unreachable from current routes/runtime imports: old facade tuner, detail lab and their exclusive helpers, unused footer, and unused CRM prototype components.                                                                                         |
| Tests exclusive to retired prototypes |     3 |      6,141 | Retire geometricStandCrop, responsiveStandFraming and trustRow prototype specs with their helpers. Tests of active features remain tracked.                                                                                                            |
| Retired prototype browser checks      |     4 |     24,551 | Required the removed facade tuner, seven-version hero selector, V2 scene or old stand backdrop; no package/build/CI callers.                                                                                                                           |

## What remains tracked

- All current routes, API/domain code, migrations, maintenance tools, package/lock/build/deployment configuration and configuration examples.
- All 215 canonical brand logos, aliases/catalogue data, copyright/license records and logo provenance.
- All 74 active home-v5 image outputs and 40 mobile outputs, current source/master images and regeneration/comparison scripts. About-page photos remain because generators/tests consume them even when not directly imported by a route.
- Active favicons and their selection/provenance. If a future favicon selection changes, update the matching ignore exceptions as well as active-selection.json.
- Public-photo rollback tags/instructions, WebP84 recipe, Storage master handling, publication-readiness evidence/placeholders, email runtime images/templates and all current regression checks.
- Reusable backend stock-aging logic and description-link helpers with tests; ambient type declarations and Prisma test/backfill support. A missing runtime import alone does not prove these are disposable.
- Historical Markdown, SVG artwork, prompts and provenance needed to understand or regenerate retained designs. Old documentation that names the detail lab/tuner describes historical implementations rather than current route entry points.

The active HomeHeroDirections component still imports featuredHover.css; that stylesheet is deliberately retained while the unrelated unused featuredHover.ts prototype helper is retired. No secret, database record, Storage object, ignored/untracked original, dependency installation or worktree is removed.

## Ignore policy and recovery

.gitignore prevents local archives from being recommitted accidentally. .dockerignore mirrors the archive rules and excludes artifacts and generated previews from local Docker contexts. Current runtime assets and generator inputs are exceptions, not blanket directory exclusions.

To inspect a retired file, use the inventory and `git show 611a3d7dfe68d0b3c11cf31d52c1ed3ba4402ae8:relative/path`. To restore it to the repository, first review the relevant ignore entry, then restore that exact path from the base commit and stage only the intended files. Do not use whole-tree reset/clean or recursive deletion as a recovery step.

## Validation

Verified using a clean export without retired application files or real environment files, with its own immutable Yarn dependency installation and fixture-only configuration:

- Complete combined service build driven by Node 22.23.4, including the compiled shared-package runtime import: passed.
- Website: 832 tests passed; CRM: 325 tests passed; backend: 486 tests passed. A backend test initially timed out while all three suites ran concurrently; the complete backend suite passed with two workers and no test/code/timeout changes.
- Website and CRM Svelte checks: zero errors and zero warnings, using explicit dummy public configuration instead of real environment files.
- Chrome at 390 and 1366 px: public Nissan logos, legacy label normalization, SSR and static SVG delivery passed. Fixture API traffic was GET-only.
- Asset-cache gateway smoke: 605 byte-identical emitted image assets, GET/HEAD/304 cache behavior, active favicon selection, SSR references and private/fresh response policy passed.
- All 399 local archive files remain present with unchanged SHA-256 and are ignored; no physical source deletion, database/Storage change, secret copy, dependency cleanup or worktree cleanup occurred.

The active check-asset-cache.mjs verifier previously assumed every SVG in the source folders had a static twin and every source asset was emitted. That assumption already failed in the previous HEAD (for example, the alternate map SVG has no static twin), and did not account for shared CRM brand imports. It now reads each application's actual Vite asset manifest, compares emitted images with their source bytes, includes shared logos, and retains the original/static SVG comparison where an actual twin exists. No image, UI or cache policy changed.

Old HTML/favicon studies remain available locally; their removed raster outputs can be regenerated with the retained generators. Existing Git history is preserved; the approximately 80.3 MB reduction describes the current checkout tree, not immediate server-side Git object storage reclamation.
