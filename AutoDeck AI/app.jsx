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

const normalizeDeckSlides = (slides) => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide) => {
      const title = String(slide?.title || '').trim();
      const bullets = Array.isArray(slide?.bullets)
        ? slide.bullets.map((b) => String(b || '').trim()).filter(Boolean)
        : [];
      return { title, bullets: bullets.slice(0, 4) };
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
    .replace(/^[\s\-*0-9.)]+/, '')
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

const buildContextDraftSlides = (config = {}) => {
  const source = [
    config.inputText,
    config.parsedFileText,
    config.uploadedFile?.name ? `Source document: ${config.uploadedFile.name}` : '',
  ].filter(Boolean).join('\n\n').trim();
  if (!source) return [];

  const count = requestedSlideCount(config.slideCount, source);
  const compact = source.replace(/\s+/g, ' ').trim();
  const sentences = (compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact])
    .map((s) => cleanSlideText(s, 22))
    .filter(Boolean);
  const words = compact.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const stop = new Set(['this', 'that', 'with', 'from', 'have', 'will', 'your', 'about', 'into', 'their', 'there', 'where', 'when', 'what', 'were', 'been', 'being', 'they', 'them', 'than', 'then', 'also', 'should', 'could']);
  const keywords = [...new Set(words.filter((w) => !stop.has(w)))].slice(0, 12);

  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * sentences.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sentences.length) / count));
    const chunk = sentences.slice(start, end);
    const focus = chunk[0] || sentences[i % sentences.length] || compact;
    const bullets = chunk.slice(0, 4);

    while (bullets.length < 2) {
      const keyword = keywords[(i + bullets.length) % keywords.length];
      bullets.push(keyword ? `Focus on ${keyword} as a key message` : 'Clarify the main takeaway for this section');
    }

    return {
      title: i === 0 ? titleFromText(compact, 'Presentation Overview') : titleFromText(focus, `Section ${i + 1}`),
      bullets,
    };
  });
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

  const uploadSourceFile = async (deckId, config) => {
    if (!window.firebaseStorage || !deckId || !config?.uploadedFile) return;
    const file = config.uploadedFile;
    const path = `uploads/${deckId}/${file.name}`;
    const snap = await window.firebaseStorage.ref(path).put(file);
    const url = await snap.ref.getDownloadURL();
    await window.firebaseDb.collection('decks').doc(deckId).update({
      uploadedFileUrl: url,
      uploadedFileName: file.name,
    });
  };

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
      const normalized = normalizeDeckSlides(slides);
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
      const rawTitleSource = (config.inputText || config.parsedFileText || config.uploadedFile?.name || 'Untitled deck').trim();
      const title = rawTitleSource.split(/\s+/).slice(0, 8).join(' ');
      deckRef = await window.firebaseDb.collection('decks').add({
        userId: currentUser.uid,
        author: currentUser.displayName || currentUser.email.split('@')[0],
        title,
        inputText: config.inputText || '',
        parsedFileText: config.parsedFileText || '',
        templateStyle: config.templateStyle || 'Professional',
        slideCount: requestedSlideCount(config.slideCount, rawTitleSource),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'processing',
      });
      setActiveDeckId(deckRef.id);
      uploadSourceFile(deckRef.id, config).catch(() => {});

      const generateDeckFn = firebase.app().functions('us-central1').httpsCallable('generateDeck');
      const { data } = await generateDeckFn({
        deckId: deckRef.id,
        inputText: config.inputText || '',
        parsedFileText: config.parsedFileText || '',
        slideCount: config.slideCount || 'Auto',
        templateStyle: config.templateStyle || 'Professional',
        brandVoice: brandConfig?.voice || 'professional',
      });

      const generatedSlides = normalizeDeckSlides(data?.slides);
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
              const finalSlides = normalizeDeckSlides(slides);
              setSlideshowSlides(finalSlides);
              setScreen('slideshow');
              if (window.firebaseDb && currentUser && deckConfig) {
                try {
                  if (activeDeckId) {
                    await window.firebaseDb.collection('decks').doc(activeDeckId).update({
                      status: 'ready',
                      slideCount: finalSlides.length,
                      slides: finalSlides,
                    });
                    uploadSourceFile(activeDeckId, deckConfig).catch(() => {});
                  } else {
                    const rawTitleSource = (deckConfig.inputText || deckConfig.parsedFileText || deckConfig.uploadedFile?.name || 'Untitled deck').trim();
                    const title = rawTitleSource.split(/\s+/).slice(0, 8).join(' ');
                    const deckRef = await window.firebaseDb.collection('decks').add({
                      userId: currentUser.uid,
                      author: currentUser.displayName || currentUser.email.split('@')[0],
                      title,
                      inputText: deckConfig.inputText || '',
                      parsedFileText: deckConfig.parsedFileText || '',
                      templateStyle: deckConfig.templateStyle || 'Professional',
                      slideCount: finalSlides.length,
                      slides: finalSlides,
                      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                      status: 'ready',
                    });
                    const batch = window.firebaseDb.batch();
                    finalSlides.forEach((s, i) => {
                      const ref = deckRef.collection('slides').doc();
                      batch.set(ref, { index: i, title: s.title || '', bullets: s.bullets || [] });
                    });
                    await batch.commit();
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
          <AdminScreen tweaks={tweaks} brandConfig={brandConfig} onBrandSave={setBrandConfig} />
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
