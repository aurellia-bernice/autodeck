// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false,
  "accentColor": "#D946A8"
}/*EDITMODE-END*/;

const ADMIN_EMAILS = ['admin@quidax.com'];
const GENERATION_TIMEOUT_MS = 105000;

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
});

const uploadSourceFile = async (deckId, config) => {
  if (!window.firebaseStorage || !window.firebaseDb || !deckId || !config?.uploadedFile) return;
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
    const ref = deckRef.collection('slides').doc();
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
  const generationRunRef = React.useRef(0);

  const userRole = isAdminUser(currentUser) ? 'admin' : 'employee';

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
    const fallbackSlides = buildContextDraftSlides(config);
    let timeoutId = null;

    setDeckConfig(config);
    setSlideshowSlides(fallbackSlides.length ? fallbackSlides : null);
    setGenerationStatus('loading');
    setGenerationError('');
    setActiveDeckId(null);
    setScreen('processing');

    const finishGeneration = (slides, status, message = '') => {
      if (generationRunRef.current !== runId) return;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const normalized = normalizeDeckSlides(slides, config?.templateStyle);
      setSlideshowSlides(normalized.length ? normalized : fallbackSlides);
      setGenerationStatus(status);
      setGenerationError(message);
    };

    timeoutId = setTimeout(() => {
      finishGeneration(
        fallbackSlides,
        'error',
        'AI generation is taking longer than expected. Showing a draft from your content.'
      );
    }, GENERATION_TIMEOUT_MS);

    if (!window.firebaseDb || !window.firebase?.app || !currentUser) {
      finishGeneration(
        fallbackSlides,
        'error',
        currentUser ? 'AI generation is unavailable. Showing a draft from your content.' : 'Sign in to use AI generation. Showing a draft from your content.'
      );
      return;
    }

    let deckRef = null;
    try {
      deckRef = await window.firebaseDb.collection('decks').add(
        buildDeckDocument(config, currentUser, { status: 'processing' })
      );
      setActiveDeckId(deckRef.id);
      uploadSourceFile(deckRef.id, config).catch(() => {});

      const generateDeckFn = firebase.app().functions('us-central1').httpsCallable('generateDeck');
      const { data } = await generateDeckFn({
        deckId: deckRef.id,
        inputText: config.inputText || '',
        parsedFileText: config.parsedFileText || '',
        sourceDocumentName: config.uploadedFile?.name || '',
        slideCount: config.slideCount || 'Auto',
        templateStyle: config.templateStyle || 'Professional',
        templatePreset: config.templatePreset || window.AutoDeckTemplatePresets?.summarizeForPrompt?.(config.templateStyle),
        brandVoice: brandConfig?.voice || config.templatePreset?.id || window.AutoDeckTemplatePresets?.normalizeTemplateStyle?.(config.templateStyle) || 'professional',
      });

      const generatedSlides = normalizeDeckSlides(data?.slides, config.templateStyle);
      if (!generatedSlides.length) {
        throw new Error('The AI service returned no slides.');
      }
      finishGeneration(generatedSlides, 'ready');
    } catch (err) {
      const message = 'AI generation failed. Showing a draft from your content.';
      if (deckRef) {
        deckRef.update({ status: 'error', error: err?.message || message }).catch(() => {});
      }
      finishGeneration(fallbackSlides, 'error', message);
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
