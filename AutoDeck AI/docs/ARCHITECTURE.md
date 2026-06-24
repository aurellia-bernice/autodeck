# AutoDeck AI - Architecture Reference

## Product Summary

AutoDeck AI is an internal Quidax tool that turns a brief, pasted notes, or uploaded source material into a branded presentation. Authenticated Quidax users generate decks, review/edit the outline, open an interactive slide canvas, export the result, and revisit previous decks. Admin users manage the shared brand palette, typography, voice, and template presets.

The app is intentionally build-step-free: Firebase Hosting serves static HTML/JSX, Babel Standalone transpiles JSX in the browser, and Firebase Cloud Functions handle persistence, parsing, source validation, AI generation, image search, and admin writes.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| UI Framework | React 18.3.1 UMD | Loaded from `vendor/`; no bundler |
| JSX Runtime | Babel Standalone 7.29.0 | Browser runtime transform for `.jsx` files |
| Styling | Inline React styles | Shared tokens live in `app/tokens.jsx` |
| Auth | Firebase Auth compat SDK v10.12.2 | Email/password + Google SSO; Quidax domain gate |
| Database | Cloud Firestore compat SDK v10.12.2 | Deck documents, slide subcollections, brand config |
| Storage | Firebase Storage compat SDK v10.12.2 | Temporary parse uploads and optional archived source files |
| Backend | Firebase Cloud Functions v2, Node.js 22 | Callable API surface in `functions/index.js` |
| Primary AI | Anthropic Claude | Deck generation, source-conflict summaries, agent edits |
| Optional AI | Gemini / Imagen | Legacy Gemini generation helper and generated image helper |
| Image Search | Unsplash + optional Gemini query refinement | Used by the slideshow image panel |
| Export | pptxgenjs + html2canvas | Editable `.pptx` and PNG export; PDF uses browser print |
| File Parsing | `pdf-parse`, `mammoth`, `jszip` | Server-side parsing for PDF, DOCX, PPTX, TXT |
| Tests | Playwright | Root `package.json` is test-only |

---

## File Structure

```text
autodeck/
├── firebase.json                         # Hosting, Functions, Firestore, Storage config
├── package.json                          # Local dev, verification, and Playwright scripts
├── scripts/
│   ├── dev-server.js                     # Root local and Playwright static server for AutoDeck AI/
│   ├── check-functions-smoke.js
│   ├── check-generation-helpers.js
│   └── check-shared-sync.js
├── tests/                                # Playwright specs
└── AutoDeck AI/
    ├── index.html                        # Primary hosted entry point
    ├── AutoDeck AI.html                  # Compatibility redirect page
    ├── action.html                       # Firebase account action page
    ├── dev/
    │   └── preview/
    │       ├── preview-home.html         # Isolated Home screen visual harness
    │       ├── preview-conflict.html     # Source conflict visual harness
    │       └── preview-conflict-loading.html
    ├── docs/
    │   ├── ARCHITECTURE.md               # Current architecture reference
    │   ├── GENERATION_WORKFLOW.md        # Current generation flow notes
    │   ├── STRUCTURE_CLEANUP.md          # File cleanup inventory and staged hierarchy plan
    │   ├── assets/
    │   │   └── screenshots/              # Archived product/design screenshots
    │   └── archive/
    │       └── BACKEND_RESTRUCTURE.md    # Historical backend execution plan
    ├── slide-intelligence.jsx            # Browser visual-layout classifier helpers
    ├── slide-objects.jsx                 # Browser editable slide object composer
    ├── app/
    │   ├── app.jsx                       # Root router, auth, deck lifecycle, and screen coordination
    │   ├── app-services.jsx              # Browser-global app services and source-review helpers
    │   ├── template-presets.jsx          # Built-in style/preset contract
    │   └── tokens.jsx                    # qxTheme, QX colors, typography, radius, shadows
    ├── firebase-config.js                # Local public Firebase web config; copy from example
    ├── firebase-config.example.js
    ├── api-config.js                     # Tracked empty globals; real API keys live in Function secrets
    ├── api-config.example.js             # Reference shape only; do not place real keys here
    ├── shared/
    │   └── source-review.js              # Browser source-review heuristics
    ├── firestore.rules                   # Client reads only; writes via Functions
    ├── firestore.indexes.json            # `decks(userId, createdAt desc)`
    ├── storage.rules                     # Owner-scoped upload paths
    ├── storage.cors.json
    ├── functions/
    │   ├── index.js                      # Callable APIs
    │   ├── lib/
    │   │   ├── brand-config.js           # Admin brand read/write handlers
    │   │   ├── deck-storage.js           # Deck create/finalize/save/list/delete handlers
    │   │   ├── file-parsing.js           # Parse callable handlers
    │   │   ├── generation-json.js        # Model JSON extraction/repair helpers
    │   │   ├── generation-normalize.js   # Slide count, layout, component, and slide normalization
    │   │   ├── generation-prompts.js     # Claude/Gemini prompt builders and voice selection
    │   │   ├── generation-service.js     # Claude/Gemini deck generation and agent edit handlers
    │   │   ├── image-search.js           # Unsplash/Imagen handlers and slide image hydration
    │   │   ├── pptx-text.js              # PPTX extraction helper
    │   │   ├── source-cleaning.js        # Source text cleanup helper
    │   │   └── source-conflict.js        # Source-conflict callable handler
    │   ├── shared/
    │   │   └── source-review.js          # Functions copy of browser source-review heuristics
    │   ├── slide-intelligence.js         # Node copy of visual slide intelligence
    │   ├── slide-objects.js              # Node copy of editable slide object composer
    │   └── package.json                  # Function dependencies, Node 22
    └── components/
        ├── motion.jsx
        ├── tweaks-panel.jsx
        ├── Sidebar.jsx
        ├── auth/
        │   ├── LoginScreen.jsx
        │   └── ResetPasswordScreen.jsx
        ├── account/
        │   ├── AccountSettingsScreen.jsx
        │   └── ChangePasswordScreen.jsx
        ├── deck/
        │   ├── HomeScreenA.jsx
        │   ├── SourceConflictScreen.jsx
        │   ├── ProcessingScreen.jsx
        │   ├── PreviewScreen.jsx
        │   └── HistoryScreen.jsx
        ├── slide-editor-model.jsx
        ├── slide-editor-agent.jsx
        ├── slide-editor-export.jsx
        ├── SlideGenerator.jsx
        └── AdminScreen.jsx
```

