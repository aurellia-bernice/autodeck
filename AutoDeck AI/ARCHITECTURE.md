# AutoDeck AI — Architecture Reference

## What is AutoDeck AI?

An internal Quidax tool that turns raw notes or uploaded documents into fully branded presentations. Users paste content or upload a file, choose a style and slide count, and Claude generates a structured deck. Admins manage brand configuration (colours, typography, templates, voice) from a dedicated panel.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| UI Framework | React 18.3.1 (CDN, UMD) | No build step |
| Transpiler | Babel Standalone 7.29.0 | JSX transformed in the browser at runtime |
| Styling | Inline React styles only | Design tokens in `tokens.jsx` |
| Auth | Firebase Auth (compat SDK v10.12.2) | Email/password + Google SSO, @quidax.com restricted |
| Database | Cloud Firestore (compat SDK v10.12.2) | Decks, slides, brand config |
| File Storage | Firebase Storage (compat SDK v10.12.2) | Uploaded source documents |
| Backend | Firebase Cloud Functions v2 (Node.js) | AI generation, DOCX parsing |
| AI Model | Claude via Anthropic SDK | `generateDeck` and `agentEdit` functions |
| PPTX Export | pptxgenjs 3.12.0 (CDN) | Working — downloads `.pptx` |
| PNG Export | html2canvas 1.4.1 (CDN) | Working — captures slide canvas |
| PDF Parsing | PDF.js 3.11.174 (CDN) | In-browser, no server needed |
| DOCX Parsing | mammoth (in Cloud Function) | `parseDocx` function converts to plain text |
| Fonts | Google Fonts (on-demand) | Injected via `<link>` when selected in Admin |
| Images | picsum.photos seed URLs | Placeholder images, no API key |
| Dev server | Python `http.server` / PowerShell / `.bat` | Needed because Babel can't load `.jsx` over `file://` |

---

## File Structure

```
autodeck/
├── firebase.json                   # Hosting public dir = "AutoDeck AI", Functions source
├── package.json                    # Playwright tests only
└── AutoDeck AI/
    ├── index.html                  # Primary entry point — loads all scripts in order
    ├── AutoDeck AI.html            # Compatibility redirect to index.html
    ├── app.jsx                     # Root: routing, auth state, generation logic, brandConfig
    ├── tokens.jsx                  # Design tokens: qxTheme, qxRadius, qxType, qxEase, qxShadow, QX
    ├── template-presets.jsx        # Built-in template recipes until source PPTX/templates are available
    ├── firebase-config.js          # ⚠ Gitignored — Firebase project credentials
    ├── firebase-config.example.js  # Template for firebase-config.js
    ├── functions/
    │   └── index.js                # Cloud Functions: generateDeck, agentEdit, parseDocx
    └── components/
        ├── motion.jsx              # Shared animation helpers
        ├── tweaks-panel.jsx        # Dev overlay: dark mode toggle, screen jump (localStorage)
        ├── Sidebar.jsx             # Left nav — links, user badge, logout, admin-gated Admin link
        ├── LoginScreen.jsx         # Sign in / Sign up / Forgot password / Google SSO
        ├── HomeScreenA.jsx         # Active generate form
        ├── ProcessingScreen.jsx    # Animated generation progress, syncs to real generationStatus
        ├── PreviewScreen.jsx       # Slide outline — inline edit, delete, add, reorder
        ├── SlideGenerator.jsx      # Full slideshow: themes, layouts, alignment, image search, agent
        ├── HistoryScreen.jsx       # Past decks from Firestore (seed fallback if no data)
        ├── AdminScreen.jsx         # Brand config: colours, typography, templates, voice
        ├── ChangePasswordScreen.jsx    # Re-auth + set new password via Firebase Auth
        ├── AccountSettingsScreen.jsx   # Edit display name, view email, member since
        └── ResetPasswordScreen.jsx     # Standalone password reset (linked from email)
```

**Loading order matters.** `tokens.jsx` → `template-presets.jsx` → `motion.jsx` → components → `app.jsx`. Each component file exposes itself globally with `Object.assign(window, { ComponentName })` because the app runs without ES modules.

---

## Screen Flow

```
LoginScreen (sign in / sign up / forgot password / Google SSO)
    │
    └─► HomeScreenA (text input + file upload + slide count + template style)
            │
            └─► ProcessingScreen (animated phases, listens to real generationStatus)
                    │
                    └─► PreviewScreen (slide outline — inline editable)
                                │
                                └─► SlideGenerator (slideshow viewer)
                                        ├── Customise panel (layout, theme, alignment, image)
                                        └── AI Agent panel (chat → modifies slide content)

Sidebar always visible (except Processing + Slideshow):
    ├── Home / Generate
    ├── History
    ├── Account Settings
    └── Admin (email-gated: admin@quidax.com only)

Settings path:
    Sidebar → Account Settings → Change Password
```

---

## Component Responsibilities

