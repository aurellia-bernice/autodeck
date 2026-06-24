# AutoDeck AI — Backend Restructure Specification (v2)

> Status note: this document is a historical restructure plan. Several Phase 1 items have since been implemented, including callable-backed deck/brand writes, server-side parsing, backend image search, and locked Firestore writes. Use `ARCHITECTURE.md` plus the current code as the source of truth before executing any remaining items.

**For any coding agent executing this plan:**
Read every section in full before touching any file. Each phase is independently shippable and must be validated before the next begins. Do not skip phases, reorder steps, or remove any frontend function until the backend replacement is deployed and confirmed working. Violations of these constraints will break the running app.

---

## Table of Contents

1. [Current State — Complete Problem Inventory](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Prerequisites & Project Config](#3-prerequisites--project-config)
4. [Phase 1 — Centralise All Firestore Writes in Cloud Functions](#4-phase-1)
5. [Phase 2 — Move Business Logic to the Backend](#5-phase-2)
6. [Phase 3 — Move File Parsing Fully to the Backend](#6-phase-3)
7. [Phase 4 — Secure All API Keys on the Backend](#7-phase-4)
8. [Phase 5 — Lock Firestore Security Rules (Hard-Gated)](#8-phase-5)
9. [What Must Not Change](#9-what-must-not-change)
10. [Data Contracts Reference](#10-data-contracts-reference)
11. [Deployment Checklist](#11-deployment-checklist)
12. [Post-Restructure Doc Updates](#12-post-restructure-doc-updates)

---

## 1. Current State

### 1.1 The Core Problem

Firebase Cloud Functions already exist (`functions/index.js`) and correctly handle AI generation. The problem is that the frontend (`app.jsx` and component files) bypasses the backend entirely for all data persistence, owns significant business logic, and exposes API keys to the browser.

### 1.2 Complete Firestore Write-Path Inventory

Every direct client-side Firestore write is listed here with its file, line, operation, and the callable that replaces it. **All of these must be eliminated before Phase 5 (security rules) can be deployed.**

| # | File | Line(s) | SDK Call | Operation | Replaced By |
|---|------|---------|----------|-----------|-------------|
| 1 | `app.jsx` | 599–610 | `deckRef.set(buildDeckDocument(...))` | Create initial deck document when generation starts | `createDeck` callable |
| 2 | `app.jsx` | 326–329 | `firebaseDb.collection('decks').doc(deckId).update({ uploadedFileUrl, uploadedFileName })` | Attach uploaded source file URL to deck (inside `uploadSourceFile()`) | `attachSourceFile` callable |
| 3 | `app.jsx` | 334–358 | `batch.set(ref, {...})` loop | Write all slide subcollection documents (inside `writeSlideDocuments()`) | `finalizeDeck` callable |
| 4 | `app.jsx` | 363–368 | `deckRef.set({...}, { merge: true })` | Persist completed deck with ready status (inside `persistGeneratedDeckFromClient()`) | `finalizeDeck` callable |
| 5 | `app.jsx` | 565–569 | `deckRef.update({ status: 'error', ... })` | Write error status on client deadline timeout | `markDeckError` callable |
| 6 | `app.jsx` | 700–707 | `deckRef.update({ status: 'error', ... })` | Write error status in generation catch block | `markDeckError` callable |
| 7 | `app.jsx` | 786–788 | `firebaseDb.collection('decks').doc(activeDeckId).update(readyDeckUpdate(...))` | Mark deck ready + embed slides when user clicks "View Slideshow" (inside `onViewSlideshow` callback) | `finalizeDeck` callable |
| 8 | `app.jsx` | 791–795 | `firebaseDb.collection('decks').add(buildDeckDocument(...))` + `writeSlideDocuments(deckRef, finalSlides)` | Create new deck + write slides when no `activeDeckId` exists at slideshow view time | `finalizeDeck` callable (pass `deckId: null`) |
| 9 | `components/AdminScreen.jsx` | 255 | `firebaseDb.doc('config/brand').set(cfg, { merge: true })` | Save brand config | `saveBrand` callable |
| 10 | `components/AdminScreen.jsx` | 333 | `firebaseDb.doc('config/brand').set(cfg, { merge: true })` | Save brand config | `saveBrand` callable |
| 11 | `components/AdminScreen.jsx` | 502 | `firebaseDb.doc('config/brand').set(cfg, { merge: true })` | Save brand config | `saveBrand` callable |
| 12 | `components/HistoryScreen.jsx` | 67 | `firebaseDb.collection('decks').doc(id).delete()` | Delete a deck | `deleteDeck` callable |

### 1.3 Direct Firestore Reads From the Frontend (Also to Be Replaced)

Reads are lower risk than writes but still expose the data model directly to the client. Replace these in Phase 1 alongside the writes.

| File | Line(s) | Operation | Replaced By |
|------|---------|-----------|-------------|
| `app.jsx` | 464–469 | `firebaseDb.doc('config/brand').get()` | `getBrand` callable |
| `components/HistoryScreen.jsx` | 34–56 | `firebaseDb.collection('decks').where(...).onSnapshot(...)` | `listDecks` callable (one-time load on mount) |

**Exception — keep these reads as-is:**
- `app.jsx` lines 616–633: `deckRef.onSnapshot(...)` — real-time generation status listener. This is a legitimate frontend read pattern and must not be changed.
- `app.jsx` lines 684–691: `readGeneratedSlides(deckRef, ...)` — error recovery fallback read. Keep as-is.

### 1.4 Business Logic in the Frontend (Addressed in Phase 2)

| File | Lines | Logic | Move To |
|------|-------|-------|---------|
| `app.jsx` | 38–59 | `normalizeDeckSlides()` | `functions/index.js` |
| `app.jsx` | 61–66 | `requestedSlideCount()` | `functions/index.js` (duplicate of `resolveSlideCount` — consolidate) |
| `app.jsx` | 68–83 | `cleanSlideText()`, `titleFromText()` | `functions/index.js` |
| `app.jsx` | 84–261 | Draft story frame logic (`buildContextDraftSlides`, etc.) | Remove entirely (dead code in production) |

### 1.5 API Keys Exposed in the Browser (Addressed in Phase 4)

| File | Line(s) | Key Used | Where |
|------|---------|----------|-------|
| `components/SlideGenerator.jsx` | 833–837 | `window.GEMINI_API_KEY` | Direct fetch to `generativelanguage.googleapis.com` for keyword refinement |
| `components/SlideGenerator.jsx` | 855–860 | `window.UNSPLASH_ACCESS_KEY` | Direct fetch to `api.unsplash.com` for image search |
| `api-config.js` | — | Both keys exposed as `window.*` globals | Committed to repo, sent to every browser session |

### 1.6 Security Gap in Existing `generateDeck` Function

`functions/index.js` — the `generateDeck` function at line 519 writes to `decks/{deckId}` using `{ merge: true }` without first verifying that `request.auth.uid === existingDeck.userId`. An attacker who knows a `deckId` could trigger generation on someone else's deck. Fix this in Phase 1 as part of the security hardening section.

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React SPA — no build system, runtime Babel)                     │
│                                                                             │
│  Responsibilities:                                                          │
│    - UI state and component rendering                                       │
│    - Firebase Auth sign-in / sign-out / session display                     │
│    - Calling Cloud Functions for ALL data operations                        │
│    - Reading Firestore via onSnapshot for real-time generation status only  │
│      (the single deck doc during active generation — no other live queries) │
│                                                                             │
│  Does NOT:                                                                  │
│    - Write to Firestore directly (any collection, any document)             │
│    - Delete from Firestore directly                                         │
│    - Call Unsplash or Gemini APIs directly                                  │
│    - Run business logic: slide normalisation, slide count resolution        │
│    - Parse PDF/DOCX/PPTX in the browser                                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │  Firebase Callable Functions (HTTPS)
                               │  Firebase Auth token attached automatically
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│  BACKEND  (Firebase Cloud Functions — Node 22, functions/index.js)          │
│                                                                             │
│  NEW functions added in this restructure:                                   │
│    createDeck         — create initial deck document at generation start    │
│    finalizeDeck       — mark deck ready + write all slides to subcollection │
│    attachSourceFile   — update deck with source file URL after upload       │
│    markDeckError      — write error status to deck                          │
│    saveBrand          — write brand config (admin only)                     │
│    getBrand           — read brand config                                   │
│    listDecks          — return user's decks (replaces onSnapshot query)     │
│    deleteDeck         — delete deck + all slide subcollection docs          │
│    searchImages       — proxy Unsplash (+ optional Gemini keyword refine)   │
│    parseFile          — server-side PDF/DOCX/PPTX/TXT extraction            │
│                                                                             │
│  MODIFIED functions:                                                        │
│    generateDeck       — add ownership verification (security hardening)     │
│                                                                             │
│  EXISTING functions unchanged:                                              │
│    agentEdit          — inline slide editing via Anthropic                  │
│    parseDocx          — kept for backward compatibility                     │
│    parsePptx          — kept for backward compatibility                     │
│    geminiGenerate     — Gemini alternative generation                       │
│    geminiGenerateImage — Imagen 3 generation                                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │  Admin SDK (bypasses security rules)
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│  DATA LAYER                                                                 │
│    Firestore      — decks/{deckId}, decks/{deckId}/slides/{slideId},        │
│                     config/brand                                            │
│    Firebase Auth  — user identity and tokens                                │
│    Firebase Storage — uploaded source files + temp parsing files            │
│    Anthropic API  — claude-sonnet-4-6 (key: ANTHROPIC_API_KEY secret)      │
│    Unsplash API   — image search (key: UNSPLASH_ACCESS_KEY secret)          │
│    Google Gemini  — keyword refinement + Imagen 3 (key: GEMINI_API_KEY)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Prerequisites & Project Config

### 3.1 Update the Parent `autodeck/firebase.json`

A `firebase.json` already exists at **`/autodeck/firebase.json`** (one level above `AutoDeck AI/`). It already has `functions` and `hosting` correctly configured. **Do not create a new `firebase.json` inside `AutoDeck AI/`.** Only edit the parent file.

Add the `firestore` and `storage` sections so it becomes:

```json
{
  "firestore": {
    "rules": "AutoDeck AI/firestore.rules",
    "indexes": "AutoDeck AI/firestore.indexes.json"
  },
  "storage": {
    "rules": "AutoDeck AI/storage.rules"
  },
  "functions": [
    {
      "source": "AutoDeck AI/functions",
      "codebase": "autodeck",
      "ignore": ["node_modules", ".git"]
    }
  ],
  "hosting": {
    "public": "AutoDeck AI",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "screenshots/**",
      "firebase-config.example.js",
      "**/*.sh",
      "**/*.bat",
      "**/*.ps1"
    ],
    "rewrites": [{ "source": "/", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.jsx",
        "headers": [{ "key": "Content-Type", "value": "application/javascript" }]
      }
    ]
  }
}
```

**All `firebase deploy` commands in this spec must be run from `/autodeck/` (the repo root containing `firebase.json`), not from inside `AutoDeck AI/`.** Example:

```bash
cd /path/to/autodeck
firebase deploy --only functions
```

The `firestore.rules`, `firestore.indexes.json`, and `storage.rules` files referenced above must be created at `AutoDeck AI/firestore.rules`, `AutoDeck AI/firestore.indexes.json`, and `AutoDeck AI/storage.rules` respectively (as the paths in `firebase.json` indicate).

### 3.2 Create `firestore.indexes.json` at the Project Root

The `listDecks` function queries by `userId` + orders by `createdAt desc`. Firestore requires a composite index for this. Create `/AutoDeck AI/firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "decks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy this index before Phase 1 goes live: `firebase deploy --only firestore:indexes`

### 3.3 Create `storage.rules` at the Project Root

The `parseFile` function in Phase 3 requires users to upload temp files. Create `/AutoDeck AI/storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Temp parsing uploads: only the owner can write/read/delete their temp files
    match /uploads/temp/{uid}/{fileName} {
      allow read, write, delete: if request.auth != null && request.auth.uid == uid;
    }

    // Permanent source file archives: path is uploads/{uid}/{deckId}/{fileName}
    // so the uid segment can be enforced directly in the rule.
    // Note: uploadSourceFile() in app.jsx must use this path structure (see Section 4.3.6).
    match /uploads/{uid}/{deckId}/{fileName} {
      allow read: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email.matches('.*@quidax\\.com');
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email.matches('.*@quidax\\.com');
    }

    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 3.4 Set Required Firebase Secrets

Run these before deploying any new functions:

```bash
# Required for generation (already set if generateDeck is working)
firebase functions:secrets:set ANTHROPIC_API_KEY

# Required for Phase 4 (move from api-config.js to secret)
firebase functions:secrets:set UNSPLASH_ACCESS_KEY
# Enter the value from api-config.js when prompted

# Required for Phase 4 (Gemini keyword refinement in searchImages + geminiGenerate + geminiGenerateImage)
firebase functions:secrets:set GEMINI_API_KEY
# Enter the Gemini API key when prompted
```

### 3.5 Install New Functions Dependency

Phase 3 requires server-side PDF parsing:

```bash
cd functions && npm install pdf-parse
```

Add `"pdf-parse": "^1.1.1"` to `functions/package.json` under `dependencies`.

---

## 4. Phase 1 — Centralise All Firestore Writes in Cloud Functions

**Goal:** Every item from the write-path inventory (Section 1.2) moves to a Cloud Function. The frontend calls functions only. After this phase, Firestore security rules can be locked (Phase 5).

**Deploy order:** Deploy `functions/index.js` changes first, confirm functions are live in Firebase Console, then update frontend files. Never update the frontend to call a function that isn't deployed yet.

---

### 4.1 Security Hardening — Modify Existing `generateDeck`

In `functions/index.js`, inside the `generateDeck` callable handler, add an ownership check immediately after the `deckId` is validated (after line 479 `if (!deckId) throw ...`):

```javascript
// Add this block immediately after: if (!deckId) throw new HttpsError(...)
const existingDeckSnap = await db.collection('decks').doc(deckId).get();
if (!existingDeckSnap.exists) {
  throw new HttpsError('not-found', 'Deck not found. Create the deck before calling generateDeck.');
}
if (existingDeckSnap.data().userId !== request.auth.uid) {
  throw new HttpsError('permission-denied', 'You do not own this deck.');
}
```

This ensures `generateDeck` can only be called on a deck that was already created by the same user via `createDeck`. It closes the gap where an attacker with a known `deckId` could overwrite another user's deck.

---

### 4.2 New Functions to Add to `functions/index.js`

Add each export in the order shown below, after the existing `parsePptx` export at the end of the file. Each function verifies `request.auth`, validates inputs, checks ownership where applicable, and performs the Firestore operation via the Admin SDK.

---

#### `exports.createDeck`

Replaces the direct `deckRef.set(buildDeckDocument(...))` call at `app.jsx` lines 599–610. Must be called before `generateDeck` — this creates the deck document that `generateDeck` will verify ownership on.

The schema here mirrors `buildDeckDocument()` in `app.jsx` exactly, including `title`, `author`, and `templatePresetId` that were missing from the v1 spec.

```javascript
// ── createDeck ────────────────────────────────────────────────────────────
exports.createDeck = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { inputText, parsedFileText, templateStyle, slideCount, uploadedFileName } = request.data;
    if (!inputText && !parsedFileText) throw new HttpsError('invalid-argument', 'No content provided');

    // Derive title: first 8 words of input (mirrors deckTitleFromConfig in app.jsx)
    const titleSource = String(inputText || parsedFileText || uploadedFileName || 'Untitled deck').trim();
    const title = titleSource.split(/\s+/).slice(0, 8).join(' ');

    // Derive author from token (mirrors deckAuthorFromUser in app.jsx)
    const email = request.auth.token.email || '';
    const author = request.auth.token.name || email.split('@')[0] || 'Unknown';

    // Normalise templatePresetId (mirrors templatePresetIdFromConfig in app.jsx)
    const templatePresetId = (templateStyle || 'professional').toLowerCase().replace(/\s+/g, '-');

    // Resolve slide count: explicit number or word-count heuristic (mirrors requestedSlideCount)
    const explicit = parseInt(slideCount, 10);
    const words = String(inputText || parsedFileText || '').trim().split(/\s+/).length;
    const resolvedSlideCount = Number.isFinite(explicit) && explicit > 0
      ? Math.max(3, Math.min(20, explicit))
      : Math.max(5, Math.min(12, Math.round(words / 80) || 8));

    const deckRef = db.collection('decks').doc();
    await deckRef.set({
      userId: request.auth.uid,
      author,
      title,
      inputText: String(inputText || '').slice(0, 8000),
      parsedFileText: String(parsedFileText || '').slice(0, 20000),
      templateStyle: templateStyle || 'Professional',
      templatePresetId,
      slideCount: resolvedSlideCount,
      uploadedFileName: String(uploadedFileName || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing',
      stage: 'created',
    });

    logger.info('createDeck', { deckId: deckRef.id, uid: request.auth.uid });
    return { deckId: deckRef.id };
  }
);
```

---

#### `exports.finalizeDeck`

Replaces three separate write paths, all of which mark a deck as ready and write its slides:

1. **`persistGeneratedDeckFromClient`** — called at `app.jsx` lines 667–681 when `generateDeck` returns `persisted: false`
2. **`onViewSlideshow` update path** — `app.jsx` line 786: `firebaseDb.collection('decks').doc(activeDeckId).update(readyDeckUpdate(...))`
3. **`onViewSlideshow` create path** — `app.jsx` lines 791–795: `firebaseDb.collection('decks').add(buildDeckDocument(...))` + `writeSlideDocuments()` (the defensive fallback when `activeDeckId` is null)

When `deckId` is provided it updates an existing deck. When `deckId` is null it creates a new deck (case 3 above).

```javascript
// ── finalizeDeck ──────────────────────────────────────────────────────────
exports.finalizeDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, slides, config = {} } = request.data;
    if (!Array.isArray(slides) || !slides.length) throw new HttpsError('invalid-argument', 'slides array is required');

    let deckRef;

    if (deckId) {
      // Update existing deck — verify ownership first
      deckRef = db.collection('decks').doc(deckId);
      const snap = await deckRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
      if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');
    } else {
      // Create new deck document (defensive fallback: no deckId at slideshow view time)
      const email = request.auth.token.email || '';
      const author = request.auth.token.name || email.split('@')[0] || 'Unknown';
      const templatePresetId = (config.templateStyle || 'professional').toLowerCase().replace(/\s+/g, '-');
      const titleSource = String(config.inputText || '').trim();
      const title = titleSource.split(/\s+/).slice(0, 8).join(' ') || 'Untitled deck';

      deckRef = db.collection('decks').doc();
      await deckRef.set({
        userId: request.auth.uid,
        author,
        title,
        inputText: String(config.inputText || '').slice(0, 8000),
        parsedFileText: String(config.parsedFileText || '').slice(0, 20000),
        templateStyle: config.templateStyle || 'Professional',
        templatePresetId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'processing',
        stage: 'created',
      });
    }

    // Write all slides to subcollection + mark deck ready in a batch
    const batch = db.batch();

    batch.set(deckRef, {
      status: 'ready',
      stage: 'ready',
      templatePresetId: (config.templateStyle || 'professional').toLowerCase().replace(/\s+/g, '-'),
      slideCount: slides.length,
      slides,  // embedded copy for quick reads
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    slides.forEach((slide, index) => {
      const slideRef = deckRef.collection('slides')
        .doc(`slide-${String(index + 1).padStart(2, '0')}`);
      batch.set(slideRef, {
        index,
        title: String(slide.title || '').trim(),
        bullets: Array.isArray(slide.bullets)
          ? slide.bullets.map(b => String(b || '').trim()).filter(Boolean)
          : [],
        layout: slide.layout || 'standard',
        visualLayout: slide.visualLayout || slide.layout || null,
        renderLayout: slide.renderLayout || null,
        theme: slide.theme || null,
        slideType: slide.slideType || null,
        visualization: slide.visualization || null,
        needsIcons: slide.needsIcons === true,
        needsChart: slide.needsChart === true,
        needsImage: slide.needsImage === true,
        components: Array.isArray(slide.components) ? slide.components : [],
        storytellingNote: String(slide.storytellingNote || ''),
        contentType: slide.contentType || null,
        kicker: slide.kicker || null,
        speakerNotes: String(slide.speakerNotes || ''),
        imagePrompt: String(slide.imagePrompt || ''),
      });
    });

    await batch.commit();
    logger.info('finalizeDeck', { deckId: deckRef.id, uid: request.auth.uid, slides: slides.length });
    return { deckId: deckRef.id, ok: true };
  }
);
```

---

#### `exports.attachSourceFile`

Replaces the Firestore `.update()` call inside `uploadSourceFile()` at `app.jsx` lines 326–329. The Storage upload itself stays in the frontend (the browser has the file bytes). Only the resulting URL write moves to the backend.

```javascript
// ── attachSourceFile ──────────────────────────────────────────────────────
exports.attachSourceFile = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, uploadedFileUrl, uploadedFileName } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');
    if (!uploadedFileUrl) throw new HttpsError('invalid-argument', 'uploadedFileUrl is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      uploadedFileUrl: String(uploadedFileUrl),
      uploadedFileName: String(uploadedFileName || ''),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);
```

---

#### `exports.markDeckError`

Replaces two separate `deckRef.update({ status: 'error', ... })` calls:
- `app.jsx` lines 565–569: inside `failGenerationOnDeadline()`
- `app.jsx` lines 700–707: inside the generation catch block

```javascript
// ── markDeckError ─────────────────────────────────────────────────────────
exports.markDeckError = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, error, stage } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      status: 'error',
      error: String(error || 'Unknown error').slice(0, 500),
      stage: String(stage || 'client-error'),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);
```

---

#### `exports.saveBrand`

Replaces all three direct Firestore writes in `components/AdminScreen.jsx` (lines 255, 333, 502). Includes admin-only guard.

```javascript
// ── saveBrand ─────────────────────────────────────────────────────────────
const ADMIN_EMAILS_BE = ['admin@quidax.com'];

exports.saveBrand = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const email = (request.auth.token.email || '').toLowerCase();
    if (!ADMIN_EMAILS_BE.includes(email)) throw new HttpsError('permission-denied', 'Admin only');

    const { brand } = request.data;
    if (!brand || typeof brand !== 'object') throw new HttpsError('invalid-argument', 'brand object required');

    // Only persist known safe brand fields — reject arbitrary keys
    const ALLOWED_BRAND_KEYS = ['colorRows', 'colors', 'voice', 'displayFont', 'bodyFont', 'voiceDocs'];
    const safe = {};
    for (const key of ALLOWED_BRAND_KEYS) {
      if (key in brand) safe[key] = brand[key];
    }
    if (!Object.keys(safe).length) throw new HttpsError('invalid-argument', 'No valid brand fields provided');

    await db.collection('config').doc('brand').set(safe, { merge: true });
    return { ok: true };
  }
);
```

---

#### `exports.getBrand`

Replaces the direct Firestore read at `app.jsx` lines 464–469. Any authenticated Quidax user can read brand config.

```javascript
// ── getBrand ──────────────────────────────────────────────────────────────
exports.getBrand = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const snap = await db.collection('config').doc('brand').get();
    if (!snap.exists) return { brand: null };
    return { brand: snap.data() };
  }
);
```

---

#### `exports.listDecks`

Replaces the `onSnapshot` query in `components/HistoryScreen.jsx` lines 34–56. Returns decks for the current user ordered by creation date descending. Converts Firestore Timestamps to ISO strings for safe serialisation.

```javascript
// ── listDecks ─────────────────────────────────────────────────────────────
exports.listDecks = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const snap = await db.collection('decks')
      .where('userId', '==', request.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const decks = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || 'Untitled',
        author: d.author || '',
        template: d.templateStyle || 'Professional',
        slideCount: d.slideCount || 0,
        status: d.status || 'ready',
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return { decks };
  }
);
```

---

#### `exports.deleteDeck`

Replaces the direct `firebaseDb.collection('decks').doc(id).delete()` call in `components/HistoryScreen.jsx` line 67. Deletes the deck document and all documents in its `slides` subcollection.

```javascript
// ── deleteDeck ────────────────────────────────────────────────────────────
exports.deleteDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    // Delete all slides in the subcollection before deleting the deck
    const slideSnap = await deckRef.collection('slides').get();
    const batch = db.batch();
    slideSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(deckRef);
    await batch.commit();

    logger.info('deleteDeck', { deckId, uid: request.auth.uid });
    return { ok: true };
  }
);
```

---

### 4.3 Changes to `app.jsx`

**Important:** Do not remove helper functions (`uploadSourceFile`, `writeSlideDocuments`, `persistGeneratedDeckFromClient`, `buildDeckDocument`, `readyDeckUpdate`) yet. Only change their call sites in this phase. These functions are removed in Phase 2 after the new callables are confirmed working.

Add a shared helper at the top of `app.jsx` (before the `App` component) to avoid repeating the `httpsCallable` boilerplate:

```javascript
// Callable helper — call a Cloud Function by name with a payload
const callFn = (name, payload = {}, timeoutMs = 30000) => {
  const fn = firebase.app().functions('us-central1').httpsCallable(name, { timeout: timeoutMs });
  return fn(payload).then(r => r.data);
};
```

All callable replacements below use this `callFn` helper.

---

#### 4.3.1 Replace initial deck creation (lines 599–614)

**Remove:**
```javascript
deckRef = window.firebaseDb.collection('decks').doc();
const initialDeckWrite = deckRef.set(
  buildDeckDocument(config, currentUser, { status: 'processing' }),
  { merge: true }
).catch((err) => {
  setGenerationTrace((prev) => ({
    ...prev,
    stage: 'deck-write-delayed',
    deckId: deckRef.id,
    message: err?.message || 'Initial Firestore deck write did not complete before generation continued.',
  }));
});
activeDeckIdRef.current = deckRef.id;
setActiveDeckId(deckRef.id);
setGenerationTrace((prev) => ({ ...prev, stage: 'deck-id-created', deckId: deckRef.id }));
uploadSourceFile(deckRef.id, config).catch(() => {});
```

**Replace with:**
```javascript
const newDeckId = await callFn('createDeck', {
  inputText: config.inputText || '',
  parsedFileText: config.parsedFileText || '',
  templateStyle: config.templateStyle || 'Professional',
  slideCount: config.slideCount || 'Auto',
  uploadedFileName: config.uploadedFile?.name || '',
});
// createDeck returns { deckId }
const resolvedDeckId = newDeckId.deckId;
deckRef = window.firebaseDb.collection('decks').doc(resolvedDeckId);
const initialDeckWrite = Promise.resolve(); // deck already created by the function
activeDeckIdRef.current = resolvedDeckId;
setActiveDeckId(resolvedDeckId);
setGenerationTrace((prev) => ({ ...prev, stage: 'deck-id-created', deckId: resolvedDeckId }));
uploadSourceFile(resolvedDeckId, config).catch(() => {});
```

Note: `deckRef` is still used below for the `onSnapshot` listener (lines 616–633) — keep it as a Firestore DocumentReference pointing to the same deck. Do not change the `onSnapshot` block.

---

#### 4.3.2 Replace `persistGeneratedDeckFromClient` call (lines 667–681)

This is the `persisted: false` fallback path.

**Remove:**
```javascript
if (data?.persisted === false) {
  setGenerationTrace((prev) => ({ ...prev, stage: 'client-persisting-generated-slides', deckId: deckRef.id }));
  await withDeadline(
    persistGeneratedDeckFromClient(deckRef, config, generatedSlides),
    GENERATION_STORE_READ_TIMEOUT_MS,
    'Timed out writing generated slides from the client.'
  ).catch((err) => {
    setGenerationTrace((prev) => ({
      ...prev,
      stage: 'client-persist-failed',
      deckId: deckRef.id,
      message: err?.message || 'Client persistence failed after callable returned slides.',
    }));
  });
}
```

**Replace with:**
```javascript
if (data?.persisted === false) {
  setGenerationTrace((prev) => ({ ...prev, stage: 'client-persisting-generated-slides', deckId: deckRef.id }));
  await withDeadline(
    callFn('finalizeDeck', {
      deckId: deckRef.id,
      slides: generatedSlides,
      config: { templateStyle: config.templateStyle },
    }),
    GENERATION_STORE_READ_TIMEOUT_MS,
    'Timed out finalizing deck from the client.'
  ).catch((err) => {
    setGenerationTrace((prev) => ({
      ...prev,
      stage: 'client-persist-failed',
      deckId: deckRef.id,
      message: err?.message || 'Client finalization failed after callable returned slides.',
    }));
  });
}
```

---

#### 4.3.3 Replace `failGenerationOnDeadline` Firestore write (lines 565–569)

**Remove:**
```javascript
if (deckRef) {
  deckRef.update({
    status: 'error',
    error: message,
    stage: 'client-deadline',
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}
```

**Replace with:**
```javascript
if (deckRef) {
  callFn('markDeckError', { deckId: deckRef.id, error: message, stage: 'client-deadline' }).catch(() => {});
}
```

---

#### 4.3.4 Replace error catch Firestore write (lines 700–707)

**Remove:**
```javascript
if (deckRef) {
  deckRef.update({
    status: 'error',
    error: err?.message || message,
    stage: 'client-error',
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}
```

**Replace with:**
```javascript
if (deckRef) {
  callFn('markDeckError', { deckId: deckRef.id, error: err?.message || message, stage: 'client-error' }).catch(() => {});
}
```

---

#### 4.3.5 Replace `onViewSlideshow` Firestore writes (lines 783–799)

This is the callback passed as the `onViewSlideshow` prop to `<PreviewScreen>`. It currently lives entirely in `app.jsx` — it is NOT in `PreviewScreen.jsx`. The writes are at lines 786–795.

**Remove the entire Firestore block inside `onViewSlideshow`:**
```javascript
if (window.firebaseDb && currentUser && deckConfig) {
  try {
    if (activeDeckId) {
      await window.firebaseDb.collection('decks').doc(activeDeckId).update(
        readyDeckUpdate(deckConfig, finalSlides)
      );
      uploadSourceFile(activeDeckId, deckConfig).catch(() => {});
    } else {
      const deckRef = await window.firebaseDb.collection('decks').add(
        buildDeckDocument(deckConfig, currentUser, { status: 'ready', slides: finalSlides })
      );
      await writeSlideDocuments(deckRef, finalSlides);
      uploadSourceFile(deckRef.id, deckConfig).catch(() => {});
    }
  } catch (_) {}
}
```

**Replace with:**
```javascript
if (window.firebase?.app && currentUser && deckConfig) {
  try {
    const result = await callFn('finalizeDeck', {
      deckId: activeDeckId || null,
      slides: finalSlides,
      config: { templateStyle: deckConfig.templateStyle, inputText: deckConfig.inputText },
    });
    const resolvedId = result.deckId || activeDeckId;
    // If finalizeDeck created a new deck (no activeDeckId), persist the returned id
    if (!activeDeckId && resolvedId) {
      activeDeckIdRef.current = resolvedId;
      setActiveDeckId(resolvedId);
    }
    if (resolvedId) uploadSourceFile(resolvedId, deckConfig).catch(() => {});
  } catch (_) {}
}
```

---

#### 4.3.6 Replace `uploadSourceFile` Firestore write + fix Storage path (lines 315–330)

The `uploadSourceFile` function keeps its Storage upload logic but makes two changes: the storage path gains a `uid` segment to match the tightened storage rules in Section 3.3, and the `.update()` Firestore call is replaced with a callable.

**Replace the entire function body with:**
```javascript
const uploadSourceFile = async (deckId, config) => {
  if (!window.firebaseStorage || !deckId || !config?.uploadedFile) return;
  if (!isSourceFileUploadEnabled()) {
    if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = false;
    return;
  }
  if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = true;
  const file = config.uploadedFile;
  const uid = window.firebaseAuth?.currentUser?.uid || '';
  // Path is uploads/{uid}/{deckId}/{fileName} to satisfy uid-scoped storage rules
  const path = `uploads/${uid}/${deckId}/${file.name}`;
  const snap = await window.firebaseStorage.ref(path).put(file);
  const url = await snap.ref.getDownloadURL();
  await callFn('attachSourceFile', { deckId, uploadedFileUrl: url, uploadedFileName: file.name });
};
```

---

#### 4.3.7 Replace brand config direct read (lines 463–469)

**Remove:**
```javascript
React.useEffect(() => {
  if (window.firebaseDb) {
    window.firebaseDb.doc('config/brand').get()
      .then(doc => { if (doc.exists) setBrandConfig(doc.data()); })
      .catch(() => {});
  }
}, []);
```

**Replace with:**
```javascript
React.useEffect(() => {
  if (!window.firebase?.app) return;
  callFn('getBrand', {})
    .then(data => { if (data?.brand) setBrandConfig(data.brand); })
    .catch(() => {});
}, []);
```

---

### 4.4 Changes to `components/AdminScreen.jsx`

Find all three instances of the pattern below (at approximately lines 255, 333, and 502). Each is a direct `set` call to `config/brand`.

**Pattern to find (all three locations):**
```javascript
if (window.firebaseDb) window.firebaseDb.doc('config/brand').set(cfg, { merge: true }).catch(() => {});
```

**Replace each with:**
```javascript
callFn('saveBrand', { brand: cfg }).catch(() => {});
```

`callFn` must be accessible in this file. Since `AdminScreen.jsx` is a separate file, either:
- Duplicate the helper: `const callFn = (name, p) => firebase.app().functions('us-central1').httpsCallable(name)(p).then(r => r.data);`
- Or extract `callFn` into a shared helper file and import it. Given no build system, the duplicate approach is simpler for now.

---

### 4.5 Changes to `components/HistoryScreen.jsx`

**Replace the `onSnapshot` listener (lines 32–57):**

```javascript
// REMOVE this block:
React.useEffect(() => {
  if (!window.firebaseDb || !currentUser?.uid) return;
  const unsub = window.firebaseDb
    .collection('decks')
    .where('userId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => {
      if (snap.empty) return;
      const live = snap.docs.map((doc) => { ... });
      setDecks(live);
    }, () => {});
  return () => unsub();
}, [currentUser?.uid]);

// REPLACE with:
React.useEffect(() => {
  if (!currentUser?.uid || !window.firebase?.app) return;
  const listDecksFn = firebase.app().functions('us-central1').httpsCallable('listDecks');
  listDecksFn({})
    .then(({ data }) => {
      const live = (data.decks || []).map(d => ({
        id: d.id,
        title: d.title || 'Untitled',
        slides: d.slideCount || 0,
        template: d.template || 'Professional',
        date: d.createdAt ? d.createdAt.slice(0, 10) : '',
        size: `${d.slideCount || 0} slides`,
        author: d.author || '',
        favourite: false,
      }));
      setDecks(live);
    })
    .catch(() => {});
}, [currentUser?.uid]);
```

Note: `listDecks` returns `createdAt` as an ISO string. The existing `.slice(0, 10)` date format works directly. Remove any `.toDate()` calls that previously operated on a Firestore Timestamp.

**Replace the `handleDelete` function (lines 64–68):**

```javascript
// REMOVE:
const handleDelete = (id) => {
  setDecks(p => p.filter(d => d.id !== id));
  if (window.firebaseDb && !String(id).startsWith('s')) {
    window.firebaseDb.collection('decks').doc(id).delete().catch(() => {});
  }
};

// REPLACE with:
const handleDelete = (id) => {
  setDecks(p => p.filter(d => d.id !== id)); // optimistic update
  if (!String(id).startsWith('s') && window.firebase?.app) {
    const deleteDeckFn = firebase.app().functions('us-central1').httpsCallable('deleteDeck');
    deleteDeckFn({ deckId: id }).catch(() => {
      // Re-fetch if delete failed
      const listDecksFn = firebase.app().functions('us-central1').httpsCallable('listDecks');
      listDecksFn({}).then(({ data }) => setDecks(data.decks || [])).catch(() => {});
    });
  }
};
```

---

### 4.6 Phase 1 Validation

Before proceeding to Phase 2, verify every item:

- [ ] App loads and brand config appears (AdminScreen shows correct colors/fonts)
- [ ] Starting a generation creates a deck in Firestore (visible in Firebase Console)
- [ ] Generation completes successfully — slides appear in `decks/{deckId}/slides/` subcollection
- [ ] Clicking "View Slideshow" after generation updates the deck status to `ready` in Firestore
- [ ] A forced timeout (if testable) writes `status: 'error'` to Firestore via `markDeckError`
- [ ] History screen loads the user's past decks
- [ ] Deleting a deck from History removes it from Firestore (both deck doc and slides subcollection)
- [ ] Admin brand save writes to `config/brand` in Firestore
- [ ] Source file upload (if enabled) attaches the URL to the deck doc via `attachSourceFile`

---

## 5. Phase 2 — Move Business Logic to the Backend

**Prerequisite:** Phase 1 validated.

**Goal:** Remove frontend code that computes things the backend should own. After this phase, `app.jsx` is a thin orchestration shell.

---

### 5.1 Remove Dead Draft Fallback Logic

The draft story frame functions at `app.jsx` lines 84–261 (`splitDraftSentences`, `draftKeywordsFrom`, `hasDraftKeyword`, `pickDraftSentences`, `buildContextDraftSlides`, etc.) only run when `!window.firebaseDb || !window.firebase?.app`. In production with authenticated users, Firebase is always available. This code path never executes.

**Remove:** All of these functions and the `Object.assign(window, { AutoDeckStoryDraft: ... })` export at line 263.

**Do not replace.** The backend returns an error response when generation fails. No client-side fallback deck is needed.

---

### 5.2 Remove Frontend Helper Functions Now Owned by the Backend

After Phase 1 is confirmed stable, remove these from `app.jsx`:

| Function | Lines | Remove Condition |
|----------|-------|-----------------|
| `buildDeckDocument()` | 288–305 | After Phase 1: deck creation is `createDeck` callable |
| `readyDeckUpdate()` | 307–313 | After Phase 1: deck update is `finalizeDeck` callable |
| `writeSlideDocuments()` | 332–359 | After Phase 1: slide writes are `finalizeDeck` callable |
| `persistGeneratedDeckFromClient()` | 361–368 | After Phase 1: replaced by `finalizeDeck` callable |
| `requestedSlideCount()` | 61–66 | After confirming `createDeck` resolves it server-side |
| `cleanSlideText()`, `titleFromText()` | 68–83 | After confirming backend normalisation is complete |
| `normalizeDeckSlides()` | 38–59 | **Do not remove yet** — still used in `onViewSlideshow` and `handleGenerate` return path. Remove only after backend returns pre-normalised slides |

**Do not remove yet (Phase 2 safety rule):**
- `uploadSourceFile()` — still needed for Phase 3 transition
- `readGeneratedSlides()` — still used in error recovery fallback read at lines 684–691
- `normalizeDeckSlides()` — still applied to slides returned from `generateDeck` at line 656

---

### 5.3 Consolidate `resolveSlideCount` in the Backend

`functions/index.js` already has `resolveSlideCount()`. The frontend's `requestedSlideCount()` is a duplicate. Once `createDeck` is confirmed to resolve slide count correctly server-side, remove `requestedSlideCount` from `app.jsx`.

---

## 6. Phase 3 — Move File Parsing Fully to the Backend

**Prerequisite:** Phase 1 validated. `pdf-parse` installed in `functions/`.

**Goal:** All file parsing (PDF, DOCX, PPTX, TXT) is handled server-side. Browser PDF.js is removed.

---

### 6.1 Add `exports.parseFile` to `functions/index.js`

This function requires the Storage Admin SDK and `pdf-parse`. Add the require at the top of `functions/index.js` (after existing requires):

```javascript
const { getStorage } = require('firebase-admin/storage');
const pdfParse = require('pdf-parse');
```

Add the function export:

```javascript
// ── parseFile ─────────────────────────────────────────────────────────────
exports.parseFile = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { storagePath, fileName } = request.data;
    if (!storagePath) throw new HttpsError('invalid-argument', 'storagePath is required');

    // Security: storagePath must be within the caller's temp upload prefix
    const expectedPrefix = `uploads/temp/${request.auth.uid}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      throw new HttpsError('permission-denied', 'storagePath must be under your own uploads/temp prefix');
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError('not-found', 'File not found in storage');

    const [buffer] = await file.download();
    const ext = String(fileName || storagePath).split('.').pop().toLowerCase();
    let text = '';

    if (ext === 'pdf') {
      const result = await pdfParse(buffer);
      text = result.text || '';
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (ext === 'pptx') {
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort();
      const parts = [];
      for (const name of slideFiles) {
        const xml = await zip.files[name].async('string');
        const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
        parts.push(matches.map(m => m.replace(/<[^>]+>/g, '')).join(' '));
      }
      text = parts.join('\n');
    } else if (ext === 'txt') {
      text = buffer.toString('utf-8');
    } else {
      throw new HttpsError('invalid-argument', `Unsupported file type: .${ext}`);
    }

    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, 20000);

    return {
      text: cleaned,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    };
  }
);
```

---

### 6.2 Changes to `components/HomeScreenA.jsx`

**Remove:** Lines 23–42 (`pdfTextItemsToLines()` and all browser PDF.js usage), lines 44–106 (document parsing cleanup logic), and the entire body of the `parseFile` function (lines 108–149).

**Replace `parseFile` with:**

The new body must preserve whatever loading-state and result-propagation calls the original function made. The original `parseFile` in `HomeScreenA.jsx` calls `setParsing(true/false)` and `setParsedFileText(text)` (or equivalent state setters) — **do not drop these**. Wrap the core logic as shown and keep the state calls in their original positions:

```javascript
const parseFile = async (file) => {
  if (!file) return;
  const uid = window.firebaseAuth?.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx', 'pptx', 'txt'].includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}`);
  }

  setParsing(true);           // ← keep: was in original, signals loading state to the UI
  setParsedFileText('');      // ← keep: clear previous result before new parse

  const storagePath = `uploads/temp/${uid}/${Date.now()}_${file.name}`;
  const storageRef = window.firebaseStorage.ref(storagePath);

  try {
    await storageRef.put(file);
    const parseFileFn = firebase.app().functions('us-central1')
      .httpsCallable('parseFile', { timeout: 120000 });
    const { data } = await parseFileFn({ storagePath, fileName: file.name });
    const text = data.text || '';
    setParsedFileText(text);  // ← keep: propagates result to parent/sibling state
    return text;
  } finally {
    setParsing(false);        // ← keep: always clear loading state
    storageRef.delete().catch(() => {});
  }
};
```

**If the original function used different state setter names** (e.g. `setFileLoading`, `onParsed`, a prop callback), preserve those exact names. The pattern above uses `setParsing` / `setParsedFileText` as representative names — match whatever is in the actual component.

**Completed in cleanup:** `index.html` no longer loads PDF.js, `pdfjsLib` is unused, and the legacy `vendor/pdf.min.js` / `vendor/pdf.worker.min.js` bundles were removed.

---

### 6.3 Phase 3 Validation

- [ ] PDF file: upload and confirm text is extracted
- [ ] DOCX file: upload and confirm text extraction
- [ ] PPTX file: upload and confirm text extraction
- [ ] TXT file: upload and confirm text extraction
- [ ] Confirm temp file is removed from Firebase Storage after `parseFile` returns
- [ ] Confirm an attacker cannot call `parseFile` with `storagePath: 'uploads/temp/other-uid/file.pdf'` — should get `permission-denied`

---

## 7. Phase 4 — Secure All API Keys on the Backend

**Prerequisite:** Phase 1 validated. Both `UNSPLASH_ACCESS_KEY` and `GEMINI_API_KEY` Firebase secrets set (Section 3.4).

**Goal:** No API keys for Unsplash or Gemini are accessible in the browser. `api-config.js` is emptied.

---

### 7.1 The Problem in `components/SlideGenerator.jsx`

The `handleGeminiImageGenerate` function at `SlideGenerator.jsx` lines 824–871 does two direct browser fetches:

1. **Lines 833–852:** Calls `https://generativelanguage.googleapis.com` with `window.GEMINI_API_KEY` to refine the image search query into better keywords
2. **Lines 855–863:** Calls `https://api.unsplash.com` with `window.UNSPLASH_ACCESS_KEY` to search for photos

Both of these need to be replaced with a single `searchImages` callable that handles both steps server-side.

---

### 7.2 Add `exports.searchImages` to `functions/index.js`

This function combines both steps: optional Gemini keyword refinement followed by Unsplash search. It requires both secrets.

```javascript
// ── searchImages ──────────────────────────────────────────────────────────
exports.searchImages = onCall(
  callableOptions({
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['UNSPLASH_ACCESS_KEY', 'GEMINI_API_KEY'],
  }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { query, count = 6, orientation = 'landscape' } = request.data;
    if (!query || !String(query).trim()) throw new HttpsError('invalid-argument', 'query is required');

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) throw new HttpsError('internal', 'Unsplash key not configured');

    // Step 1: Optionally refine query with Gemini (same logic as frontend)
    let searchQuery = String(query).trim();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Convert this into 3 short stock-photo search keywords. Return ONLY the keywords as a comma-separated list, nothing else.\n\n"${compactText(query, 200)}"`,
                }],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 30 },
            }),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          const kw = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (kw) searchQuery = kw;
        }
      } catch (_) {
        // Gemini refinement is optional — fall through to raw query
      }
    }

    // Step 2: Unsplash search
    const uRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&orientation=${orientation}&per_page=${Math.min(count, 10)}&client_id=${unsplashKey}`
    );
    if (!uRes.ok) throw new HttpsError('internal', `Unsplash error: ${uRes.status}`);
    const uData = await uRes.json();

    const images = (uData.results || []).map((p, i) => ({
      id: i,
      src: p.urls?.full || p.urls?.regular,
      thumb: p.urls?.small || p.urls?.thumb,
      alt: p.alt_description || p.description || searchQuery,
      credit: p.user?.name || '',
      creditUrl: p.user?.links?.html || '',
    }));

    return { images, refinedQuery: searchQuery };
  }
);
```