Loading order matters because there are no ES modules. `index.html` loads vendor libraries, Firebase config, export libraries, `shared/source-review.js`, `app/tokens.jsx`, `slide-intelligence.jsx`, `slide-objects.jsx`, `app/template-presets.jsx`, component helpers such as `components/slide-editor-model.jsx`, `components/slide-editor-agent.jsx`, and `components/slide-editor-export.jsx`, deck workflow components under `components/deck/`, components, `app/app-services.jsx`, and finally `app/app.jsx`. JSX files expose globals on `window`.

The browser and Functions copies of shared runtime logic are checked by `npm run check:shared`. Keep these pairs byte-for-byte aligned unless the sync script is intentionally updated:

- `slide-intelligence.jsx` and `functions/slide-intelligence.js`
- `slide-objects.jsx` and `functions/slide-objects.js`
- `shared/source-review.js` and `functions/shared/source-review.js`

Preview-only HTML files under `dev/preview/` (`preview-home.html`, `preview-conflict.html`, `preview-conflict-loading.html`) are static demo harnesses for isolated visual checks. They are not part of the production navigation flow and are ignored from Firebase Hosting through `dev/**`. `AutoDeck AI.html` is a local compatibility redirect, and `action.html` is the Firebase account-action page.

`docs/STRUCTURE_CLEANUP.md` tracks files that are active, demo-only, archival, or deletion candidates. The `docs/` tree, including archived screenshots, is ignored from Firebase Hosting.

---

## Screen Flow

```text
LoginScreen
  -> HomeScreenA
      -> SourceConflictScreen, when the brief/source is missing, unreadable, or mismatched
      -> ProcessingScreen
          -> PreviewScreen
              -> SlideGenerator

Sidebar, hidden during login/processing/slideshow/conflict:
  -> Home
  -> History
  -> Account Settings
  -> Admin, gated to `admin@quidax.com`

HistoryScreen can open a saved deck directly in SlideGenerator.
Account Settings links to ChangePasswordScreen.
ResetPasswordScreen is the standalone reset target.
```

---

## Frontend Responsibilities

### `app/app.jsx`

