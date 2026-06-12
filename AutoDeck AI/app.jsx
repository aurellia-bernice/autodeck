// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false,
  "accentColor": "#D946A8"
}/*EDITMODE-END*/;

const ADMIN_EMAILS = ['admin@quidax.com'];
const GENERATION_DELAY_NOTICE_MS = 45000;
const GENERATION_FUNCTION_TIMEOUT_MS = 290000;
const GENERATION_CLIENT_DEADLINE_MS = 300000;
const GENERATION_STORE_READ_TIMEOUT_MS = 10000;
const AUTODECK_BUILD_ID = 'gen-auth-2026-06-12';
const SOURCE_UPLOAD_STORAGE_KEY = 'autodeck:sourceUploads';

const isSourceFileUploadEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.AutoDeckSourceUploadsEnabled === true
    || window.localStorage?.getItem(SOURCE_UPLOAD_STORAGE_KEY) === 'enabled';
};

if (typeof window !== 'undefined') {
  Object.assign(window, {
    AutoDeckBuild: {
      id: AUTODECK_BUILD_ID,
      sourceUploadStorageKey: SOURCE_UPLOAD_STORAGE_KEY,
      sourceUploadsEnabled: isSourceFileUploadEnabled(),
    },
  });
}

const isAdminUser = (user) => {
  const email = user?.email?.toLowerCase();
  return ADMIN_EMAILS.includes(email);
};

const normalizeDeckSlides = (slides, templateStyle = 'Professional') => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide, index) => {
      const title = String(slide?.title || '').trim();
      const bullets = Array.isArray(slide?.bullets)
        ? slide.bullets.map((b) => String(b || '').trim()).filter(Boolean)
        : [];
      const normalized = {
        ...slide,
        title,
        bullets: bullets.slice(0, 4),
        contentType: String(slide?.contentType || slide?.kicker || 'section').trim(),
        speakerNotes: String(slide?.speakerNotes || '').trim(),
        imagePrompt: String(slide?.imagePrompt || '').trim(),
      };
      return window.AutoDeckTemplatePresets?.enhanceSlide
        ? window.AutoDeckTemplatePresets.enhanceSlide(normalized, index, slide?.templateStyle || templateStyle)
        : normalized;
    })
    .filter((slide) => slide.title || slide.bullets.length);
};

const requestedSlideCount = (slideCount, sourceText = '') => {
  const explicit = parseInt(slideCount, 10);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(3, Math.min(20, explicit));
  const words = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  return Math.max(5, Math.min(12, Math.round(words / 80) || 8));
};

const cleanSlideText = (value, maxWords = 18) => {
  const words = String(value || '')
    .replace(/^[^A-Za-z0-9$]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, maxWords).join(' ').replace(/[.,;:!]+$/, '');
};

const titleFromText = (text, fallback) => {
  const cleaned = cleanSlideText(text, 8);
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const splitDraftSentences = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

const DRAFT_STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'about', 'into', 'their', 'there', 'where',
  'when', 'what', 'were', 'been', 'being', 'they', 'them', 'than', 'then', 'also', 'should', 'could',
  'would', 'these', 'those', 'because', 'through', 'between', 'within', 'without', 'document', 'presentation',
]);

