# AGENTS

## Repository Overview

- This repository is an npm workspaces monorepo using `packages/*`.
- Packages are versioned and published independently with `lerna`.
- Supported runtime is Node.js 22 and 24 LTS.
- Recommended development runtime is Node.js 24, and `.nvmrc` is set to `24`.
- Root scripts are intentionally minimal:
  - `npm run build`
  - `npm test`
  - `npm run lint`
  - `npm run format`
  - `npm run release:version`
  - `npm run release:publish`

## General Working Patterns

- Keep the repo simple. Favor npm workspaces plus light package-level configuration over adding more tooling.
- Linting and formatting are advisory and manual. Do not assume legacy packages are expected to lint clean immediately.
- TypeScript is installed at the repo level, but package source may remain standard JavaScript.
- Build outputs should go to `dist/` inside each package, and workspace `dist/` directories are gitignored.
- Package publishing relies on package-level `prepack` hooks to ensure `dist/` is rebuilt before packing or publishing.

## Current Package Pattern

New migrated packages should generally match the structure used by `bbop-core`, `bbop-graph`, and `bbop-registry`.

Typical package layout:

```text
packages/<package-name>/
  README.md
  package.json
  src/
    <entry>.js
    *.test.js
```

Typical `package.json` conventions:

- `"type": "module"`
- dual export build using `tsdown`
- `files` limited to `dist`
- `exports["."]` with both `import` and `require`
- `scripts.build` using `tsdown --format esm --format cjs src/<entry>.js`
- `scripts.prepack` set to `npm run build`
- `scripts.test` set to `node --test`
- `engines.node` set to `>=22 <25`
- `bugs` and `repository` should point to the monorepo, not the legacy standalone repository

Typical README conventions:

- Short overview only
- GitHub link should point to `https://github.com/berkeleybop/bbop-js-monorepo/packages/<package-name>`
- NPM link should point to the published package name
- Avoid carrying forward stale standalone-repo links unless they are still intentionally canonical

## Bringing Legacy Packages In

When migrating a legacy BBOP package into this monorepo, preserve behavior first and modernize only where needed for packaging, testing, and runtime compatibility.

Recommended process:

1. Copy the original source and tests into `packages/<name>/src/`.
2. Convert CommonJS source to ESM only as much as needed for the current package pattern.
3. Keep public API shape stable.
4. Replace old build/test infrastructure like gulp, mocha globals, or old packaging scripts with the monorepo-standard package scripts.
5. Port tests to `node:test` and `chai` when needed.
6. Do not port tests named `trivial.test.js` or with the description "our testing environment is sane".
7. Make package metadata monorepo-consistent.
8. Do not add new sections to the README. Do not modify existing section headers in the README. Update content only as needed to reflect the new repository.
9. Verify build, test, and pack behavior before considering the migration complete.

## Legacy Migration Notes

- Many legacy packages were originally standalone repositories with old metadata and old dependency versions.
- Do not copy old `repository`, `bugs`, or docs URLs blindly. Update them to the monorepo unless there is a deliberate reason not to.
- Do not keep old gulp-based pipelines. The monorepo standard is direct package scripts with `tsdown` and `node --test`.
- Old tests may contain assumptions that break during migration because setup steps were implicit in previous tooling. Read failing tests carefully before changing runtime code.
- Preserve package versions unless there is a specific reason to bump during the migration.
- Prefer bounded internal dependency ranges like `^0.0.6` over `*` for workspace packages that will be published independently.
- Large fixture files may be necessary for legacy tests. Keep them under `src/fixtures/` if they are part of the package test surface.

## Verification Checklist For A Migrated Package

Before considering a migrated package ready, run:

```bash
npm test --workspace packages/<package-name>
npm run build --workspace packages/<package-name>
npm pack --workspace packages/<package-name> --dry-run
```

Check that:

- tests pass
- the package builds both ESM and CJS output
- the tarball contains only the expected publish surface, typically `README.md`, `package.json`, and built files under `dist/`
- internal workspace dependencies use intentional version ranges

## Repository Caveats

- The root `npm test` and `npm run build` commands run package scripts through `lerna`, so a newly added package should integrate cleanly without extra root configuration.
- `oxlint` and `oxfmt` are available, but legacy migrations should not be blocked on full lint cleanup unless explicitly requested.
- This repository may contain staged or unstaged work on other packages. Avoid unrelated cleanup while migrating a package.