---

### 7.3 Fix `geminiGenerateImage` to Use `callableOptions`

The existing `geminiGenerateImage` export at `functions/index.js` lines 696–734 uses bare options `{ timeoutSeconds: 60, memory: '512MiB', region: 'us-central1' }` instead of `callableOptions()`. This means it does not have the correct CORS config. Fix it:

**Change:**
```javascript
exports.geminiGenerateImage = onCall(
  { timeoutSeconds: 60, memory: '512MiB', region: 'us-central1' },
```

**To:**
```javascript
exports.geminiGenerateImage = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '512MiB', secrets: ['GEMINI_API_KEY'] }),
```

Also add `secrets: ['GEMINI_API_KEY']` to both `geminiGenerate` and `geminiGenerateImage` so their environment gets the key from the Firebase secret store (not a plain environment variable). Search for both exports and update their options objects.

---

### 7.4 Changes to `components/SlideGenerator.jsx`

Replace the entire `handleGeminiImageGenerate` function (lines 824–871).

**Remove:**
```javascript
const handleGeminiImageGenerate = async () => {
  const q = imgQuery.trim();
  if (!q || imgGenerating) return;
  setImgGenerating(true);
  setImgResults([]);
  try {
    let searchQuery = q;
    const geminiKey = window.GEMINI_API_KEY;
    if (geminiKey) {
      // ... direct Gemini fetch ...
    }
    const unsplashKey = window.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) { showToast('Add your Unsplash key to api-config.js', 'info'); return; }
    const uRes = await fetch(`https://api.unsplash.com/search/photos?...&client_id=${unsplashKey}`);
    // ... etc
  } catch (err) { ... } finally { setImgGenerating(false); }
};
```

**Replace with:**
```javascript
const handleGeminiImageGenerate = async () => {
  const q = imgQuery.trim();
  if (!q || imgGenerating) return;
  setImgGenerating(true);
  setImgResults([]);
  try {
    const searchImagesFn = firebase.app().functions('us-central1').httpsCallable('searchImages', { timeout: 30000 });
    const { data } = await searchImagesFn({ query: q, count: 6, orientation: 'landscape' });
    const photos = data.images || [];
    if (photos.length) {
      setImgResults(photos);
    } else {
      showToast('No photos found — try a different prompt', 'info');
    }
  } catch (err) {
    showToast(err.message || 'Image search failed', 'info');
  } finally {
    setImgGenerating(false);
  }
};
```

Update any code that reads `imgResults` items: the shape changes from `{ id, src, thumb }` to `{ id, src, thumb, alt, credit, creditUrl }`. The `src` and `thumb` fields are the same keys so display code should be unaffected.

---

### 7.5 Empty `api-config.js`

After confirming `SlideGenerator.jsx` no longer reads `window.GEMINI_API_KEY` or `window.UNSPLASH_ACCESS_KEY`:

```javascript
// api-config.js
// API keys have moved to Firebase Cloud Function secrets.
// These globals are intentionally empty.
window.GEMINI_API_KEY = '';
window.UNSPLASH_ACCESS_KEY = '';
```

Do not delete this file — it is referenced in `index.html`. Just empty the values.

---

### 7.6 Phase 4 Validation

- [ ] Click "Generate with Gemini" button in the slideshow image panel — photos load from Unsplash
- [ ] No network request to `api.unsplash.com` or `generativelanguage.googleapis.com` visible in browser DevTools Network tab
- [ ] `window.GEMINI_API_KEY` and `window.UNSPLASH_ACCESS_KEY` both return empty string in browser console

---

## 8. Phase 5 — Lock Firestore Security Rules (Hard-Gated)

**This phase has a mandatory gate. Do not proceed until the gate condition is met.**

### 8.1 Hard Gate — Run This Before Deploying Rules

From the project root, run:

```bash
grep -rn "firebaseDb\|\.collection(\|\.doc(\|\.add(\|\.set(\|\.update(\|\.delete(" \
  --include="*.jsx" --include="*.js" \
  --exclude-dir=functions \
  --exclude-dir=vendor \
  --exclude-dir=node_modules \
  .
