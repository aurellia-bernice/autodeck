# AutoDeck AI Structure Cleanup

## Current Classification

| Path | Status | Decision |
|---|---|---|
| `index.html` | Production entry | Keep at the hosted root while the app remains build-step-free. |
| `action.html` | Firebase account action entry | Keep. Covered by `tests/reset-password.spec.js`. |
| `AutoDeck AI.html` | Local compatibility redirect | Keep for now, but keep ignored from Hosting. Remove in a later compatibility pass if no one still opens it locally. |
| `dev/preview/preview-home.html` | Static visual demo harness | Kept in a dev-only preview folder and ignored from Hosting through `dev/**`. Delete after screenshots/tests replace it. |
| `dev/preview/preview-conflict.html` | Static visual demo harness | Kept in a dev-only preview folder and ignored from Hosting through `dev/**`. Delete after screenshots/tests replace it. |
| `dev/preview/preview-conflict-loading.html` | Static visual demo harness | Kept in a dev-only preview folder and ignored from Hosting through `dev/**`. Delete after screenshots/tests replace it. |
| `vendor/pdf.min.js` and `vendor/pdf.worker.min.js` | Removed legacy PDF.js bundles | Deleted after a full verify run confirmed `pdfjsLib` stays unused. |
| `docs/assets/screenshots/` | Archived visual artifacts, not referenced by code/tests | Kept for product/design review and ignored from Hosting through `docs/**`. |
| `tests/home-screen-b.spec.js` | Removed retired `HomeScreenB` prototype coverage | Deleted because `HomeScreenB` is no longer shipped and the suite only added skipped tests. |
| `docs/archive/BACKEND_RESTRUCTURE.md` | Historical execution plan | Archived. Current implementation source of truth is `docs/ARCHITECTURE.md` plus code. |
| `docs/GENERATION_WORKFLOW.md` | Current generation flow notes | Kept with active docs. |
| `docs/ARCHITECTURE.md` | Current architecture reference | Kept with active docs. |
| `scripts/dev-server.js` | Root local development and test server | Replaces the removed `start-server.*` launchers and the Playwright Python server. Run with `npm run dev` or `npm start`. |

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
│   ├── template-presets.jsx
│   └── tokens.jsx
├── components/
│   ├── auth/
│   ├── deck/
│   ├── editor/
│   ├── admin/
│   └── shell/
├── dev/
│   └── preview/
│       ├── preview-home.html
│       ├── preview-conflict.html
│       └── preview-conflict-loading.html
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GENERATION_WORKFLOW.md
│   ├── STRUCTURE_CLEANUP.md
│   ├── assets/
│   │   └── screenshots/
│   └── archive/
│       └── BACKEND_RESTRUCTURE.md
├── functions/
└── vendor/
```

This hierarchy should be introduced in stages. In the current no-build setup, each move must update `index.html`, `action.html`, preview harnesses, Playwright expectations that fetch source files by path, and `docs/ARCHITECTURE.md`.

## Execution Order

1. Remove deploy exposure first.
   - Keep demo harnesses and unused PDF bundles out of Firebase Hosting.
   - Keep examples, scripts, screenshots, Functions source, and docs ignored from Hosting.

2. Delete or archive confirmed dead files.
   - Completed: removed `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`, and `tests/home-screen-b.spec.js`.
   - Completed: moved tracked screenshots to `docs/assets/screenshots/` to preserve design artifacts without exposing them through Hosting.

3. Move docs into a real docs hierarchy.
   - Completed: active docs live in `AutoDeck AI/docs/`.
   - Completed: historical backend plan lives in `AutoDeck AI/docs/archive/`.

4. Move local-only tools and previews.
   - Completed: moved `preview-*.html` to `AutoDeck AI/dev/preview/`.
   - Completed: replaced `start-server.*` and the Playwright Python server with root `npm run dev` / `npm start` scripts backed by `scripts/dev-server.js`.

5. Re-section browser code.
   - Completed: moved low-risk browser globals `tokens.jsx`, `template-presets.jsx`, and `app-services.jsx` under `AutoDeck AI/app/`.
   - Completed: moved root orchestration file `app.jsx` under `AutoDeck AI/app/`.
   - Completed: grouped auth and account screens under `components/auth/` and `components/account/`.
   - Group remaining screen components by domain.
   - Keep shared browser/function mirrors in their existing locations until `check:shared` is updated for the new paths.

## Acceptance Checks

- `npm run verify`
- Firebase Hosting deploy preview does not include demo harnesses, unused PDF.js bundles, `dev/`, `docs/`, local scripts, examples, or Functions source.
- `index.html` and `action.html` still load without 404s.
- No new skipped tests are introduced.