const draftKeywordsFrom = (value) => {
  const words = String(value || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return [...new Set(words.filter((word) => !DRAFT_STOP_WORDS.has(word)))].slice(0, 18);
};

const hasDraftKeyword = (sentence, keywords = []) => {
  const text = String(sentence || '').toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
};

const draftKeywordOverlap = (brief, source) => {
  const sourceKeywords = draftKeywordsFrom(source);
  if (!sourceKeywords.length) return 0;
  return draftKeywordsFrom(brief).filter((keyword) =>
    sourceKeywords.some((sourceKeyword) => sourceKeyword.includes(keyword) || keyword.includes(sourceKeyword))
  ).length;
};

const draftBriefMatchesSource = (brief, source) => {
  if (!String(source || '').trim() || !String(brief || '').trim()) return true;
  const briefKeywords = draftKeywordsFrom(brief);
  if (briefKeywords.length < 3) return true;
  return draftKeywordOverlap(brief, source) >= Math.min(3, Math.max(1, Math.floor(briefKeywords.length * 0.25)));
};

const isDraftSourceNoise = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  if (/^[^\w]*\d{1,3}[^\w]*$/.test(text)) return true;
  if (/^(page|slide)\s+\d+$/i.test(text)) return true;
  if (/^(contents|table of contents|agenda)$/i.test(text)) return true;
  if (/\bprepared for\b|\bprepared by\b/.test(lower)) return true;
  if (/\bthis guide breaks down every concept\b/.test(lower)) return true;
  const sectionRefs = (text.match(/\b\d{1,2}\s+[A-Z][A-Za-z]/g) || []).length;
  const capitalizedWords = (text.match(/\b[A-Z][A-Za-z]{3,}\b/g) || []).length;
  return sectionRefs >= 2 && capitalizedWords >= 4;
};