```

**Required outcome:** Zero results that involve Firestore write operations (`.set(`, `.update(`, `.add(`, `.delete(`). Remaining matches should only be:
- The `onSnapshot` listener in `app.jsx` (read — allowed)
- The `readGeneratedSlides` fallback read in `app.jsx` (read — allowed)
- `window.firebaseDb.collection('decks').doc(deckId)` used to create a `DocumentReference` for `onSnapshot` (reference creation, not a write — allowed)

If any write operations remain: stop, fix them, re-run the grep. Only proceed to Phase 5 when the grep finds zero writes.

---

### 8.2 Create `firestore.rules` at the Project Root

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Decks: authenticated Quidax users can read their own deck docs.
    // All writes are performed by Cloud Functions via Admin SDK (bypasses these rules).
    match /decks/{deckId} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId
        && request.auth.token.email.matches('.*@quidax\\.com');
      allow write: if false;

      // Slides subcollection: same ownership check for reads.
      match /slides/{slideId} {
        allow read: if request.auth != null
          && request.auth.token.email.matches('.*@quidax\\.com')
          && get(/databases/$(database)/documents/decks/$(deckId)).data.userId == request.auth.uid;
        allow write: if false;
      }
    }

    // Brand config: any authenticated Quidax user can read.
    // Writes go through the saveBrand Cloud Function only.
    match /config/brand {
      allow read: if request.auth != null
        && request.auth.token.email.matches('.*@quidax\\.com');
      allow write: if false;
    }

    // Deny all other documents and collections.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 8.3 Deploy Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 8.4 Post-Deployment Verification

- [ ] Attempt a direct Firestore write from the browser console: `window.firebaseDb.doc('decks/test').set({ x: 1 })` — must fail with permission-denied
- [ ] Confirm generation still works end-to-end (the `onSnapshot` read on the deck doc must still fire)
- [ ] Confirm History screen loads (via `listDecks` callable)
- [ ] Confirm Admin brand config loads and saves

---

## 9. What Must Not Change

The following must remain exactly as-is throughout all phases. Do not refactor, rename, or move these.

| Component | Reason |
|-----------|--------|
| `functions/index.js` — `generateDeck` input/output interface | The callable signature `{ deckId, inputText, parsedFileText, sourceDocumentName, slideCount, templateStyle, brandVoice, templatePreset }` → `{ slides, persisted }` must not change |
| `functions/index.js` — `agentEdit` input/output interface | Called from `PreviewScreen.jsx` (or wherever inline slide editing is triggered) |
| `app.jsx` — `onSnapshot` listener (lines 616–633) | Real-time generation status. This is a legitimate frontend read. Must not change |
| `app.jsx` — `readGeneratedSlides()` + error recovery read (lines 684–691) | Error recovery fallback when the Cloud Function call fails but slides were persisted. Legitimate read. Must not change |
| `components/LoginScreen.jsx` — all auth logic | Firebase Auth is correct and complete |
| `firebase-config.js` | Standard Firebase client SDK config. Expected pattern for Firebase apps |
| `slide-intelligence.jsx` (frontend copy) | Used for rendering layout decisions in `SlideGenerator.jsx` and `PreviewScreen.jsx`. The backend copy handles generation metadata; the frontend copy handles rendering. Both coexist intentionally |
| `template-presets.jsx` | Used for rendering and for building the `templatePreset` prompt payload sent to `generateDeck`. Do not move |
| `vendor/` directory | Do not remove any vendor scripts unless explicitly replacing them as described in Phase 3 |
| `functions/slide-intelligence.js` | Backend copy for generation. Do not merge with frontend copy |

---

## 10. Data Contracts Reference

### Callable Function Invocation Pattern (Frontend)

```javascript
// All callables follow this exact pattern
const fn = firebase.app().functions('us-central1').httpsCallable('functionName', { timeout: 30000 });
const { data } = await fn({ ...payload });
// data is the return value from the Cloud Function
// Firebase SDK automatically attaches the current user's auth token
```

Or using the `callFn` helper added in Section 4.3:
```javascript
const result = await callFn('functionName', { ...payload }, timeoutMs);
```

### Complete Function Signatures

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `createDeck` | `{ inputText, parsedFileText, templateStyle, slideCount, uploadedFileName }` | `{ deckId }` | Must be called before `generateDeck` |
| `generateDeck` | `{ deckId, inputText, parsedFileText, sourceDocumentName, slideCount, templateStyle, brandVoice, templatePreset }` | `{ slides[], persisted }` | Existing; now verifies deck ownership |
| `finalizeDeck` | `{ deckId?, slides[], config: { templateStyle, inputText? } }` | `{ deckId, ok }` | Pass `deckId: null` to create new deck |
| `attachSourceFile` | `{ deckId, uploadedFileUrl, uploadedFileName }` | `{ ok }` | Call after Storage upload |
| `markDeckError` | `{ deckId, error, stage }` | `{ ok }` | For client-side timeout/error reporting |
| `agentEdit` | `{ slideTitle, bullets, userMessage, history[] }` | `{ updatedTitle, updatedBullets, assistantReply }` | Existing; unchanged |
| `saveBrand` | `{ brand: { colorRows?, colors?, voice?, displayFont?, bodyFont?, voiceDocs? } }` | `{ ok }` | Admin only |
| `getBrand` | `{}` | `{ brand \| null }` | — |
| `listDecks` | `{}` | `{ decks[] }` | Timestamps as ISO strings |
| `deleteDeck` | `{ deckId }` | `{ ok }` | Deletes deck + all slides subcollection |
| `parseFile` | `{ storagePath, fileName }` | `{ text, wordCount }` | storagePath must be `uploads/temp/{uid}/...` |
| `parseDocx` | `{ base64 }` | `{ text }` | Existing; kept for compatibility |
| `parsePptx` | `{ base64 }` | `{ text }` | Existing; kept for compatibility |
| `searchImages` | `{ query, count?, orientation? }` | `{ images[], refinedQuery }` | Replaces direct Unsplash + Gemini calls |
| `geminiGenerate` | `{ prompt, slideCount }` | `{ slides[] }` | Existing |
| `geminiGenerateImage` | `{ prompt }` | `{ images[] }` | Existing; update to use `callableOptions` |

### `listDecks` Deck Object Shape

```javascript
{
  id:          string,   // Firestore document ID
  title:       string,
  author:      string,
  template:    string,   // templateStyle value
  slideCount:  number,
  status:      string,
  createdAt:   string,   // ISO 8601 (e.g. "2026-06-15T14:32:00.000Z")
  completedAt: string | null
}
```

---

## 11. Deployment Checklist

Execute strictly in this order. Do not move to the next step if the current one fails.

```
PREREQUISITES
[ ] 1.  Set UNSPLASH_ACCESS_KEY Firebase secret
[ ] 2.  Set GEMINI_API_KEY Firebase secret
[ ] 3.  Confirm ANTHROPIC_API_KEY secret exists: firebase functions:secrets:access ANTHROPIC_API_KEY
[ ] 4.  Run: cd functions && npm install pdf-parse
[ ] 5.  Create firebase.json at project root (Section 3.1)
[ ] 6.  Create firestore.indexes.json at project root (Section 3.2)
[ ] 7.  Create storage.rules at project root (Section 3.3)
[ ] 8.  Deploy Firestore index: firebase deploy --only firestore:indexes
[ ] 9.  Deploy Storage rules: firebase deploy --only storage

PHASE 1 — BACKEND
[ ] 10. Add security hardening to generateDeck in functions/index.js (Section 4.1)
[ ] 11. Add createDeck to functions/index.js (Section 4.2)
[ ] 12. Add finalizeDeck to functions/index.js (Section 4.2)
[ ] 13. Add attachSourceFile to functions/index.js (Section 4.2)
[ ] 14. Add markDeckError to functions/index.js (Section 4.2)
[ ] 15. Add saveBrand to functions/index.js (Section 4.2)
[ ] 16. Add getBrand to functions/index.js (Section 4.2)
[ ] 17. Add listDecks to functions/index.js (Section 4.2)
[ ] 18. Add deleteDeck to functions/index.js (Section 4.2)
[ ] 19. Deploy functions: firebase deploy --only functions
[ ] 20. Verify all new functions appear in Firebase Console → Functions

PHASE 1 — FRONTEND
[ ] 21. Add callFn helper to app.jsx (Section 4.3)
[ ] 22. Replace deck creation in app.jsx (Section 4.3.1)
[ ] 23. Replace persistGeneratedDeckFromClient call in app.jsx (Section 4.3.2)
[ ] 24. Replace failGenerationOnDeadline write in app.jsx (Section 4.3.3)
[ ] 25. Replace error catch write in app.jsx (Section 4.3.4)
[ ] 26. Replace onViewSlideshow Firestore writes in app.jsx (Section 4.3.5)
[ ] 27. Replace uploadSourceFile Firestore write in app.jsx (Section 4.3.6)
[ ] 28. Replace brand config read in app.jsx (Section 4.3.7)
[ ] 29. Replace all saveBrand writes in AdminScreen.jsx (Section 4.4)
[ ] 30. Replace onSnapshot listener in HistoryScreen.jsx (Section 4.5)
[ ] 31. Replace handleDelete in HistoryScreen.jsx (Section 4.5)
[ ] 32. Run Phase 1 validation checklist (Section 4.6) — all items must pass

PHASE 2 — BUSINESS LOGIC CLEANUP
[ ] 33. Remove draft fallback functions from app.jsx (Section 5.1)
[ ] 34. Remove buildDeckDocument, readyDeckUpdate, writeSlideDocuments, persistGeneratedDeckFromClient from app.jsx (Section 5.2)
[ ] 35. Remove requestedSlideCount, cleanSlideText, titleFromText from app.jsx (Section 5.2)
[ ] 36. Test generation end-to-end — must still work

PHASE 3 — FILE PARSING
[ ] 37. Apply Storage CORS config (required for browser uploads — file already exists in repo):
        gsutil cors set "AutoDeck AI/storage.cors.json" gs://autodeck-ai.firebasestorage.app
        Run from the autodeck/ repo root. Confirm with: gsutil cors get gs://autodeck-ai.firebasestorage.app
[ ] 38. Add parseFile export to functions/index.js (Section 6.1)
[ ] 39. Deploy functions: firebase deploy --only functions
[ ] 40. Update HomeScreenA.jsx parseFile function (Section 6.2)
[ ] 41. Run Phase 3 validation (all four file types)
[x] 42. Confirm no `.jsx` files use `pdfjsLib` and remove legacy PDF.js bundles

PHASE 4 — API KEY SECURITY
[ ] 43. Fix geminiGenerateImage and geminiGenerate to use callableOptions + secrets (Section 7.3)
[ ] 44. Add searchImages export to functions/index.js (Section 7.2)
[ ] 45. Deploy functions: firebase deploy --only functions
[ ] 46. Replace handleGeminiImageGenerate in SlideGenerator.jsx (Section 7.4)
[ ] 47. Empty api-config.js values (Section 7.5)
[ ] 48. Run Phase 4 validation (Section 7.6) — confirm no direct API calls in Network tab

PHASE 5 — SECURITY RULES GATE
[ ] 49. Run the grep command from Section 8.1
[ ] 50. *** GATE: Zero Firestore write operations in frontend code. If any found, fix them first. ***
[ ] 51. Create firestore.rules at project root (Section 8.2)
[ ] 52. Deploy rules: firebase deploy --only firestore:rules
[ ] 53. Run Phase 5 verification (Section 8.4) — confirm direct write attempt fails in browser console
[ ] 54. Full regression: generation, history, admin, image search, file upload, slideshow export
```

---

## 12. Post-Restructure Doc Updates

After all phases are complete, update these two documents so future agents and developers do not receive conflicting instructions:

### `ARCHITECTURE.md`

Update to reflect:
- Frontend no longer makes direct Firestore writes
- New callables: `createDeck`, `finalizeDeck`, `attachSourceFile`, `markDeckError`, `saveBrand`, `getBrand`, `listDecks`, `deleteDeck`, `searchImages`, `parseFile`
- API keys (`UNSPLASH_ACCESS_KEY`, `GEMINI_API_KEY`) are now Firebase secrets, not browser globals
- `api-config.js` is present but intentionally empty
- Firestore security rules deny all direct client writes

### `GENERATION_WORKFLOW.md`

Update the generation pipeline diagram and description to show:
1. Frontend calls `createDeck` → gets `deckId`
2. Frontend calls `generateDeck` with that `deckId` (backend verifies ownership)
3. Backend writes slides and marks deck ready
4. If `persisted: false`: frontend calls `finalizeDeck` with the slides
5. Frontend listens via `onSnapshot` for real-time status, reads slides when `status: 'ready'`
6. When user views slideshow: frontend calls `finalizeDeck` to persist final state

Remove references to `persistGeneratedDeckFromClient`, `writeSlideDocuments`, `buildDeckDocument`, or any direct Firestore writes from the frontend description.

---

*End of specification — v2.*
