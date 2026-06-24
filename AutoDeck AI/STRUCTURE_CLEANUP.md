# AutoDeck AI Structure Cleanup

## Current Classification

| Path | Status | Decision |
|---|---|---|
| `index.html` | Production entry | Keep at the hosted root while the app remains build-step-free. |
| `action.html` | Firebase account action entry | Keep. Covered by `tests/reset-password.spec.js`. |
| `AutoDeck AI.html` | Local compatibility redirect | Keep for now, but keep ignored from Hosting. Remove in a later compatibility pass if no one still opens it locally. |
| `preview-home.html` | Static visual demo harness | Keep in repo temporarily, but do not deploy. Move under a future `dev/preview/` folder or delete after screenshots/tests replace it. |
| `preview-conflict.html` | Static visual demo harness | Keep in repo temporarily, but do not deploy. Move under a future `dev/preview/` folder or delete after screenshots/tests replace it. |
| `preview-conflict-loading.html` | Static visual demo harness | Keep in repo temporarily, but do not deploy. Move under a future `dev/preview/` folder or delete after screenshots/tests replace it. |
| `vendor/pdf.min.js` and `vendor/pdf.worker.min.js` | Removed legacy PDF.js bundles | Deleted after a full verify run confirmed `pdfjsLib` stays unused. |
| `screenshots/` | Tracked visual artifacts, not referenced by docs/tests | Archive under docs assets or delete after confirming they are not needed for product/design review. Already ignored from Hosting. |
| `tests/home-screen-b.spec.js` | Removed retired `HomeScreenB` prototype coverage | Deleted because `HomeScreenB` is no longer shipped and the suite only added skipped tests. |
| `BACKEND_RESTRUCTURE.md` | Historical execution plan | Archive under `docs/archive/` after the current implementation status is summarized in `ARCHITECTURE.md`. |
| `GENERATION_WORKFLOW.md` | Current generation flow notes | Keep, but move under `docs/` when the docs hierarchy is introduced. |
| `start-server.*` | Local convenience launchers | Keep temporarily. Prefer root `package.json` scripts in a later pass. |

## Proposed Hierarchy

Keep the hosted public root stable for now because Firebase Hosting serves from `AutoDeck AI/` and the no-build script order is path-sensitive.

```text
AutoDeck AI/
├── index.html
├── action.html
├── config/
│   ├── api-config.js
│   └── firebase-config.example.js
├── shared/
├── app/
│   ├── app.jsx
│   ├── app-services.jsx
│   └── tokens.jsx
├── components/
│   ├── auth/
│   ├── deck/
│   ├── editor/
│   ├── admin/
│   └── shell/
├── dev/
│   └── preview/
├── docs/
│   └── archive/
├── functions/
└── vendor/
```

This hierarchy should be introduced in stages. In the current no-build setup, each move must update `index.html`, `action.html`, preview harnesses, Playwright expectations that fetch source files by path, and `ARCHITECTURE.md`.

## Execution Order

1. Remove deploy exposure first.
   - Keep demo harnesses and unused PDF bundles out of Firebase Hosting.
   - Keep examples, scripts, screenshots, Functions source, and docs ignored from Hosting.

2. Delete or archive confirmed dead files.
   - Completed: removed `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`, and `tests/home-screen-b.spec.js`.
   - Continue with screenshots and historical docs only after confirming they are not needed for design/product review.

3. Move docs into a real docs hierarchy.
   - Create `AutoDeck AI/docs/`.
   - Move active docs there.
   - Move historical plans to `AutoDeck AI/docs/archive/`.

4. Move local-only tools and previews.
   - Move `preview-*.html` to `AutoDeck AI/dev/preview/`.
   - Replace `start-server.*` with root package scripts or move them to `scripts/`.

5. Re-section browser code.
   - Move app orchestration files under `AutoDeck AI/app/`.
   - Group screen components by domain.
   - Keep shared browser/function mirrors in their existing locations until `check:shared` is updated for the new paths.

## Acceptance Checks

- `npm run verify`
- Firebase Hosting deploy preview does not include demo harnesses, unused PDF.js bundles, screenshots, docs, local scripts, examples, or Functions source.
- `index.html` and `action.html` still load without 404s.
- No new skipped tests are introduced.
