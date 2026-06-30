// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false,
  "accentColor": "#D946A8"
}/*EDITMODE-END*/;

const {
  AUTODECK_BUILD_ID,
  GENERATION_CLIENT_DEADLINE_MS,
  GENERATION_DELAY_NOTICE_MS,
  GENERATION_FUNCTION_TIMEOUT_MS,
  GENERATION_STORE_READ_TIMEOUT_MS,
  buildSourceReviewData,
  callFn,
  getSourceReviewIssue,
  isAdminUser,
  isSourceFileUploadEnabled,
  normalizeDeckSlides,
  parseReplacementFile,
  readGeneratedSlides,
  uploadSourceFile,
  withDeadline,
} = window.AutoDeckAppServices;

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

  // Source conflict workflow
  const [conflictData, setConflictData] = React.useState(null);
  const [conflictConfig, setConflictConfig] = React.useState(null);
  const [conflictRechecking, setConflictRechecking] = React.useState(false);

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
      inputMode: deckConfig?.inputMode || null,
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
    if (!window.firebase?.app) return;
    callFn('getBrand', {})
      .then(data => { if (data?.brand) setBrandConfig(data.brand); })
      .catch((err) => { console.warn('[AutoDeck] getBrand failed:', err); });
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
    // ── Source conflict pre-check ──
    // Block unsupported drafts before creating a deck. The user can still choose
    // to proceed from the review screen, but we do not silently generate filler.
    if (!config.conflictAcknowledged) {
      const reviewIssue = getSourceReviewIssue(config);
      if (reviewIssue) {
        setConflictConfig(config);
        setScreen('conflict');
        if (reviewIssue.issueType !== 'source_mismatch') {
          setConflictData(reviewIssue);
          return;
        }

        setConflictData(null);
        callFn('checkSourceConflict', {
          inputText: config.inputText,
          parsedFileText: config.parsedFileText,
          sourceDocumentName: config.uploadedFile?.name || '',
        }, 30000)
          .then(result => {
            if (result?.hasConflict) {
              setConflictData({
                ...reviewIssue,
                ...result,
                issueType: result.issueType || reviewIssue.issueType,
                title: result.title || reviewIssue.title,
                message: result.message || reviewIssue.message,
                uploadLabel: result.uploadLabel || reviewIssue.uploadLabel,
              });
            } else {
              handleConflictProceed({ ...config, conflictAcknowledged: true });
            }
          })
          .catch(() => {
            setConflictData({
              ...reviewIssue,
              docSummary: 'Source analysis is temporarily unavailable.',
              recommendations: ['Verify that your document matches the requested deck topic before proceeding.'],
            });
          });
        return;
      }
    }

    setConflictData(null);
    setConflictConfig(null);

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
        callFn('markDeckError', { deckId: deckRef.id, error: message, stage: 'client-deadline' }).catch((err) => { console.warn('[AutoDeck] markDeckError (deadline) failed:', err); });
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
      const newDeck = await callFn('createDeck', {
        inputText: config.inputText || '',
        parsedFileText: config.parsedFileText || '',
        templateStyle: config.templateStyle || 'Professional',
        slideCount: config.slideCount || 'Auto',
        uploadedFileName: config.uploadedFile?.name || '',
      });
      const resolvedDeckId = newDeck.deckId;
      deckRef = window.firebaseDb.collection('decks').doc(resolvedDeckId);
      activeDeckIdRef.current = resolvedDeckId;
      setActiveDeckId(resolvedDeckId);
      setGenerationTrace((prev) => ({ ...prev, stage: 'deck-id-created', deckId: resolvedDeckId }));
      uploadSourceFile(resolvedDeckId, config).catch((err) => { console.warn('[AutoDeck] uploadSourceFile failed:', err); });

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
        brandAssets: Array.isArray(brandConfig?.brandAssets) ? brandConfig.brandAssets : [],
        inputMode: config.inputMode || 'brief',
      }), GENERATION_CLIENT_DEADLINE_MS, `AI generation exceeded the ${Math.round(GENERATION_CLIENT_DEADLINE_MS / 1000)} second client deadline before generated slides were returned.`);
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
        callFn('markDeckError', { deckId: deckRef.id, error: err?.message || message, stage: 'client-error' }).catch((markErr) => { console.warn('[AutoDeck] markDeckError (client-error) failed:', markErr); });
      }
      if (/too few usable slides|returned no slides|no slides/i.test(err?.message || '')) {
        setConflictConfig(config);
        setConflictData(buildSourceReviewData({
          issueType: 'insufficient_context',
          config,
          docSummary: 'AutoDeck could not find enough usable information to build a reliable slide draft.',
          briefSummary: String(config?.inputText || '').trim() || 'No concrete brief was provided.',
          missingItems: [
            'Enough source facts to support multiple slides',
            'A clear audience, objective, and intended takeaway',
            'Specific examples, metrics, roles, sections, or decisions to structure the deck around',
          ],
          recommendations: [
            'Paste a short outline with the key points each slide should cover.',
            'Upload a source document with the facts, examples, metrics, or notes the deck should use.',
          ],
        }));
        setGenerationStatus('idle');
        setGenerationError('');
        setScreen('conflict');
        return;
      }
      finishGeneration([], 'error', message);
    }
  };

  const handleProcessingComplete = () => {
    setScreen('preview');
  };

  const handleGenerateAgain = () => {
    if (!deckConfig) {
      setScreen('home');
      return;
    }
    handleGenerate({ ...deckConfig, conflictAcknowledged: true });
  };

  // Conflict screen: user chose "Proceed with available info" or conflict cleared
  const handleConflictProceed = (cfg) => {
    setConflictData(null);
    setConflictConfig(null);
    handleGenerate(cfg); // cfg has conflictAcknowledged: true, bypasses pre-check
  };

  // Conflict screen: user uploaded a new replacement document
  const handleConflictReupload = async (file) => {
    setConflictRechecking(true);
    try {
      const newParsed = await parseReplacementFile(file);
      const updatedConfig = {
        ...conflictConfig,
        uploadedFile: file,
        parsedFileText: newParsed,
        conflictAcknowledged: false, // re-check with new file
      };
      setConflictConfig(updatedConfig);
      const reviewIssue = getSourceReviewIssue(updatedConfig);
      if (!reviewIssue) {
        // New file is fine — proceed
        setConflictData(null);
        setConflictRechecking(false);
        handleGenerate({ ...updatedConfig, conflictAcknowledged: true });
        return;
      }
      if (reviewIssue.issueType !== 'source_mismatch') {
        setConflictData(reviewIssue);
        setConflictRechecking(false);
        return;
      }
      // Still a mismatch — fetch fresh conflict summary for the new file
      const result = await callFn('checkSourceConflict', {
        inputText: updatedConfig.inputText,
        parsedFileText: newParsed,
        sourceDocumentName: file.name,
      }, 30000).catch(() => null);
      setConflictData(result?.hasConflict ? {
        ...reviewIssue,
        ...result,
        issueType: result.issueType || reviewIssue.issueType,
        title: result.title || reviewIssue.title,
        message: result.message || reviewIssue.message,
        uploadLabel: result.uploadLabel || reviewIssue.uploadLabel,
      } : null);
      if (!result?.hasConflict) {
        setConflictRechecking(false);
        handleGenerate({ ...updatedConfig, conflictAcknowledged: true });
        return;
      }
    } catch (err) { console.warn('[AutoDeck] handleConflictReupload failed:', err); }
    setConflictRechecking(false);
  };

  // Conflict screen: user chose "Back to edit"
  const handleConflictBack = () => {
    setConflictData(null);
    // conflictConfig preserved so HomeScreenA can restore the input state
    setScreen('home');
  };

  const handleNavigate = (dest) => {
    setScreen(dest);
  };

  const handleOpenDeckFromHistory = async (deck) => {
    if (!window.firebaseDb || !currentUser || String(deck.id).startsWith('s')) return;
    try {
      const deckRef = window.firebaseDb.collection('decks').doc(deck.id);
      const slides = await readGeneratedSlides(deckRef, deck.template);
      if (!slides.length) return;
      setDeckConfig({ templateStyle: deck.template, inputText: deck.title });
      setSlideshowSlides(slides);
      activeDeckIdRef.current = deck.id;
      setActiveDeckId(deck.id);
      setScreen('slideshow');
    } catch (err) {
      console.error('[History] open deck failed:', err);
    }
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
      {screen !== 'login' && screen !== 'processing' && screen !== 'slideshow' && screen !== 'conflict' && (
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
        marginLeft: (screen !== 'processing' && screen !== 'slideshow' && screen !== 'conflict') ? '224px' : 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh'
      }}>
        {screen === 'home' && (
          <HomeScreenA onGenerate={handleGenerate} tweaks={tweaks} initialConfig={conflictConfig} />
        )}
        {screen === 'conflict' && (
          <SourceConflictScreen
            conflictData={conflictData}
            config={conflictConfig}
            tweaks={tweaks}
            isRechecking={conflictRechecking}
            onProceed={handleConflictProceed}
            onReupload={handleConflictReupload}
            onBack={handleConflictBack}
          />
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
              if (window.firebase?.app && currentUser && deckConfig) {
                try {
                  const result = await callFn('finalizeDeck', {
                    deckId: activeDeckId || null,
                    slides: finalSlides,
                    config: {
                      templateStyle: deckConfig.templateStyle,
                      inputText: deckConfig.inputText,
                      parsedFileText: deckConfig.parsedFileText,
                    },
                  });
                  const resolvedId = result.deckId || activeDeckId;
                  if (!activeDeckId && resolvedId) {
                    activeDeckIdRef.current = resolvedId;
                    setActiveDeckId(resolvedId);
                  }
                  if (resolvedId) uploadSourceFile(resolvedId, deckConfig).catch((srcErr) => { console.warn('[AutoDeck] onViewSlideshow uploadSourceFile failed:', srcErr); });
                } catch (viewErr) { console.warn('[AutoDeck] onViewSlideshow finalizeDeck failed:', viewErr); }
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
            activeDeckId={activeDeckId}
            onBack={() => setScreen('preview')}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen tweaks={tweaks} currentUser={currentUser} onOpenDeck={handleOpenDeckFromHistory} />
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
