// ============================================================
// ProcessingScreen — make it feel earned. Live wire-up: the deck
// builds itself. Slide-thumb skeletons stream in one by one.
// ============================================================
const ProcessingScreen = ({ config, generationStatus = 'ready', generationError, onComplete, tweaks }) => {
  const T = qxTheme(tweaks?.darkMode);
  const dark = tweaks?.darkMode;
  const [phase, setPhase] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [streamedSlides, setStreamedSlides] = React.useState(0);
  const [logLines, setLogLines] = React.useState([]);
  const [animationDone, setAnimationDone] = React.useState(false);
  const statusRef = React.useRef(generationStatus);
  const completedRef = React.useRef(false);

  const targetSlides = config?.slideCount === 'Auto' || !config?.slideCount ? 10 : (parseInt(config.slideCount) || 10);

  const phases = [
    { label: 'Parsing your content',      verb: 'Reading',     duration: 2400 },
    { label: 'Structuring slides',        verb: 'Outlining',   duration: 3600 },
    { label: 'Applying brand formatting', verb: 'Painting',    duration: 4200 },
    { label: 'Finalising your deck',      verb: 'Polishing',   duration: 2400 },
  ];

  const logSeed = [
    'Detected document type: meeting notes',
    'Identifying key sections and themes',
    'Found 7 candidate sections',
    'Building narrative arc',
    'Generating slide titles',
    'Drafting bullet points',
    'Applying Quidax brand tokens',
    'Layout pass: title, body, accent',
    'Optimising whitespace and rhythm',
    'Cross-checking compliance phrases',
    'Final QA pass — almost done',
  ];

  const safePhase = Math.min(phase, phases.length - 1);
  const currentPhase = phases[safePhase];
  const waitingForGeneration = generationStatus === 'loading';

  const finishProcessing = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setProgress(100);
    setStreamedSlides(targetSlides);
    setTimeout(() => onComplete && onComplete(), 600);
  }, [onComplete, targetSlides]);

  React.useEffect(() => {
    statusRef.current = generationStatus;
    if (animationDone && generationStatus !== 'loading') {
      finishProcessing();
    }
  }, [animationDone, finishProcessing, generationStatus]);

  React.useEffect(() => {
    let elapsed = 0;
    const total = phases.reduce((s, p) => s + p.duration, 0);
    const id = setInterval(() => {
      elapsed += 80;
      const pct = Math.min((elapsed / total) * 100, statusRef.current === 'loading' ? 97 : 99);
      setProgress(pct);

      // stream slide thumbs as deck builds
      const targetStreamed = Math.floor((pct / 99) * targetSlides);
      setStreamedSlides(targetStreamed);

      // bump phase based on cumulative duration; never exceed last index
      let cum = 0;
      let nextPhase = phases.length - 1;
      for (let i = 0; i < phases.length; i++) {
        cum += phases[i].duration;
        if (elapsed < cum) { nextPhase = i; break; }
      }
      setPhase(nextPhase);

      if (elapsed >= total) {
        clearInterval(id);
        setAnimationDone(true);
        if (statusRef.current !== 'loading') {
          finishProcessing();
        }
      }
    }, 80);
    return () => clearInterval(id);
  }, [finishProcessing, targetSlides]);

  // Stream log lines
  React.useEffect(() => {
    if (logLines.length >= logSeed.length) return;
    const t = setTimeout(() => {
      setLogLines(prev => [...prev, logSeed[prev.length]]);
    }, 1100 + Math.random() * 400);
    return () => clearTimeout(t);
  }, [logLines]);

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: qxType.body, color: T.ink,
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob1} 0%, transparent 60%)`, filter: 'blur(40px)' }} />

      <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto', padding: '64px 40px 80px' }}>
        {/* Top eyebrow */}
        <div style={{ ...qxMotion.fadeUp(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.30em', textTransform: 'uppercase', color: T.inkMute, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, boxShadow: `0 0 12px ${QX.lime}`, animation: 'qxBreathe 1.6s ease-in-out infinite' }} />
            Live · {currentPhase.verb}
          </div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.18em', color: T.inkMute, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(progress).toString().padStart(2, '0')}%
          </div>
        </div>

        {/* Big headline that morphs */}
        <h1 style={{
          ...qxMotion.fadeUp(80),
          fontFamily: qxType.display,
          fontSize: 'clamp(48px, 6.5vw, 84px)',
          fontWeight: 500, lineHeight: 0.96,
          letterSpacing: '-0.035em',
          margin: '0 0 16px', color: T.ink,
        }}>
          {currentPhase.verb}<br/>
          <span style={{ color: T.primary, fontStyle: 'italic', fontWeight: 400 }}>your deck</span>
          <span style={{ color: QX.lime, textShadow: `0 0 24px ${QX.lime}` }}>…</span>
        </h1>
        <p style={{ ...qxMotion.fadeUp(140), fontSize: 17, color: T.inkDim, margin: '0 0 48px', maxWidth: 540 }}>
          {waitingForGeneration ? `${currentPhase.label}. Waiting for AI output.` : generationStatus === 'error' ? (generationError || 'Using a draft from your content.') : `${currentPhase.label}.`}
        </p>

        {/* Slide thumbs streaming in */}
        <div style={{ ...qxMotion.fadeUp(200), marginBottom: 40 }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 14 }}>
            Building {streamedSlides} of {targetSlides} slides
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {Array.from({ length: targetSlides }).map((_, i) => {
              const built = i < streamedSlides;
              return (
                <div key={i} style={{
                  aspectRatio: '16 / 9',
                  borderRadius: qxRadius.sm,
                  border: `1px solid ${T.border}`,
                  background: built
                    ? `linear-gradient(135deg, ${dark ? '#2D0F4E' : '#5F2A91'} 0%, ${dark ? '#5F2A91' : '#B891DC'} 60%, ${dark ? '#B891DC' : '#D9C2EE'} 140%)`
                    : T.surface,
                  position: 'relative', overflow: 'hidden',
                  transition: `all 480ms ${qxEase}`,
                  transform: built ? 'translateY(0)' : 'translateY(4px)',
                  opacity: built ? 1 : 0.6,
                }}>
                  {!built && i === streamedSlides && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(90deg, transparent, ${T.ghostHi}, transparent)`,
                      backgroundSize: '200% 100%',
                      animation: 'qxShimmer 1.6s ease-in-out infinite',
                    }} />
                  )}
                  {built && (
                    <>
                      {/* Mock slide content */}
                      <div style={{ position: 'absolute', top: 8, left: 8, fontFamily: qxType.mono, fontSize: 7, color: 'rgba(246,241,251,0.55)', letterSpacing: '0.18em' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ position: 'absolute', bottom: 12, left: 10, right: 10 }}>
                        <div style={{ width: '80%', height: 4, borderRadius: 2, background: 'rgba(246,241,251,0.78)', marginBottom: 4 }} />
                        <div style={{ width: '50%', height: 3, borderRadius: 2, background: 'rgba(246,241,251,0.4)' }} />
                      </div>
                      <div style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(246,241,251,0.18)' }} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phases + progress + log — three columns */}
        <div style={{ ...qxMotion.fadeUp(260), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Phases */}
          <div style={{
            background: T.surface, borderRadius: qxRadius.lg,
            border: `1px solid ${T.border}`, padding: 24,
            boxShadow: qxShadow(dark).md,
          }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>
              Steps
            </div>
            {phases.map((p, i) => {
              const done = i < phase, active = i === phase;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '11px 0',
                  borderBottom: i < phases.length - 1 ? `1px solid ${T.border}` : 'none',
                  opacity: done ? 0.5 : (active ? 1 : 0.30),
                  transition: `opacity 280ms ${qxEase}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? QX.lime : T.ghostBg,
                    border: done ? `1px solid ${T.borderHi}` : 'none',
                  }}>
                    {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke={T.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A0530', animation: 'qxBreathe 1.1s ease-in-out infinite' }} />}
                  </div>
                  <span style={{ fontSize: 13.5, color: active ? T.ink : T.inkDim, fontWeight: active ? 500 : 400, flex: 1 }}>{p.label}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 18 }}>
              <div style={{ height: 4, borderRadius: 2, background: T.ghostBg, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: T.primary, transition: `width 280ms ${qxEase}` }} />
              </div>
            </div>
          </div>

          {/* Live log — terminal feel */}
          <div style={{
            background: dark ? '#0A0114' : '#1A0530', borderRadius: qxRadius.lg,
            border: `1px solid ${dark ? T.border : 'transparent'}`,
            padding: 24, color: '#F6F1FB',
            boxShadow: qxShadow(dark).md,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', gap: 6 }}>
              {['#E03E6B', '#F5A623', '#34C77B'].map(c => <span key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.55 }} />)}
            </div>
            <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.4)', marginBottom: 16 }}>
              Live trace
            </div>
            <div style={{ fontFamily: qxType.mono, fontSize: 12, lineHeight: 1.7, height: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
              <div>
                {logLines.map((l, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12,
                    color: i === logLines.length - 1 ? '#F6F1FB' : 'rgba(246,241,251,0.5)',
                    ...qxMotion.slideRight(0),
                  }}>
                    <span style={{ color: i === logLines.length - 1 ? QX.lime : 'rgba(246,241,251,0.3)' }}>›</span>
                    <span>{l}</span>
                  </div>
                ))}
                {progress < 99 && (
                  <div style={{ display: 'flex', gap: 12, color: '#F6F1FB' }}>
                    <span style={{ color: QX.lime }}>›</span>
                    <span style={{ animation: 'qxBreathe 1.1s ease-in-out infinite' }}>_</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer config strip */}
        <div style={{ ...qxMotion.fadeUp(320), marginTop: 32, fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.inkMute, display: 'flex', justifyContent: 'space-between' }}>
          <span>{config?.templateStyle || 'Professional'} · {targetSlides} slides</span>
          <span>{waitingForGeneration ? "Waiting for generated slides" : generationStatus === 'error' ? 'Context draft ready' : 'Generated slides ready'}</span>
        </div>
      </div>
    </div>
  );
};
Object.assign(window, { ProcessingScreen });