const draftSentencesFromSource = (value) => {
  const rawSentences = splitDraftSentences(value).length ? splitDraftSentences(value) : [value];
  const filtered = rawSentences
    .map((sentence) => String(sentence || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((sentence) => !isDraftSourceNoise(sentence));
  return (filtered.length ? filtered : rawSentences)
    .map((sentence) => cleanSlideText(sentence, 22))
    .filter(Boolean);
};

const draftHasUsableMetric = (value) =>
  /\b\d+(?:\.\d+)?\s*(%|x|×|m|k|b|bn|usd|\$|₦|days?|weeks?|months?|years?|users?|customers?|transactions?|revenue|growth|tickets?|hours?|mins?)\b/i.test(String(value || ''));

const draftLayoutFor = (frame, bullets, index) => {
  const text = [frame?.title, ...(bullets || [])].join(' ');
  if (frame?.contentType === 'opening') return 'bigTitle';
  if (frame?.contentType === 'evidence' && draftHasUsableMetric(text)) return 'stat';
  if (['problem', 'plan', 'risk', 'decision'].includes(frame?.contentType)) return 'split';
  if (frame?.contentType === 'next steps') return 'minimal';
  return index % 2 ? 'standard' : 'split';
};

const draftTitleFor = (candidate, frame) => {
  const title = String(candidate || '').trim();
  if (!title || /^(when|instead|you|it|this|that|there|here)\b/i.test(title)) {
    return frame.title;
  }
  return title;
};

const pickDraftSentences = (sentences, keywords, used, index, count) => {
  const matched = [];
  sentences.forEach((sentence, sentenceIndex) => {
    if (matched.length >= 3 || used.has(sentenceIndex)) return;
    if (hasDraftKeyword(sentence, keywords)) {
      matched.push({ sentence, sentenceIndex });
      used.add(sentenceIndex);
    }
  });
  if (matched.length) return matched.map((item) => item.sentence);

  const start = Math.floor((index * sentences.length) / Math.max(1, count));
  const picked = [];
  for (let offset = 0; picked.length < 3 && offset < sentences.length; offset++) {
    const sentenceIndex = (start + offset) % sentences.length;
    if (used.has(sentenceIndex)) continue;
    picked.push(sentences[sentenceIndex]);
    used.add(sentenceIndex);
  }
  return picked;
};

const draftStoryFrames = (count) => {
  const frames = [
    { title: 'Core message', kicker: 'Storyline', contentType: 'opening', keywords: ['summary', 'objective', 'goal', 'purpose', 'important', 'takeaway', 'overview'] },
    { title: 'Context that matters', kicker: 'Context', contentType: 'context', keywords: ['context', 'market', 'customer', 'team', 'current', 'background', 'today'] },
    { title: 'What the source shows', kicker: 'Evidence', contentType: 'evidence', keywords: ['data', 'metric', 'growth', 'revenue', 'result', 'performance', 'increase', 'decrease', 'users', 'volume', 'percent'] },
    { title: 'Problem or opportunity', kicker: 'Tension', contentType: 'problem', keywords: ['problem', 'challenge', 'risk', 'gap', 'issue', 'opportunity', 'need', 'barrier'] },
    { title: 'Recommended path forward', kicker: 'Plan', contentType: 'plan', keywords: ['plan', 'strategy', 'solution', 'roadmap', 'phase', 'initiative', 'launch', 'build', 'deliver'] },
    { title: 'Risks and tradeoffs', kicker: 'Watchouts', contentType: 'risk', keywords: ['risk', 'dependency', 'constraint', 'concern', 'tradeoff', 'blocker', 'delay', 'compliance'] },
    { title: 'Decisions and asks', kicker: 'Decision', contentType: 'decision', keywords: ['decision', 'approve', 'ask', 'request', 'recommend', 'owner', 'budget', 'signoff'] },
    { title: 'Next steps', kicker: 'Next steps', contentType: 'next steps', keywords: ['next', 'action', 'timeline', 'owner', 'follow', 'complete', 'start', 'finish', 'due'] },
  ];
  if (count <= 5) return [frames[0], frames[1], frames[3], frames[4], frames[7]].slice(0, count);
  if (count === 6) return [frames[0], frames[1], frames[2], frames[3], frames[4], frames[7]];
  if (count === 7) return [frames[0], frames[1], frames[2], frames[3], frames[4], frames[6], frames[7]];
  return [...frames, ...frames.slice(2)].slice(0, count);
};

const buildContextDraftSlides = (config = {}) => {
  const userInstruction = String(config.inputText || '').trim();
  const documentText = String(config.parsedFileText || '').trim();
  const fileName = String(config.uploadedFile?.name || '').trim();
  const source = [
    documentText,
    userInstruction,
    fileName ? `Source document: ${fileName}` : '',
  ].filter(Boolean).join('\n\n').trim();
  if (!source) return [];

  const count = requestedSlideCount(config.slideCount, source);
  const sourceForSlides = documentText || userInstruction || source;
  const sentences = draftSentencesFromSource(sourceForSlides);
  const keywords = draftKeywordsFrom(`${userInstruction}\n${documentText}`);
  const frames = draftStoryFrames(count);
  const used = new Set();
  const briefMatchesSource = draftBriefMatchesSource(userInstruction, documentText);

  const draftSlides = frames.map((frame, i) => {
    const frameKeywords = [...frame.keywords, ...keywords.slice(i, i + 4)];
    let bullets = pickDraftSentences(sentences, frameKeywords, used, i, frames.length)
      .map((sentence) => cleanSlideText(sentence, 26))
      .filter(Boolean);

    if (i === 0 && userInstruction) {
      bullets.unshift(
        briefMatchesSource
          ? `Requested focus: ${cleanSlideText(userInstruction, 24)}`
          : 'Source fit: uploaded document does not support the requested brief; this draft follows the document content'
      );
    }
    if (i === 0 && fileName && !documentText) {
      bullets.push(`Source document attached: ${fileName}`);
    }
    while (bullets.length < 2) {
      const keyword = keywords[(i + bullets.length) % Math.max(1, keywords.length)];
      bullets.push(keyword ? `Clarify how ${keyword} shapes this part of the story` : 'Add a source-backed takeaway for this section');
    }
    bullets = [...new Set(bullets)].slice(0, 4);

    return {
      title: draftTitleFor(
        titleFromText(bullets.find((b) => !b.startsWith('Requested focus:') && !b.startsWith('Source fit:')) || bullets[0], frame.title),
        frame
      ),
      layout: draftLayoutFor(frame, bullets, i),
      contentType: frame.contentType,
      kicker: frame.kicker,
      bullets,
      speakerNotes: userInstruction ? `User direction: ${cleanSlideText(userInstruction, 30)}` : '',
      imagePrompt: '',
    };
  });
  return window.AutoDeckTemplatePresets?.enhanceSlides
    ? window.AutoDeckTemplatePresets.enhanceSlides(draftSlides, config.templateStyle)
    : draftSlides;
};

Object.assign(window, { AutoDeckStoryDraft: { buildSlides: buildContextDraftSlides } });

const deckTitleSource = (config = {}) => (
  config.inputText ||
  config.parsedFileText ||
  config.uploadedFile?.name ||
  'Untitled deck'
).trim();

const deckTitleFromConfig = (config = {}) => deckTitleSource(config)
  .split(/\s+/)
  .slice(0, 8)
  .join(' ');

const deckAuthorFromUser = (user = {}) => (
  user.displayName ||
  user.email?.split('@')[0] ||
  'Unknown'
);

const templatePresetIdFromConfig = (config = {}) => (
  window.AutoDeckTemplatePresets?.normalizeTemplateStyle?.(config.templateStyle) ||
  'professional'
);

const buildDeckDocument = (config = {}, user = {}, options = {}) => {
  const slides = Array.isArray(options.slides) ? options.slides : null;
  const titleSource = deckTitleSource(config);
  const doc = {
    userId: user.uid,
    author: deckAuthorFromUser(user),
    title: deckTitleFromConfig(config),
    inputText: config.inputText || '',
    parsedFileText: config.parsedFileText || '',
    templateStyle: config.templateStyle || 'Professional',
    templatePresetId: templatePresetIdFromConfig(config),
    slideCount: slides ? slides.length : requestedSlideCount(config.slideCount, titleSource),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: options.status || 'processing',
  };
  if (slides) doc.slides = slides;
  return doc;
};

const readyDeckUpdate = (config = {}, slides = []) => ({
  status: 'ready',
  templatePresetId: templatePresetIdFromConfig(config),
  slideCount: slides.length,
  slides,
  completedAt: firebase.firestore.FieldValue.serverTimestamp(),
});

const uploadSourceFile = async (deckId, config) => {
  if (!window.firebaseStorage || !window.firebaseDb || !deckId || !config?.uploadedFile) return;
  if (!isSourceFileUploadEnabled()) {
    if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = false;
    return;
  }
  if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = true;
  const file = config.uploadedFile;
  const path = `uploads/${deckId}/${file.name}`;
  const snap = await window.firebaseStorage.ref(path).put(file);
  const url = await snap.ref.getDownloadURL();
  await window.firebaseDb.collection('decks').doc(deckId).update({
    uploadedFileUrl: url,
    uploadedFileName: file.name,
  });
};

const writeSlideDocuments = async (deckRef, slides = []) => {
  if (!deckRef || !Array.isArray(slides) || !slides.length || !window.firebaseDb) return;
  const batch = window.firebaseDb.batch();
  slides.forEach((slide, index) => {
    const ref = deckRef.collection('slides').doc(`slide-${String(index + 1).padStart(2, '0')}`);
    batch.set(ref, {
      index,
      title: slide.title || '',
      bullets: slide.bullets || [],
      layout: slide.layout || 'standard',
      theme: slide.theme || null,
      contentType: slide.contentType || null,
      speakerNotes: slide.speakerNotes || '',
      imagePrompt: slide.imagePrompt || '',
    });
  });
  await batch.commit();
};

const persistGeneratedDeckFromClient = async (deckRef, config, slides = []) => {
  if (!deckRef || !Array.isArray(slides) || !slides.length) return;
  await deckRef.set({
    ...readyDeckUpdate(config, slides),
    stage: 'ready',
  }, { merge: true });
  await writeSlideDocuments(deckRef, slides);
};

const readGeneratedSlides = async (deckRef, templateStyle = 'Professional') => {
  if (!deckRef) return [];
  const deckSnap = await deckRef.get();
  const deckSlides = normalizeDeckSlides(deckSnap.data()?.slides, templateStyle);
  if (deckSlides.length) return deckSlides;

  const slideSnap = await deckRef.collection('slides').orderBy('index').get();
  return normalizeDeckSlides(slideSnap.docs.map((doc) => doc.data()), templateStyle);
};

const withDeadline = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  const id = setTimeout(() => reject(new Error(message)), timeoutMs);
  Promise.resolve(promise)
    .then(resolve, reject)
    .finally(() => clearTimeout(id));
});

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('login');
  const [deckConfig, setDeckConfig] = React.useState(null);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");
  const [slideshowSlides, setSlideshowSlides] = React.useState(null);
  const [brandConfig, setBrandConfig] = React.useState(null);
  const [generationStatus, setGenerationStatus] = React.useState('idle');
  const [generationError, setGenerationError] = React.useState('');
  const [activeDeckId, setActiveDeckId] = React.useState(null);
  const [generationTrace, setGenerationTrace] = React.useState({ stage: 'idle', deckId: null });
  const generationRunRef = React.useRef(0);
  const generationDeckUnsubRef = React.useRef(null);
  const activeDeckIdRef = React.useRef(null);

  const userRole = isAdminUser(currentUser) ? 'admin' : 'employee';

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.autodeckBuild = AUTODECK_BUILD_ID;
    }
  }, []);

  React.useEffect(() => {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!isLocalhost) return undefined;

    const handleDebugGenerationState = (event) => {
      const data = event?.data || {};
      if (data.type !== '__autodeck_debug_generation_state') return;

      setDeckConfig(data.config || {
        inputText: 'Debug deck source content',
        slideCount: '5',
        templateStyle: 'Professional',
      });
      setSlideshowSlides(Array.isArray(data.slides) ? data.slides : null);
      setGenerationStatus(data.status || 'idle');
      setGenerationError(data.error || '');
      activeDeckIdRef.current = data.deckId || null;
      setActiveDeckId(data.deckId || null);
      setGenerationTrace(data.trace || { stage: data.status || 'idle', deckId: data.deckId || null });
      if (data.currentUser) setCurrentUser(data.currentUser);
      setScreen(data.screen || 'preview');
    };

    window.addEventListener('message', handleDebugGenerationState);
    return () => window.removeEventListener('message', handleDebugGenerationState);
  }, []);

  React.useEffect(() => {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!isLocalhost) return undefined;

    window.__autodeck_generation_debug = () => ({
      buildId: AUTODECK_BUILD_ID,
      screen,
      generationStatus,
      generationError,
      activeDeckId: activeDeckId || activeDeckIdRef.current || generationTrace?.deckId || null,
      generationTrace,
      requestedSlides: deckConfig?.slideCount || null,
      templateStyle: deckConfig?.templateStyle || null,
      sourceDocumentName: deckConfig?.uploadedFile?.name || '',
      sourceUploadsEnabled: isSourceFileUploadEnabled(),
      generatedSlideCount: Array.isArray(slideshowSlides) ? slideshowSlides.length : 0,
    });

    window.localStorage?.setItem('autodeck:lastGenerationDebug', JSON.stringify(window.__autodeck_generation_debug()));
    return () => {
      delete window.__autodeck_generation_debug;
    };
  }, [screen, generationStatus, generationError, activeDeckId, generationTrace, deckConfig, slideshowSlides]);

  React.useEffect(() => {
    if (window.firebaseDb) {
      window.firebaseDb.doc('config/brand').get()
        .then(doc => { if (doc.exists) setBrandConfig(doc.data()); })
        .catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (user) => {
      setAuthReady(true);
      if (user) {
        if (!user.email.toLowerCase().endsWith('@quidax.com')) {
          await window.firebaseAuth.signOut();
          setAuthError("Only @quidax.com accounts are allowed.");
          return;
        }
        const signedInUser = { email: user.email, uid: user.uid, displayName: user.displayName };
        setCurrentUser(signedInUser);
        setAuthError("");
        setScreen(prev => prev === 'login' ? (isAdminUser(signedInUser) ? 'admin' : 'home') : prev);
      } else {
        setCurrentUser(null);
        setScreen('login');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setScreen(isAdminUser(userData) ? 'admin' : 'home');
  };

  const handleLogout = async () => {
    await window.firebaseAuth.signOut();
  };

  if (!authReady) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#1A0530' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ animation: 'lgSpin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="#7B2FBE" strokeWidth="2.5" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#D946A8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes lgSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleGenerate = async (config) => {
    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    if (generationDeckUnsubRef.current) {
      generationDeckUnsubRef.current();
      generationDeckUnsubRef.current = null;
    }
    let delayNoticeId = null;
    let clientDeadlineId = null;
    let deckRef = null;
    const startedAt = Date.now();
    const deadlineAt = startedAt + GENERATION_CLIENT_DEADLINE_MS;

    setDeckConfig(config);
    setSlideshowSlides(null);
    setGenerationStatus('loading');
    setGenerationError('');
    activeDeckIdRef.current = null;
    setActiveDeckId(null);
    setGenerationTrace({ stage: 'starting', deckId: null, startedAt, deadlineAt });
    setScreen('processing');

    const finishGeneration = (slides, status, message = '') => {
      if (generationRunRef.current !== runId) return;
      if (delayNoticeId) {
        clearTimeout(delayNoticeId);
        delayNoticeId = null;
      }
      if (clientDeadlineId) {
        clearTimeout(clientDeadlineId);
        clientDeadlineId = null;
      }
      if (generationDeckUnsubRef.current) {
        generationDeckUnsubRef.current();
        generationDeckUnsubRef.current = null;
      }
      const normalized = normalizeDeckSlides(slides, config?.templateStyle);
      setSlideshowSlides(status === 'ready' && normalized.length ? normalized : null);
      setGenerationStatus(status);
      setGenerationError(message);
      setGenerationTrace((prev) => ({
        ...prev,
        deckId: prev?.deckId || activeDeckIdRef.current || null,
        stage: status === 'error' ? (prev?.stage || status) : status,
        message,
      }));
    };

    const failGenerationOnDeadline = () => {
      if (generationRunRef.current !== runId) return;
      const message = `AI generation exceeded the ${Math.round(GENERATION_CLIENT_DEADLINE_MS / 1000)} second client deadline before generated slides were returned. No local draft was used.`;
      if (deckRef) {
        deckRef.update({
          status: 'error',
          error: message,
          stage: 'client-deadline',
          completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      setGenerationTrace((prev) => ({
        ...prev,
        deckId: prev?.deckId || activeDeckIdRef.current || deckRef?.id || null,
        stage: 'client-deadline',
        message,
      }));
      finishGeneration([], 'error', message);
    };

    clientDeadlineId = setTimeout(failGenerationOnDeadline, GENERATION_CLIENT_DEADLINE_MS);

    delayNoticeId = setTimeout(() => {
      if (generationRunRef.current !== runId) return;
      setGenerationError(`AI generation is still running in Firebase. AutoDeck will stop waiting after ${Math.round(GENERATION_CLIENT_DEADLINE_MS / 1000)} seconds if no generated slides arrive.`);
      setGenerationTrace((prev) => ({ ...prev, stage: 'still-waiting' }));
    }, GENERATION_DELAY_NOTICE_MS);

    if (!window.firebaseDb || !window.firebase?.app || !currentUser) {
      finishGeneration(
        [],
        'error',
        currentUser ? 'AI generation is unavailable. No local draft was used.' : 'Sign in to use AI generation.'
      );
      return;
    }

    try {
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

      generationDeckUnsubRef.current = deckRef.onSnapshot(async (snap) => {
        if (generationRunRef.current !== runId || !snap.exists) return;
        const deck = snap.data() || {};
        if (deck.status === 'ready') {
          setGenerationTrace((prev) => ({ ...prev, stage: 'firestore-ready', deckId: deckRef.id }));
          const slides = await withDeadline(
            readGeneratedSlides(deckRef, config.templateStyle),
            GENERATION_STORE_READ_TIMEOUT_MS,
            'Timed out reading generated slides from Firestore.'
          ).catch(() => []);
          if (slides.length) finishGeneration(slides, 'ready');
        } else if (deck.status === 'error') {
          setGenerationTrace((prev) => ({ ...prev, stage: 'firestore-error', deckId: deckRef.id }));
          finishGeneration([], 'error', deck.error || 'AI generation failed before returning slides.');
        } else if (deck.stage) {
          setGenerationTrace((prev) => ({ ...prev, stage: deck.stage, deckId: deckRef.id }));
        }
      }, () => {});

      const generateDeckFn = firebase.app().functions('us-central1').httpsCallable('generateDeck', {
        timeout: GENERATION_FUNCTION_TIMEOUT_MS,
      });
      setGenerationTrace((prev) => ({ ...prev, stage: 'calling-generateDeck', deckId: deckRef.id }));
      const { data } = await withDeadline(generateDeckFn({
        deckId: deckRef.id,
        inputText: config.inputText || '',
        parsedFileText: config.parsedFileText || '',
        sourceDocumentName: config.uploadedFile?.name || '',
        slideCount: config.slideCount || 'Auto',
        templateStyle: config.templateStyle || 'Professional',
        templatePreset: config.templatePreset || window.AutoDeckTemplatePresets?.summarizeForPrompt?.(config.templateStyle),
        brandVoice: brandConfig?.voice || config.templatePreset?.id || window.AutoDeckTemplatePresets?.normalizeTemplateStyle?.(config.templateStyle) || 'professional',
      }), GENERATION_CLIENT_DEADLINE_MS, `AI generation exceeded the ${Math.round(GENERATION_CLIENT_DEADLINE_MS / 1000)} second client deadline before generated slides were returned.`);
      await withDeadline(
        initialDeckWrite,
        GENERATION_STORE_READ_TIMEOUT_MS,
        'Initial Firestore deck write did not acknowledge before callable returned.'
      ).catch(() => {});
      setGenerationTrace((prev) => ({ ...prev, stage: 'callable-returned', deckId: deckRef.id }));

      const generatedSlides = normalizeDeckSlides(data?.slides, config.templateStyle);
      if (!generatedSlides.length) {
        const storedSlides = await withDeadline(
          readGeneratedSlides(deckRef, config.templateStyle),
          GENERATION_STORE_READ_TIMEOUT_MS,
          'Timed out reading generated slides from Firestore.'
        );
        if (!storedSlides.length) throw new Error('The AI service returned no slides.');
        finishGeneration(storedSlides, 'ready');
        return;
      }
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
      finishGeneration(generatedSlides, 'ready');
    } catch (err) {
      const storedSlides = deckRef ? await withDeadline(
        readGeneratedSlides(deckRef, config.templateStyle),
        GENERATION_STORE_READ_TIMEOUT_MS,
        'Timed out reading generated slides from Firestore.'
      ).catch(() => []) : [];
      if (storedSlides.length) {
        finishGeneration(storedSlides, 'ready');
        return;
      }
      const message = `AI generation failed before generated slides were returned${err?.message ? `: ${err.message}` : '.'}`;
      setGenerationTrace((prev) => ({
        ...prev,
        deckId: prev?.deckId || activeDeckIdRef.current || deckRef?.id || null,
        stage: 'error',
        message,
      }));
      if (deckRef) {
        deckRef.update({
          status: 'error',
          error: err?.message || message,
          stage: 'client-error',
          completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      finishGeneration([], 'error', message);
    }
  };

  const handleProcessingComplete = () => {
    setScreen('preview');
  };

  const handleGenerateAgain = () => {
    setScreen('home');
  };

  const handleNavigate = (dest) => {
    setScreen(dest);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: tweaks?.darkMode ? '#0F031F' : '#FAF8FC'
    }}>
      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} authError={authError} onClearAuthError={() => setAuthError("")} />
      )}
      {screen !== 'login' && screen !== 'processing' && screen !== 'slideshow' && (
        <Sidebar
          currentScreen={screen}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
          onChangePassword={() => setScreen('changePassword')}
          onSettings={() => setScreen('settings')}
          darkMode={tweaks?.darkMode}
          onToggleDark={() => setTweak('darkMode', !tweaks?.darkMode)}
          buildId={AUTODECK_BUILD_ID}
        />
      )}

      {screen !== 'login' && <div style={{
        flex: 1,
        marginLeft: (screen !== 'processing' && screen !== 'slideshow') ? '224px' : 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh'
      }}>
        {screen === 'home' && (
          <HomeScreenA onGenerate={handleGenerate} tweaks={tweaks} />
        )}
        {screen === 'processing' && (
          <ProcessingScreen
            config={deckConfig}
            generationStatus={generationStatus}
            generationError={generationError}
            activeDeckId={activeDeckId}
            generationTrace={generationTrace}
            onComplete={handleProcessingComplete}
            tweaks={tweaks}
          />
        )}
        {screen === 'preview' && (
          <PreviewScreen
            config={deckConfig}
            slides={slideshowSlides || []}
            generationStatus={generationStatus}
            generationError={generationError}
            activeDeckId={activeDeckId}
            generationTrace={generationTrace}
            onGenerateAgain={handleGenerateAgain}
            onViewSlideshow={async (slides) => {
              const finalSlides = normalizeDeckSlides(slides, deckConfig?.templateStyle);
              setSlideshowSlides(finalSlides);
              setScreen('slideshow');
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
            }}
            tweaks={tweaks}
          />
        )}
        {screen === 'slideshow' && (
          <SlideGenerator
            slides={slideshowSlides || []}
            config={deckConfig}
            tweaks={tweaks}
            brandConfig={brandConfig}
            onBack={() => setScreen('preview')}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen tweaks={tweaks} currentUser={currentUser} />
        )}
        {screen === 'changePassword' && (
          <ChangePasswordScreen tweaks={tweaks} onBack={() => setScreen('settings')} />
        )}
        {screen === 'settings' && (
          <AccountSettingsScreen
            tweaks={tweaks}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onUserUpdated={(updated) => setCurrentUser(updated)}
          />
        )}
        {screen === 'admin' && userRole === 'admin' && (
          <AdminScreen tweaks={tweaks} brandConfig={brandConfig} onBrandSave={(cfg) => setBrandConfig(p => ({ ...p, ...cfg }))} />
        )}
        {screen === 'admin' && userRole !== 'admin' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: tweaks?.darkMode ? 'rgba(255,255,255,0.4)' : '#9080A0',
            gap: '12px'
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
              <rect x="10" y="22" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 22v-6a8 8 0 0116 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="33" r="2" fill="currentColor"/>
            </svg>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>Admin access only</div>
            <div style={{ fontSize: '14px' }}>Sign in with an admin account to view this panel</div>
          </div>
        )}
      </div>}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakToggle
            label="Dark Mode"
            value={tweaks?.darkMode}
            onChange={v => setTweak('darkMode', v)}
          />
        </TweakSection>
        <TweakSection title="Navigation">
          <TweakSelect
            label="Go to Screen"
            value={screen}
            options={[
              { label: 'Login', value: 'login' },
              { label: 'Home / Generate', value: 'home' },
              { label: 'Processing', value: 'processing' },
              { label: 'Preview & Download', value: 'preview' },
              { label: 'Slideshow', value: 'slideshow' },
              { label: 'History', value: 'history' },
              { label: 'Admin Panel', value: 'admin' },
              { label: 'Change Password', value: 'changePassword' },
              { label: 'Account Settings', value: 'settings' },
            ]}
            onChange={v => {
              if (v === 'processing') {
                setDeckConfig({ inputText: 'Sample content for demo preview', slideCount: '10', templateStyle: 'Professional' });
              }
              if (v === 'preview' && !deckConfig) {
                setDeckConfig({ inputText: 'Q2 Sales Strategy and market expansion plan for Quidax', slideCount: '10', templateStyle: 'Professional' });
              }
              setScreen(v);
            }}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