### `app.jsx`
- **Screen router** — `screen` state drives which component renders
- **Auth** — `onAuthStateChanged` listener; enforces @quidax.com domain; sets `currentUser`
- **Admin gate** — `isAdminUser(user)` checks email against `ADMIN_EMAILS` array (`['admin@quidax.com']`)
- **Generation orchestration** — `handleGenerate` writes deck to Firestore, calls `generateDeck` Cloud Function, handles timeout (105s), falls back to a client-side draft on failure
- **Brand config** — loads `config/brand` from Firestore on mount; passes `brandConfig` to SlideGenerator and AdminScreen; merges (not replaces) on save via `onBrandSave={(cfg) => setBrandConfig(p => ({ ...p, ...cfg }))}`
- **`slideshowSlides`** — normalised slides array passed into SlideGenerator; set from both AI response and client-side fallback

### `HomeScreenA` (active generate form)
- User inputs: free-text textarea, drag-and-drop file upload, slide count picker (5/8/10/15/Auto), template style (Professional / Minimal / Bold / Fun)
- Template style now resolves through `template-presets.jsx` into a preset contract: allowed layouts, default theme, voice, density, image style, locked sections, and variables.
- **File parsing in the browser:**
  - `.txt` — FileReader
  - `.pdf` — PDF.js
  - `.docx` — calls `parseDocx` Cloud Function (base64 → mammoth → plain text)
- Live word count + estimated slide count shown as the user types
- Prompt idea chips autofill the textarea
- On submit: calls `onGenerate({ inputText, parsedFileText, slideCount, templateStyle, uploadedFile })`

### `ProcessingScreen`
- Props: `config`, `generationStatus` (`'idle' | 'loading' | 'ready' | 'error'`), `generationError`, `onComplete`
- 4 animated phases with a simulated progress bar and streaming slide thumbnail skeletons
- Waits for `generationStatus` to leave `'loading'` before completing — stays open until AI returns
- On error: shows the error message, still calls `onComplete` (fallback slides shown in PreviewScreen)

### `PreviewScreen`
- Receives `slides` (AI-generated or client fallback) and `config`
- Builds a local draft from `config` if slides are empty
- Inline card editing: click pencil → edit title/bullets in place
- Add / delete / reorder slides
- "Open slideshow" passes final slides array up to `app.jsx` → saves to Firestore → navigates to SlideGenerator

### `SlideGenerator`
- Props: `slides`, `config`, `tweaks`, `brandConfig`, `onBack`
- Reads optional slide metadata (`layout`, `theme`, `contentType`, `speakerNotes`, `imagePrompt`) produced by the preset-aware generation flow.
- **Fonts from brand config:** `SlideContent` reads `brandConfig?.displayFont` / `brandConfig?.bodyFont` and falls back to `qxType.display` / `qxType.body` — slide canvas reflects admin typography choices
- **Themes:** 8 colour palettes (Quidax/purple, Midnight, Soft, Ocean, Forest, Sunset, Slate, Rose) + optional custom theme built from `brandConfig.colors`
- **Layouts:** standard, split, bigTitle, stat, quote, image, minimal, centered — per-slide overrides
- **Exports:** PPTX via pptxgenjs (editable text/shapes with preset-aware theme translation, Office-safe font fallbacks, native PowerPoint palettes), PNG via html2canvas (working), PDF via `window.print()`
- **Agent chat:** calls `agentEdit` Cloud Function; falls back to keyword parser if Function unavailable
- Per-slide state: theme override, layout override, alignment, background image

### `HistoryScreen`
- On mount with a logged-in user and Firestore available: subscribes to `decks` collection filtered by `userId`, ordered by `createdAt desc`
- Falls back to 8 hardcoded seed decks if Firestore is unavailable or returns no results
- Shelf view + list view toggle; search by title; filter by template (All / Professional / Minimal / Bold / Fun)
- Delete removes from Firestore (for real decks) and local state

### `AdminScreen`
Four tabs — all changes persist to `config/brand` in Firestore (with `{ merge: true }`) and update app-level `brandConfig` via `onBrandSave`.

**Brand Colours**
- Array-based state (`colorRows`): each row has `{ id, label, role, value }`
- Colour swatch: hover shows pencil overlay + focus ring; `onInput` + `onChange` for live preview
- Picking a new colour auto-updates the row label to the hex value; label is also directly editable
- Add row (dashed `+` button) / delete row (trash icon, red on hover)

**Typography**
- 15 font options (Space Grotesk, Inter, Poppins, Montserrat, Raleway, DM Sans, Nunito, Lato, Roboto, Open Sans, Playfair Display, Lora, Georgia, Arial, Verdana)
- Google Fonts loaded on demand via injected `<link>` tags — no upfront load
- Live preview: display font shown as large headline; body font shown as paragraph text
- Save writes `{ displayFont, bodyFont }` (CSS family strings) to Firestore; SlideGenerator picks these up via `brandConfig`
- AdminScreen initialises pickers from `brandConfig` if fonts were previously saved