- Owns auth state, screen routing, admin gating, active deck id, generation status, and brand config.
- Uses `AutoDeckAppServices` for Firebase callable wrappers, slide normalization, source-review issue construction, temp replacement-file parsing, source upload archiving, and generated-slide reads.
- Enforces the Quidax email domain after Firebase Auth resolves; non-Quidax users are signed out.
- Loads `config/brand` from Firestore and passes it into `AdminScreen` and `SlideGenerator`.
- Runs source review before generation. Client heuristics catch insufficient context, unreadable uploads, and likely mismatches; source mismatches can be confirmed by the `checkSourceConflict` callable.
- Starts generation by calling `createDeck`, subscribing to `decks/{deckId}`, uploading the source archive when enabled, then calling `generateDeck` with a 290s callable timeout and a 300s client deadline.
- Only promotes slides to preview when generated slides are returned by the callable or read back from Firestore. Local/demo drafts are not used as fallback for failed generation.
- Tracks generation stages in `generationTrace` for processing UI and debugging.

### `HomeScreenA`

- Supports prompt mode and layout-template mode.
- Infers `inputMode` as `brief` or `content`; attached files force the textbox to act as a brief.
- Accepts `.pdf`, `.docx`, `.pptx`, and `.txt`. Files are uploaded to `uploads/temp/{uid}/...`, parsed through `parseFile`, then deleted.
- Sends `{ inputText, parsedFileText, slideCount, templateStyle, templatePreset, uploadedFile, inputMode, layoutTemplate }` to `app/app.jsx`.
- Built-in style options come from `AutoDeckTemplatePresets`.

### `SourceConflictScreen`

- Blocks low-confidence generation before a deck is created.
- Shows one of three issue types: `insufficient_context`, `unusable_source`, or `source_mismatch`.
- Lets the user go back to edit, upload a replacement document, or proceed with available information.
- Replacement uploads are parsed with the same temp-storage `parseFile` path and rechecked before continuing.

### `ProcessingScreen`

- Displays animated progress while `generationStatus === 'loading'`.
- Reflects real backend stages from `generationTrace` and waits for `ready` or `error`.
- Shows a delay notice after 45s and respects the 300s client deadline.

### `PreviewScreen`

- Receives generated slides from Firebase/Claude output.
- Allows title and bullet editing, slide add/delete/reorder, regenerate, and opening the deck in slideshow mode.
- Saves edited preview slides through `finalizeDeck` before opening `SlideGenerator` when needed.

### `SlideGenerator`

- Renders the editable slide canvas and export menu.
- Uses `AutoDeckSlideEditorModel` for demo slides, layout metadata, theme construction, brand color derivation, and PowerPoint font normalization.
- Uses `AutoDeckSlideEditorAgent` for agent text parsing/local fallback patches and `AutoDeckSlideEditorExport` for PPTX color/geometry helpers.
- Supports legacy layouts (`standard`, `split`, `bigTitle`, `stat`, `quote`, `image`, `minimal`, `centered`) and intelligent visual layouts (`process_flow`, `comparison`, `timeline`, `statistics`, `hierarchy`, `image_focus`, `roadmap`, `problem_solution`, `feature_breakdown`, `summary`).
- Uses `AutoDeckTemplatePresets` and slide metadata (`layout`, `renderLayout`, `slideType`, `components`, `speakerNotes`, `imagePrompt`) to choose visual treatment.
- Reads admin typography and color config from `brandConfig`.
- Exports editable `.pptx` with native PowerPoint text/shapes and exports PNG with `html2canvas`.
- Calls `searchImages` for Unsplash results and `agentEdit` for chat-driven slide edits; local keyword parsing handles basic layout-change requests when the function is unavailable.

### `HistoryScreen`

- Loads user decks through the `listDecks` callable.
- Falls back to hardcoded seed decks when callable access is unavailable.
- Opens real decks by reading `decks/{deckId}` and `decks/{deckId}/slides`.
- Deletes real decks through the `deleteDeck` callable.

### `AdminScreen`

- Admin-only UI for brand colors, typography, built-in template presets, and voice.
- Persists allowed brand keys through `saveBrand`; direct client writes to `config/brand` are blocked by Firestore rules.
- Template uploads and voice-doc uploads currently remain component state only; built-in presets still drive generation, preview, slideshow, and export.

---

