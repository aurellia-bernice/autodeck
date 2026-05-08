# AutoDeck AI — Architecture & Database Decision Guide

## What is AutoDeck AI?

AutoDeck AI is an internal Quidax tool that lets employees turn raw notes or uploaded documents into fully branded presentations. It is currently a **client-side prototype** with Firebase Auth integration. While it uses real authentication, the presentation data and state still live in React component memory and are lost on page refresh (no Firestore persistence yet).

---

## Tech Stack (Current)

| Layer | Technology | Why |
|---|---|---|
| UI Framework | React 18.3.1 (CDN, UMD build) | No build step needed |
| Transpiler | Babel Standalone 7.29.0 | Transforms JSX in the browser at runtime |
| Styling | Inline React styles only | No CSS files, no Tailwind, no CSS-in-JS library |
| Dev server | Python `http.server 8080` | Needed because Babel can't load `.jsx` over `file://` |
| Fonts | Calibri / Arial Black (system fonts) | No Google Fonts dependency |
| Images | picsum.photos seed URLs | Free, no API key, consistent results per keyword |
| AI agent | Simulated (keyword rule engine) | No LLM call yet — parses words like "shorter", "add bullet" |
| Auth | Firebase Auth | Integrated with Email/Password and Google SSO |
| Storage | None | Zero persistence — everything resets on refresh |

---

## File Structure

```
AutoDeck AI/
├── AutoDeck AI.html          # Entry point — loads scripts in order via <script type="text/babel">
├── app.jsx                   # Root component, router (screen state), TweaksPanel
├── tokens.jsx                # Design tokens (colors, type, etc.)
├── start-server.sh           # Mac/Linux: python3 -m http.server 8080
├── start-server.bat          # Windows: python -m http.server 8080
└── components/
    ├── motion.jsx            # Shared motion/animation primitives (Framer Motion style)
    ├── tweaks-panel.jsx      # Dev tool: useTweaks hook + TweakToggle/Radio/Select/Section
    ├── LoginScreen.jsx       # Auth UI — email/password form + SSO button
    ├── Sidebar.jsx           # Left nav — Home, History, Admin links + user badge
    ├── HomeScreen.jsx        # Wrapper for Home variants
    ├── HomeScreenA.jsx       # Home variant A
    ├── HomeScreenB.jsx       # Home variant B
    ├── AccountSettingsScreen.jsx # User profile and settings
    ├── ChangePasswordScreen.jsx  # Change password UI
    ├── ResetPasswordScreen.jsx   # Reset password UI
    ├── ProcessingScreen.jsx  # Animated progress screen — 4 phases, ~15s simulated generation
    ├── PreviewScreen.jsx     # Card grid of generated slides — edit, delete, add, reorder
    ├── SlideGenerator.jsx    # Gamma-style slideshow — themes, layouts, alignment, image search, AI agent chat
    ├── HistoryScreen.jsx     # List of past decks — search, filter by template, delete
    └── AdminScreen.jsx       # Brand config — colours, typography, templates, brand voice
```

**Script loading order matters** — `app.jsx` is last because it uses every component. Each component file ends with `Object.assign(window, { ComponentName })` to expose itself globally (since there are no ES modules in this setup).

---

## Screen Flow

```
LoginScreen
    │
    └─► HomeScreen (text input + file upload + config)
            │
            └─► ProcessingScreen (~15s animated generation)
                    │
                    └─► PreviewScreen (card grid — edit/delete/add slides)
                                │
                                └─► SlideGenerator (full slideshow viewer)
                                        ├── Customise panel (layout, image search, theme)
                                        └── Edit with Agent (chat modal → modifies slide content)

Sidebar always visible (except during Processing + Slideshow):
    ├── Home / Generate
    ├── History
    └── Admin (design team only — role-gated)
```

---

## Component Responsibilities