**Templates**
- Built-in template presets are displayed first and act as source-free layout recipes while real template files are still pending
- Upload `.pptx` / `.ppt` / `.key` files; displayed in a list with name, upload date, layout count
- Set one template as active (green "Active" badge); others show "Set active" button
- Delete with trash icon (auto-promotes next template to active)
- Note: uploaded template files are stored in component state only — generation currently uses built-in preset contracts instead

**Voice**
- Four options matching the generate tab: Professional / Minimal / Bold / Fun
- Each voice is an expandable card with a radio selector + description + upload area
- Upload area accepts `.pdf` / `.docx` / `.txt` voice documentation per style
- "Doc uploaded" badge appears in the card header when a file is attached
- Note: voice docs are stored in state only — not yet passed to `generateDeck`

### `LoginScreen`
- Modes: sign in, sign up, forgot password
- Real Firebase Auth: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `GoogleAuthProvider`
- `@quidax.com` domain enforced client-side before any Firebase call
- Forgot password: `sendPasswordResetEmail` (sender display name configurable in Firebase Console → Authentication → Templates)
- Sign up sets `displayName` via `updateProfile`

### `ChangePasswordScreen`
- Re-authenticates with current password via `EmailAuthProvider.credential` + `reauthenticateWithCredential`
- Then calls `updatePassword` — required by Firebase for sensitive operations
- Password strength indicator (4 levels)

### `AccountSettingsScreen`
- Edit display name via `firebaseAuth.currentUser.updateProfile`
- Shows email (read-only), member since date from `user.metadata.creationTime`
- Links to Change Password screen

---

## Cloud Functions (`functions/index.js`)

### `generateDeck`
- **Trigger:** HTTPS callable, auth required
- **Input:** `{ deckId, inputText, parsedFileText, slideCount, templateStyle, brandVoice }`
- **Process:** builds a structured prompt with voice guidance → calls Claude (`claude-sonnet-4-5` or similar) → parses JSON array response → normalises slides → updates Firestore deck document
- **Timeout:** 120s function / 105s client-side guard
- **Voice mapping:** `professional` / `bold` / `approachable` / `data` → prompt instruction strings
- **Output:** `{ slides: [{ title, bullets[] }] }`

### `agentEdit`
- **Trigger:** HTTPS callable, auth required
- **Input:** `{ slideTitle, bullets, userMessage, history }`
- **Process:** calls Claude with conversation history → returns updated slide content
- **Output:** `{ updatedTitle?, updatedBullets?, assistantReply }`

### `parseDocx`
- **Trigger:** HTTPS callable, auth required
- **Input:** `{ base64 }` — base64-encoded `.docx` file
- **Process:** mammoth converts DOCX → plain text
- **Output:** `{ text }`

---

## Firestore Data Model

### `decks/{deckId}`
```js
{
  userId: string,
  author: string,
  title: string,
  inputText: string,
  parsedFileText: string,
  templateStyle: 'Professional' | 'Minimal' | 'Bold' | 'Fun',
  slideCount: number,
  slides: [{ title, bullets }],       // top-level copy for quick reads
  uploadedFileUrl: string | null,
  uploadedFileName: string | null,
  createdAt: Timestamp,
  status: 'processing' | 'ready' | 'error',
  error: string | null
}
```

### `decks/{deckId}/slides/{slideId}`
```js
{
  index: number,
  title: string,
  bullets: string[]
}
```

### `config/brand` (singleton)
```js
{
  colorRows: [{ id, label, role, value }],   // hex palette
  voice: 'professional' | 'minimal' | 'bold' | 'fun',
  displayFont: string,                        // CSS font-family
  bodyFont: string,                           // CSS font-family
  voiceDocs: { professional, minimal, bold, fun }  // filenames (state only for now)
}
```

---

## Auth Model

| Rule | Implementation |
|---|---|
| Only @quidax.com emails | Enforced in LoginScreen before Firebase call + in `onAuthStateChanged` (signs out if domain wrong) |
| Admin access | `ADMIN_EMAILS = ['admin@quidax.com']` in `app.jsx` — email comparison |
| Cloud Functions | All three functions check `request.auth` and throw `unauthenticated` if missing |
| Password reset sender name | Set in Firebase Console → Authentication → Templates → Password reset → From name |

---

## Known Gaps

| Gap | Impact | Fix |
|---|---|---|
| Voice docs not passed to generation | Uploaded voice docs (Admin → Voice tab) are stored in state but not sent to `generateDeck` | Pass matching voice doc text alongside `brandVoice` in the Cloud Function call |
| Template source uploads not used in generation | File picked in Admin → Templates is stored in state only | Built-in presets now drive generation; later upload files to Firebase Storage and hydrate the same preset contract |
| PPTX export needs deeper fidelity | Export keeps slides editable and now uses Office-safe fonts plus explicit PowerPoint palettes; browser gradients are represented with editable native shapes | Add layout-by-layout visual regression checks and optional flattened "pixel-perfect" export mode |
| No Firestore security rules documented | Unknown if rules restrict reads/writes correctly | Audit rules in Firebase Console |