## Cloud Functions

All functions are HTTPS callable, deployed in `us-central1`, require Firebase Auth unless noted by implementation, and use explicit CORS origins for localhost and Firebase Hosting.

`functions/index.js` is the callable export layer. Focused backend modules own the implementation details:

- `lib/brand-config.js`: admin-only brand config reads/writes.
- `lib/deck-storage.js`: deck lifecycle, slide sanitization, persistence, list/delete.
- `lib/file-parsing.js`: direct parse callables and temp-storage parse flow.
- `lib/generation-json.js`: model JSON extraction, local syntax repair, and generation token sizing.
- `lib/generation-normalize.js`: slide count resolution, layout aliases, boolean/component cleanup, and slide normalization.
- `lib/generation-prompts.js`: deck generation, agent edit, Gemini prompt builders, and voice-guide selection.
- `lib/generation-service.js`: callable orchestration for Claude deck generation, Gemini generation, and agent edit.
- `lib/image-search.js`: Unsplash search, Gemini keyword refinement, Imagen helper, generated-slide image hydration.
- `lib/source-conflict.js`: source-conflict callable handler.
- `lib/source-cleaning.js` and `lib/pptx-text.js`: pure parsing/cleanup helpers.

| Function | Purpose |
|---|---|
| `checkSourceConflict` | Fast source review before generation; can use Claude Haiku for mismatch summaries |
| `createDeck` | Creates the initial `decks/{deckId}` document with `status: processing` |
| `generateDeck` | Calls Claude Sonnet, parses/repairs JSON, normalizes slides, persists output |
| `finalizeDeck` | Writes final slide arrays to the deck doc and slide subcollection |
| `markDeckError` | Marks an owned deck as `status: error` from client-side deadline/error paths |
| `attachSourceFile` | Adds archived source file URL/name to an owned deck |
| `agentEdit` | Applies chat edits to slide text/layout with Claude |
| `searchImages` | Searches Unsplash; optionally uses Gemini to refine search keywords |
| `geminiGenerate` | Legacy/alternate Gemini slide generation helper |
| `geminiGenerateImage` | Imagen helper that returns generated image data URLs |
| `parseFile` | Parses PDF/DOCX/PPTX/TXT files from `uploads/temp/{uid}/...`, cleans text, deletes temp file |
| `parseDocx` | Direct base64 DOCX parser kept for compatibility |
| `parsePptx` | Direct base64 PPTX parser kept for compatibility |
| `saveBrand` | Admin-only write path for `config/brand` |
| `getBrand` | Callable brand read helper |
| `listDecks` | Lists the caller's latest 50 decks |
| `deleteDeck` | Deletes an owned deck and its slide subcollection |

### Generation Lifecycle

1. `HomeScreenA` parses any uploaded source file through `parseFile`.
2. `app/app.jsx` runs local source review and, when needed, calls `checkSourceConflict`.
3. If the source is accepted or acknowledged, `createDeck` creates a Firestore deck and returns `deckId`.
4. The client subscribes to `decks/{deckId}` and starts `generateDeck`.
5. `generateDeck` verifies ownership, cleans source text, resolves slide count, builds a preset-aware prompt, calls Claude, repairs/parses JSON, applies slide intelligence, and persists slides.
6. The client finishes when the callable returns slides or the Firestore listener sees `status: ready` and can read stored slides.
7. If the callable returns slides but persistence reports `persisted: false`, the client calls `finalizeDeck`.
8. Errors are recorded with `markDeckError` or by `generateDeck` itself, and the UI shows an explicit no-slides error state.

---

## Data Model

### `decks/{deckId}`

```js
{
  userId: string,
  author: string,
  title: string,
  inputText: string,
  parsedFileText: string,
  templateStyle: 'Professional' | 'Minimal' | 'Bold' | 'Fun',
  templatePresetId: string,
  slideCount: number,
  slides: Slide[],                 // top-level copy for quick reads
  uploadedFileName: string,
  uploadedFileUrl: string,
  status: 'processing' | 'ready' | 'error',
  stage: string,
  error: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  completedAt: Timestamp
}
```

### `decks/{deckId}/slides/{slideId}`