### `app.jsx`
- Single source of truth for screen routing (`screen` state)
- Holds `deckConfig` (the user's generation request) and `slideshowSlides` (slides passed into SlideGenerator)
- Renders `TweaksPanel` — a dev-only overlay for toggling dark mode, user role, and jumping to any screen

### `HomeScreen`
- User inputs: free-text textarea, drag-and-drop file upload (PDF/DOCX/TXT/PPTX), slide count (5/8/10/15/Auto), template style (Professional/Minimal/Bold/Corporate)
- On submit: passes `{ inputText, slideCount, templateStyle, uploadedFile }` up to `app.jsx` as `deckConfig`
- **No actual file parsing or AI call** — the file object is captured but never processed

### `ProcessingScreen`
- Receives `deckConfig` as a prop (doesn't use it — generation is simulated)
- Runs a 4-phase animation (~15 seconds total): "Parsing content" → "Structuring slides" → "Applying brand formatting" → "Finalising"
- On complete: calls `onComplete()` → app moves to PreviewScreen

### `PreviewScreen`
- Generates 10 hardcoded default slides (title + bullets array) regardless of input
- Local state: `slides`, `editingIndex`, `editDraft`
- Features: inline card edit (pencil), delete (trash icon), add new slide (+ button)
- "View as Slideshow" button passes the current slides array up to `app.jsx` → triggers SlideGenerator

### `SlideGenerator`
- The most complex component (~750 lines)
- Props: `slides` (array from PreviewScreen), `config`, `tweaks`, `onBack`
- Local state:
  - `localSlides` — mutable copy; agent chat edits flow here
  - `globalTheme` + `slideThemeOverrides` — per-slide theme overrides
  - `slideLayoutOverrides` — per-slide layout (standard/centered/split/bigTitle/quote/minimal)
  - `slideAlignments` — per-slide text alignment (left/center/right)
  - `slideImages` — per-slide background image URL
  - `agentOpen`, `agentMessages`, `agentInput`, `agentThinking` — AI chat state
- 8 colour themes: Quidax (purple), Midnight, Soft, Ocean, Forest, Sunset, Slate, Rose
- 6 layouts with SVG icon previews, top 4 shown in the edit panel
- Image search via picsum.photos seed URLs (no API key needed)
- Agent: simulated keyword parser — modifies `localSlides` based on instructions
- Export: Print API for PDF; PPTX/PNG are toasts only (not yet implemented)

### `HistoryScreen`
- Hardcoded list of 8 past decks (no real data)
- Client-side search and filter by template style
- Delete animates out with opacity transition

### `AdminScreen`
- Brand config UI with 4 tabs: Colours, Typography, Templates, Brand Voice
- Colour pickers update local state only (not persisted anywhere)
- "Save" buttons show a confirmation toast but write nothing to any store
- Role-gated: `app.jsx` checks `currentUser === 'admin'` before rendering

### `Sidebar`
- Receives `currentScreen` and `onNavigate`
- Admin link only shown when `currentUser === 'admin'`
- No real routing — just calls `onNavigate(dest)` which sets screen state in `app.jsx`

### `tweaks-panel.jsx`
- Dev tool overlay (bottom-right corner)
- `useTweaks(defaults)` hook — persists to `localStorage` so tweaks survive refresh
- Controls: dark mode toggle, user role (Employee/Admin), screen navigation jump

---

## What Data Needs to Persist

This is the full data model implied by the current UI. **None of it is persisted yet.**

### 1. Users
```
{
  id: string,
  email: string,          // e.g. "name@quidax.com"
  role: "employee" | "admin",
  createdAt: timestamp,
  lastLogin: timestamp
}
```

### 2. Decks (generated presentations)
```
{
  id: string,
  userId: string,         // owner
  title: string,          // derived from inputText
  inputText: string,      // original pasted content
  uploadedFileName: string | null,
  slideCount: "5" | "8" | "10" | "15" | "Auto",
  templateStyle: "Professional" | "Minimal" | "Bold" | "Corporate",
  createdAt: timestamp,
  status: "processing" | "ready" | "failed",
  fileSize: number        // MB, shown in History
}
```

### 3. Slides (per deck)
```
{
  id: string,
  deckId: string,
  index: number,          // ordering
  title: string,
  bullets: string[],      // body content
  layout: "standard" | "centered" | "split" | "bigTitle" | "quote" | "minimal",
  theme: string | null,   // null = inherit global theme
  alignment: "left" | "center" | "right",
  backgroundImageUrl: string | null
}
```

### 4. Brand Config (global, admin-managed)
```
{
  id: "singleton",        // one doc
  colors: {
    primary: string,      // hex
    secondary: string,
    accent1: string,
    accent2: string,
    bgDark: string,
    bgLight: string
  },
  headingFont: string,
  bodyFont: string,
  brandVoice: "professional" | "bold" | "approachable" | "data",
  activeMasterTemplate: string,   // filename
  logoUrl: string
}
```

### 5. Agent Chat History (optional, nice-to-have)
```
{
  id: string,
  deckId: string,
  slideId: string,
  messages: [{ role: "user"|"assistant", text: string, timestamp }],
  createdAt: timestamp
}
```

---

## Database Decision: Google Firebase (Firestore)

Given you're considering Google's stack, here is an honest comparison:

### Firebase Firestore ✅ (Recommended for this tool)

**Why it fits:**
- **Internal tool, small team** — Firestore's free tier (Spark) covers ~50k reads/day, 20k writes/day, 1GB storage. An internal team of 50–100 people won't get close to these limits.
- **No backend needed to start** — Firestore's client SDK works directly from the browser. You can add auth, read/write data, and store files (via Firebase Storage for uploaded docs and logos) without writing a single server.
- **Real-time sync is free** — If you want the Processing screen to show live progress from a server-side generation job, Firestore listeners (`onSnapshot`) handle that with zero extra infrastructure.
- **Firebase Auth** handles the login screen (Google SSO, email/password) and gives you proper JWTs — replaces the current fake login with about 10 lines of code.
- **Firebase Storage** holds uploaded documents (PDF/DOCX) and the brand logo — separate from Firestore but same SDK, same console.
- **Works with your current no-build setup** — The Firebase SDK can be loaded via CDN just like React.

**Data model fit:**
- Users → `users/{userId}` document
- Decks → `decks/{deckId}` document with `userId` field (query by user)
- Slides → `decks/{deckId}/slides/{slideId}` subcollection (naturally nested, ordered by `index`)
- Brand config → `config/brand` singleton document (admin writes, all users read)
- Agent chat → `decks/{deckId}/slides/{slideId}/agentHistory` subcollection

**Limitations to know:**
- Firestore is a document/NoSQL store — no joins. If you need to query "all slides across all decks that use the Ocean theme", that requires a top-level `slides` collection (or a composite index). The subcollection model above is simpler but limits cross-deck slide queries.
- Free plan has no SLA. For a production internal tool at a company like Quidax, you'd want the Blaze (pay-as-you-go) plan — still very cheap at this scale, likely under $5/month.

---

### Google Cloud Firestore vs Firebase Firestore
These are the same underlying database. "Firebase Firestore" is the developer-friendly version with the Firebase console, Auth, Storage bundled in. "Cloud Firestore" is the same DB accessed via Google Cloud Console with more granular IAM controls. For an internal tool, **Firebase Firestore is the right entry point** — you can migrate to Cloud Firestore later if Quidax's GCP environment demands it.

---

### Alternatives for comparison

| Option | Fit | Notes |
|---|---|---|
| **Firebase Firestore** | ✅ Best fit | Real-time, no server, auth bundled, free tier generous |
| **Google Cloud SQL (Postgres)** | ⚠️ Overkill | Relational SQL is great but requires a server/API layer — more infra for a small internal tool |
| **Supabase (Postgres + Auth + Storage)** | ✅ Strong alternative | Open-source Firebase equivalent, SQL instead of NoSQL, better for complex queries |
| **PlanetScale / Neon** | ⚠️ Partial | DB only, no auth/storage bundled — need separate solutions |
| **localStorage only** | ❌ Not viable | Already used for tweaks; device-bound, no sharing across users |

---

## What to Build Next (in order)

1. **Persist Decks + Slides to Firestore** — after ProcessingScreen completes, write the generated slides to `decks/{deckId}/slides/`. History screen reads from the same collection filtered by `userId`.
2. **Move generation to a server** — currently the "AI" is a keyword rule engine in the browser. A Cloud Function (or any API) can run a real LLM call, write results to Firestore, and the client listens with `onSnapshot`.
3. **Firebase Storage** for uploaded files (PDF/DOCX) and brand logo.
4. **Brand config** — write AdminScreen's "Save" buttons to the `config/brand` Firestore document. All clients read it on load.

---

## Known Gaps in Current Prototype

| Gap | Impact | Fix |
|---|---|---|
| No real AI generation | Core feature is fake (hardcoded slides) | Integrate Claude/GPT API in a Cloud Function |
| No persistence | History, edits lost on refresh | Firestore |
| File upload UI exists but files aren't parsed | Drag-and-drop accepts files but discards them | Server-side parser (Cloud Function + PDF.js or Unstructured) |
| PPTX export is a toast | "Download PPTX" shows a notification, no file | pptxgenjs library or a server-side export function |
| PNG export is a toast | Same | html2canvas or Puppeteer screenshot |
| Agent is a keyword parser | Very limited edit intelligence | Real LLM call per message |
| Brand config not applied | Admin saves colours but slides ignore them | Pass brand config from Firestore into SlideGenerator themes |