```js
{
  index: number,
  title: string,
  bullets: string[],
  layout: string,
  visualLayout: string | null,
  renderLayout: string | null,
  theme: string | null,
  slideType: string | null,
  visualization: string | null,
  needsIcons: boolean,
  needsChart: boolean,
  needsImage: boolean,
  components: object[],
  storytellingNote: string,
  contentType: string | null,
  kicker: string | null,
  speakerNotes: string,
  imagePrompt: string
}
```

### `config/brand`

```js
{
  colorRows: [{ id, label, role, value }],
  colors: object,
  voice: 'professional' | 'minimal' | 'bold' | 'fun',
  displayFont: string,
  bodyFont: string,
  voiceDocs: {
    professional: string | null,
    minimal: string | null,
    bold: string | null,
    fun: string | null
  }
}
```

### Storage Paths

```text
uploads/temp/{uid}/{fileName}
```

Temporary parsing uploads. Only the owner can read/write/delete; `parseFile` deletes the object after parsing.

```text
uploads/{uid}/{deckId}/{fileName}
```

Optional permanent source archive. `app/app.jsx` only uploads here when `window.AutoDeckSourceUploadsEnabled === true` or `localStorage["autodeck:sourceUploads"] === "enabled"`.

---

## Security Model

- Client auth is restricted to `@quidax.com` in `components/auth/LoginScreen.jsx` and again in `app/app.jsx` after Firebase Auth resolves.
- Admin UI access is controlled by `ADMIN_EMAILS = ['admin@quidax.com']` in the client and `ADMIN_EMAILS_BE` in Functions.
- Firestore rules allow authenticated Quidax users to read only their own decks and slides. `config/brand` is readable by authenticated Quidax users.
- Firestore client writes are denied; deck, slide, and brand writes go through Cloud Functions using Admin SDK.
- Storage rules scope temp uploads and archived source files to the authenticated owner.
- Callable functions verify `request.auth`; deck mutation functions also verify deck ownership.

---

## Configuration

### Required runtime files

- `firebase-config.js` from `firebase-config.example.js`
- `api-config.js` currently defines empty browser globals; real Gemini/Unsplash keys live in Function secrets

`firebase-config.js` identifies the public Firebase client app. It is not a server secret, but it is environment-local and remains ignored; copy it from `firebase-config.example.js`. `api-config.example.js` is a reference shape only; do not place real Gemini or Unsplash keys in browser-delivered files. Server-side API keys stay in Cloud Function secrets.

### Function secrets

- `ANTHROPIC_API_KEY` - required for `generateDeck`, `agentEdit`, and Claude-backed source summaries
- `GEMINI_API_KEY` - required for Gemini/Imagen helpers and optional Unsplash query refinement
- `UNSPLASH_ACCESS_KEY` - required for `searchImages`

### Firebase deployment surfaces

- Hosting public directory: `AutoDeck AI`
- Functions source: `AutoDeck AI/functions`
- Firestore rules/indexes: `AutoDeck AI/firestore.rules`, `AutoDeck AI/firestore.indexes.json`
- Storage rules: `AutoDeck AI/storage.rules`

---

## Tests

The root package is Playwright-only.

```bash
npm run check:shared
npm run check:functions
npm run check:generation
npm test
npm run verify
```

Representative coverage includes login, home/generation forms, source conflict, generation source handling, generation helper smoke checks, processing, preview, slide intelligence, history, sidebar, account settings, and admin flows.

---

## Known Gaps

| Gap | Impact | Next step |
|---|---|---|
| Admin template uploads are not persisted or parsed | Uploaded template files do not affect generation | Store templates in Firebase Storage and hydrate the same preset/layout contract used by `app/template-presets.jsx` |
| Admin voice-doc uploads are filename-only state | Voice documents are not passed to `generateDeck` | Parse and persist voice docs, then include matching style guidance in the generation prompt |
| Home layout-template mode is only partially wired | Selected `SLIDE_TEMPLATES` shape is captured in config but generation still relies on style presets | Pass `layoutTemplate` to `generateDeck` and merge it into the prompt contract |
| PPTX export is high-fidelity but not pixel-perfect | Complex browser styling is represented with editable PowerPoint shapes | Add layout-by-layout export visual checks and consider optional flattened export |
| Folder hierarchy still reflects the original static prototype | Demo harnesses, local scripts, and runtime files still share the hosted root | Execute `docs/STRUCTURE_CLEANUP.md` in small path-update segments with `npm run verify` after each segment |
