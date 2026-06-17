// ============================================================
// HomeScreenA — Editorial canvas with personality.
// Big serif-italic accent, animated marquee strip, smart prompts.
// ============================================================
const HomeScreenA = ({ onGenerate, tweaks, initialConfig }) => {
  const T = qxTheme(tweaks?.darkMode);
  const restoredInputMode = ['brief', 'content'].includes(initialConfig?.inputMode) ? initialConfig.inputMode : null;
  const [inputText, setInputText] = React.useState(() => initialConfig?.inputText || '');
  const [slideCount, setSlideCount] = React.useState(() => initialConfig?.slideCount || 'Auto');
  const [templateStyle, setTemplateStyle] = React.useState(() => initialConfig?.templateStyle || 'Professional');
  const [uploadedFile, setUploadedFile] = React.useState(() => initialConfig?.uploadedFile || null);
  const [parsedFileText, setParsedFileText] = React.useState(() => initialConfig?.parsedFileText || '');
  const [parsing, setParsing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [activePrompt, setActivePrompt] = React.useState(0);
  const [userModeOverride, setUserModeOverride] = React.useState(() => restoredInputMode); // null | 'brief' | 'content'
  const [templateMode, setTemplateMode] = React.useState('Prompt'); // 'Prompt' | 'Layout'
  const [layoutTemplateId, setLayoutTemplateId] = React.useState(null);

  const SLIDE_TEMPLATES = [
    { id: 'product-launch', kicker: 'Launch',    name: 'Product launch announcement', slides: ['Cover', 'The Problem', 'Our Solution', 'Key Features', 'Pricing & Timeline', 'Next Steps'] },
    { id: 'all-hands',      kicker: 'All-Hands', name: 'Team all-hands recap',         slides: ['Cover', 'Company Highlights', 'Team Updates', 'Customer Wins', 'OKR Progress', "What's Next"] },
    { id: 'investor',       kicker: 'Investor',  name: 'Series update for investors',  slides: ['Cover', 'Key Metrics', 'Milestones Hit', 'Financials & Runway', 'Roadmap', 'The Ask'] },
    { id: 'training',       kicker: 'Training',  name: 'Compliance training deck',     slides: ['Cover', 'Learning Objectives', 'Key Concepts', 'Practical Examples', 'Common Mistakes', 'Summary & Quiz'] },
    { id: 'sales',          kicker: 'Sales',     name: 'Sales pitch deck',             slides: ['Cover', 'Your Challenge', 'Our Solution', 'Why Quidax', 'Pricing', 'Getting Started'] },
    { id: 'retro',          kicker: 'Retro',     name: 'Sprint retrospective',         slides: ['Cover', "What Went Well", "What Didn't", 'Root Causes', 'Action Items', 'Commitments'] },
  ];

  const safeStorageFileName = (value) => String(value || 'source-file')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'source-file';

  const parseFile = async (file) => {
    if (!file) { setParsedFileText(''); return ''; }
    const uid = window.firebaseAuth?.currentUser?.uid;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!uid || !window.firebaseStorage || !window.firebase?.app || !['pdf', 'docx', 'pptx', 'txt'].includes(ext)) {
      setParsedFileText('');
      return '';
    }

    const storagePath = `uploads/temp/${uid}/${Date.now()}_${safeStorageFileName(file.name)}`;
    const storageRef = window.firebaseStorage.ref(storagePath);
    setParsing(true);
    setParsedFileText('');
    try {
      await storageRef.put(file);
      const parseFileFn = window.firebase.app().functions('us-central1').httpsCallable('parseFile', { timeout: 120000 });
      const { data } = await parseFileFn({ storagePath, fileName: file.name });
      const text = data?.text || '';
      setParsedFileText(text);
      return text;
    } catch (_) {
      setParsedFileText('');
      return '';
    } finally {
      setParsing(false);
      storageRef.delete().catch(() => {});
    }
  };

  const promptIdeas = [
    { kicker: 'Quarterly', label: 'Q3 business review', seed: 'Quarterly business review for Q3 2026 covering revenue, retention, product wins, and outlook for Q4. Audience: leadership team.' },
    { kicker: 'Launch',    label: 'Product launch announcement', seed: 'Product launch announcement for a new merchant payment feature. Cover the problem, our solution, target customers, pricing, and rollout plan.' },
    { kicker: 'Training',  label: 'Compliance training deck', seed: 'Compliance training deck on AML and KYC procedures for new hires. Include policy basics, red flags, escalation, and a short quiz.' },
    { kicker: 'Investor',  label: 'Series B update', seed: 'Investor update for our Series B partners. Cover Q3 metrics, key milestones hit, runway, and what we need from the round.' },
    { kicker: 'All-hands', label: 'Team all-hands recap', seed: 'All-hands recap covering company highlights, team news, customer wins, and OKR progress for the quarter.' },
  ];

  // Mode inference: 'brief' = direction/prompt, 'content' = full pasted content
  const detectMode = (text, hasFile) => {
    if (!text.trim()) return hasFile ? 'brief' : null;
    const words = text.trim().split(/\s+/).length;
    const lines = text.split('\n').filter(l => l.trim());
    const hasStructure = /slide\s*\d+|^#{1,3}\s|^---+$/im.test(text) ||
      (lines.length > 6 && words > 80);
    return (words > 120 || hasStructure) ? 'content' : 'brief';
  };
  // When file is attached, text always acts as a brief regardless of override
  const inferredMode = detectMode(inputText, !!uploadedFile);
  const activeMode = uploadedFile ? 'brief' : (userModeOverride || inferredMode);

  // Reset user override when a file is attached
  React.useEffect(() => { if (uploadedFile) setUserModeOverride(null); }, [!!uploadedFile]);

  const modeConfig = {
    brief:   { label: 'Direction', hint: 'AI generates content from your brief', dot: T.primary },
    content: { label: 'Content',   hint: 'AI structures and styles your pasted text', dot: QX.lime },
  };

  const effectivePlaceholder = (activeMode === 'content' && !uploadedFile)
    ? 'Paste your slide content here — titles, sections, bullet points…'
    : promptIdeas[activePrompt].seed;

  const slideOptions = ['5', '8', '10', '15', 'Auto'];
  const templates = window.AutoDeckTemplatePresets?.getTemplateOptions?.() || ['Professional', 'Minimal', 'Bold', 'Fun'];

  const canGenerate = !parsing && (inputText.trim().length > 10 || uploadedFile) && (templateMode === 'Prompt' || layoutTemplateId !== null);
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const parsedWordCount = parsedFileText.trim() ? parsedFileText.trim().split(/\s+/).length : 0;
  const estSlides = wordCount > 0 ? Math.max(3, Math.min(20, Math.round(wordCount / 60))) : 0;

  // Cycle the active prompt
  React.useEffect(() => {
    const id = setInterval(() => setActivePrompt(p => (p + 1) % promptIdeas.length), 3200);
    return () => clearInterval(id);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setUploadedFile(file); parseFile(file); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: qxType.body, color: T.ink,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div aria-hidden style={{
        position: 'absolute', top: '-15%', right: '-8%',
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob1} 0%, transparent 60%)`,
        filter: 'blur(40px)', animation: 'qxFloat 8s ease-in-out infinite',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-30%', left: '-15%',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob2} 0%, transparent 60%)`,
        filter: 'blur(40px)',
      }} />

      {/* Marquee strip — top */}
      <div style={{
        position: 'relative', zIndex: 2,
        borderBottom: `1px solid ${T.border}`,
        padding: '14px 0', overflow: 'hidden',
        background: tweaks?.darkMode ? 'rgba(15,3,31,0.6)' : 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          display: 'flex', gap: 48, whiteSpace: 'nowrap',
          animation: 'qxMarquee 40s linear infinite',
          fontFamily: qxType.mono, fontSize: 11,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: T.inkMute,
        }}>
          {Array(2).fill(['Quidax · Internal', '2,847 decks generated', 'Brand-perfect by default', 'Compliance approved', 'Used by 14 teams', 'Average 14 seconds', 'Quidax · Internal', '2,847 decks generated', 'Brand-perfect by default', 'Compliance approved']).flat().map((t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {t}
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: i % 5 === 0 ? QX.lime : T.inkFaint }} />
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '56px 40px 96px' }}>
        {/* Eyebrow */}
        <div style={{ ...qxMotion.fadeUp(0), fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.30em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, boxShadow: `0 0 12px ${QX.lime}`, animation: 'qxBreathe 2.4s ease-in-out infinite' }} />
          New deck · Vol. 26
        </div>

        {/* Big editorial headline */}
        <h1 style={{
          ...qxMotion.fadeUp(80),
          fontFamily: qxType.display,
          fontSize: 'clamp(48px, 7vw, 88px)',
          fontWeight: 500, lineHeight: 0.96,
          letterSpacing: '-0.035em',
          margin: '0 0 20px',
          color: T.ink,
        }}>
          What are<br/>
          <span style={{ color: T.primary, fontStyle: 'italic', fontWeight: 400 }}>we presenting</span><br/>
          today<span style={{ color: QX.lime, textShadow: `0 0 24px ${QX.lime}` }}>.</span>
        </h1>
        <p style={{
          ...qxMotion.fadeUp(160),
          fontSize: 18, lineHeight: 1.55, color: T.inkDim,
          margin: '0 0 28px', maxWidth: 540,
        }}>
          {templateMode === 'Layout'
            ? 'Pick a pre-built slide structure below, then add your content.'
            : 'Paste notes, drop a doc, or describe it. AutoDeck structures a brand-perfect Quidax deck in seconds.'}
        </p>

        {/* Mode selector */}
        <div style={{ ...qxMotion.fadeUp(200), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 36 }}>
          {[
            {
              mode: 'Prompt',
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 13l1.5-4.5L11 1l3 3-7.5 7.5L2 13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M10 2.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ),
              title: 'From a brief',
              desc: 'Describe what you need — AI generates the structure and content for you.',
            },
            {
              mode: 'Layout',
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
              ),
              title: 'From a template',
              desc: 'Pick a pre-built slide structure — just add your content to fill each slide.',
            },
          ].map(({ mode, icon, title, desc }) => {
            const active = templateMode === mode;
            return (
              <button key={mode}
                onClick={() => { setTemplateMode(mode); setLayoutTemplateId(null); }}
                style={{
                  padding: '20px 24px', textAlign: 'left', cursor: 'pointer',
                  borderRadius: qxRadius.md,
                  border: `1.5px solid ${active ? T.primary : T.border}`,
                  background: active ? T.surface : 'transparent',
                  transition: `all 200ms ${qxEase}`,
                  boxShadow: active ? qxShadow(tweaks?.darkMode).md : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: qxRadius.sm, flexShrink: 0,
                    background: active ? `${T.primary}18` : T.ghostBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: active ? T.primary : T.inkMute,
                    transition: `all 200ms ${qxEase}`,
                  }}>{icon}</div>
                  <div style={{ fontFamily: qxType.display, fontSize: 16, fontWeight: 500, letterSpacing: '-0.015em', color: active ? T.primary : T.ink }}>
                    {title}
                  </div>
                </div>
                <div style={{ fontFamily: qxType.body, fontSize: 13, color: T.inkDim, lineHeight: 1.5, paddingLeft: 40 }}>
                  {desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Brief mode: textarea + config + CTA (left) · seeds (right) */}
        {templateMode === 'Prompt' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 20, alignItems: 'start' }}>
        <div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            ...qxMotion.fadeUp(240),
            background: T.surface,
            borderRadius: qxRadius.lg,
            border: `1px solid ${dragOver ? T.primary : activeMode === 'content' ? T.borderHi : T.border}`,
            boxShadow: dragOver ? `0 0 0 4px ${T.ghostBg}, ${qxShadow(tweaks?.darkMode).lg}` : qxShadow(tweaks?.darkMode).md,
            transition: `all 240ms ${qxEase}`,
            overflow: 'hidden', position: 'relative',
          }}
        >
          {/* Quote mark accent */}
          <div aria-hidden style={{
            position: 'absolute', top: 14, left: 18,
            fontFamily: 'Georgia, serif', fontSize: 64, lineHeight: 0.6,
            color: T.inkFaint, opacity: 0.4, pointerEvents: 'none',
          }}>“</div>

          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={inputText ? '' : effectivePlaceholder}
            autoFocus
            style={{
              width: '100%', minHeight: 200,
              padding: '32px 28px 18px 52px',
              border: 'none', outline: 'none', resize: 'vertical',
              background: 'transparent',
              fontFamily: qxType.body, fontSize: 16.5, lineHeight: 1.65,
              color: T.ink, boxSizing: 'border-box',
            }}
          />

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            borderTop: `1px solid ${T.border}`,
            background: tweaks?.darkMode ? 'rgba(0,0,0,0.18)' : T.surfaceHi,
          }}>
            <button onClick={() => document.getElementById('hsAFile').click()} style={ghostBtn(T)}
              onMouseEnter={e => e.currentTarget.style.background = T.ghostHi}
              onMouseLeave={e => e.currentTarget.style.background = T.ghostBg}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 1H3v12h8V3L9 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 1v2h2" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              {uploadedFile ? truncate(uploadedFile.name, 22) : 'Attach file'}
            </button>
            <input id="hsAFile" type="file" accept=".pdf,.docx,.txt,.pptx" style={{ display: 'none' }}
                   onChange={e => { const f = e.target.files[0]; if (f) { setUploadedFile(f); parseFile(f); } }} />

            {/* Mode toggle — hidden when file drives the mode */}
            {!uploadedFile && inferredMode && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: T.ghostBg, borderRadius: qxRadius.sm,
                border: `1px solid ${T.border}`, padding: 2, gap: 1,
              }}>
                {['brief', 'content'].map(m => {
                  const active = activeMode === m;
                  const cfg = modeConfig[m];
                  return (
                    <button key={m}
                      title={cfg.hint}
                      onClick={() => setUserModeOverride(userModeOverride === m ? null : m)}
                      style={{
                        padding: '4px 10px', border: 'none', borderRadius: qxRadius.xs,
                        background: active ? T.bgElev : 'transparent',
                        color: active ? (m === 'brief' ? T.primary : tweaks?.darkMode ? '#a8d400' : '#4a6800') : T.inkMute,
                        fontFamily: qxType.mono, fontSize: 10,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        fontWeight: active ? 600 : 400, cursor: 'pointer',
                        transition: `all 140ms ${qxEase}`,
                        display: 'flex', alignItems: 'center', gap: 5,
                        boxShadow: active ? qxShadow(tweaks?.darkMode).sm : 'none',
                      }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: active ? cfg.dot : T.inkFaint,
                        flexShrink: 0,
                      }} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
            {uploadedFile && activeMode && (
              <span style={{
                fontFamily: qxType.mono, fontSize: 10,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: T.primary, opacity: 0.75,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.primary }} />
                File → source · Text → direction
              </span>
            )}

            <div style={{ flex: 1 }} />

            <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>
              {parsing ? 'parsing file...' : parsedWordCount > 0 ? `${parsedWordCount.toLocaleString()} file words parsed` : wordCount > 0 ? `${wordCount.toLocaleString()} words · ~${estSlides} slides` : 'or drag a file'}
            </span>
          </div>
        </div>

        {/* Config + CTA inside left column */}
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
          <ConfigGroup label="Slides" T={T}>
            <Pills value={slideCount} onChange={setSlideCount} options={slideOptions} T={T} />
          </ConfigGroup>
          <ConfigGroup label="Style" T={T}>
            <Pills value={templateStyle} onChange={setTemplateStyle} options={templates} T={T} />
          </ConfigGroup>
        </div>
        <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => canGenerate && onGenerate({
              inputText, slideCount, templateStyle,
              templatePreset: window.AutoDeckTemplatePresets?.summarizeForPrompt?.(templateStyle),
              uploadedFile, parsedFileText, inputMode: activeMode, layoutTemplate: null,
            })}
            disabled={!canGenerate}
            style={{
              padding: '17px 32px', borderRadius: qxRadius.full, border: 'none',
              background: canGenerate ? QX.lime : T.ghostBg,
              color: canGenerate ? QX.limeInk : T.inkFaint,
              fontFamily: qxType.body, fontSize: 15.5, fontWeight: 600,
              letterSpacing: '-0.005em',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 12,
              transition: `all 180ms ${qxEase}`,
              boxShadow: canGenerate ? '0 8px 30px rgba(212,255,63,0.42)' : 'none',
            }}
            onMouseEnter={e => { if (canGenerate) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(212,255,63,0.55)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (canGenerate) e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,255,63,0.42)'; }}>
            {parsing ? 'Parsing file...' : 'Generate deck'}
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>⌘ ↵</span>
        </div>
        </div>

        {/* Seeds sidebar — right column */}
        <div>
          <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 14 }}>
            Or start from
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {promptIdeas.map((p, i) => (
              <button key={p.label}
                onClick={() => { setInputText(p.seed); setUserModeOverride('brief'); }}
                onMouseEnter={() => setActivePrompt(i)}
                style={{
                  padding: '14px 16px', borderRadius: qxRadius.md,
                  border: `1px solid ${activePrompt === i ? T.primary : T.border}`,
                  background: activePrompt === i ? T.surface : 'transparent',
                  color: T.ink, fontFamily: qxType.body,
                  cursor: 'pointer', transition: `all 240ms ${qxEase}`, textAlign: 'left',
                  boxShadow: activePrompt === i ? qxShadow(tweaks?.darkMode).sm : 'none',
                  transform: activePrompt === i ? 'translateY(-1px)' : 'translateY(0)',
                }}>
                <div style={{ fontFamily: qxType.mono, fontSize: 9.5, letterSpacing: '0.20em', textTransform: 'uppercase', color: activePrompt === i ? T.primary : T.inkMute, marginBottom: 5 }}>
                  {p.kicker}
                </div>
                <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25, color: T.ink }}>
                  {p.label}
                </div>
              </button>
            ))}
          </div>
        </div>
        </div>)}

        {/* Template picker + content textarea — Layout mode */}
        {templateMode === 'Layout' && (
          <div style={{ ...qxMotion.fadeUp(240) }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {SLIDE_TEMPLATES.map(t => {
                const active = layoutTemplateId === t.id;
                return (
                  <button key={t.id} onClick={() => setLayoutTemplateId(active ? null : t.id)}
                    style={{
                      padding: '18px 18px 16px', borderRadius: qxRadius.md,
                      border: `1px solid ${active ? T.primary : T.border}`,
                      background: active ? T.surface : 'transparent',
                      color: T.ink, fontFamily: qxType.body,
                      cursor: 'pointer', transition: `all 240ms ${qxEase}`, textAlign: 'left',
                      boxShadow: active ? qxShadow(tweaks?.darkMode).md : 'none',
                      transform: active ? 'translateY(-2px)' : 'translateY(0)',
                    }}>
                    <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.20em', textTransform: 'uppercase', color: active ? T.primary : T.inkMute, marginBottom: 8 }}>
                      {t.kicker}
                    </div>
                    <div style={{ fontFamily: qxType.display, fontSize: 17, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.25, color: T.ink }}>
                      {t.name}
                    </div>
                    <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: active ? T.primary : T.inkFaint, marginTop: 10, opacity: 0.7 }}>
                      {t.slides.length} slides
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Content textarea — appears once a template is chosen */}
            {layoutTemplateId && (
              <div style={{ marginTop: 16, background: T.surface, borderRadius: qxRadius.lg, border: `1px solid ${T.borderHi}`, boxShadow: qxShadow(tweaks?.darkMode).md, overflow: 'hidden' }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  autoFocus
                  placeholder={`Add your content for "${SLIDE_TEMPLATES.find(t => t.id === layoutTemplateId)?.name}" — notes, facts, key points, data…`}
                  style={{
                    width: '100%', minHeight: 160, padding: '20px 24px 16px',
                    border: 'none', outline: 'none', resize: 'vertical', background: 'transparent',
                    fontFamily: qxType.body, fontSize: 16, lineHeight: 1.65,
                    color: T.ink, boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.border}`, background: tweaks?.darkMode ? 'rgba(0,0,0,0.18)' : T.surfaceHi }}>
                  <button onClick={() => document.getElementById('hsAFileLayout').click()} style={ghostBtn(T)}
                    onMouseEnter={e => e.currentTarget.style.background = T.ghostHi}
                    onMouseLeave={e => e.currentTarget.style.background = T.ghostBg}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M9 1H3v12h8V3L9 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M9 1v2h2" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                    {uploadedFile ? truncate(uploadedFile.name, 22) : 'Attach file'}
                  </button>
                  <input id="hsAFileLayout" type="file" accept=".pdf,.docx,.txt,.pptx" style={{ display: 'none' }}
                         onChange={e => { const f = e.target.files[0]; if (f) { setUploadedFile(f); parseFile(f); } }} />
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>
                    {parsing ? 'parsing file...' : wordCount > 0 ? `${wordCount.toLocaleString()} words` : 'or drag a file'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config row — Layout mode only */}
        {templateMode === 'Layout' && (
        <div style={{ ...qxMotion.fadeUp(300), marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
          <ConfigGroup label="Slides" T={T}>
            <Pills value={slideCount} onChange={setSlideCount} options={slideOptions} T={T} />
          </ConfigGroup>
          <ConfigGroup label="Style" T={T}>
            <Pills value={templateStyle} onChange={setTemplateStyle} options={templates} T={T} />
          </ConfigGroup>
        </div>
        )}

        {/* CTA — Layout mode only */}
        {templateMode === 'Layout' && (
        <div style={{ ...qxMotion.fadeUp(360), marginTop: 36, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => canGenerate && onGenerate({
              inputText,
              slideCount,
              templateStyle,
              templatePreset: window.AutoDeckTemplatePresets?.summarizeForPrompt?.(templateStyle),
              uploadedFile,
              parsedFileText,
              inputMode: 'content',
              layoutTemplate: SLIDE_TEMPLATES.find(t => t.id === layoutTemplateId) || null,
            })}
            disabled={!canGenerate}
            style={{
              padding: '17px 32px', borderRadius: qxRadius.full,
              border: 'none',
              background: canGenerate ? QX.lime : T.ghostBg,
              color: canGenerate ? QX.limeInk : T.inkFaint,
              fontFamily: qxType.body, fontSize: 15.5, fontWeight: 600,
              letterSpacing: '-0.005em',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 12,
              transition: `all 180ms ${qxEase}`,
              boxShadow: canGenerate ? '0 8px 30px rgba(212,255,63,0.42)' : 'none',
            }}
            onMouseEnter={e => { if (canGenerate) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(212,255,63,0.55)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (canGenerate) e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,255,63,0.42)'; }}>
            {parsing ? 'Parsing file...' : 'Fill template'}
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>⌘ ↵</span>
        </div>
        )}

      </div>
    </div>
  );
};

// ── helpers ────────────────────────────────────────────────
const ghostBtn = (T) => ({
  padding: '8px 13px', borderRadius: qxRadius.sm, border: 'none',
  background: T.ghostBg, color: T.ink,
  fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
  transition: 'background 140ms ease',
});

const truncate = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

const ConfigGroup = ({ label, T, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute }}>{label}</div>
    {children}
  </div>
);

const Pills = ({ value, onChange, options, T }) => (
  <div style={{ display: 'inline-flex', background: T.ghostBg, borderRadius: qxRadius.full, padding: 3, border: `1px solid ${T.border}` }}>
    {options.map(o => (
      <button key={o} onClick={() => onChange(o)} style={{
        padding: '7px 14px', borderRadius: qxRadius.full, border: 'none',
        background: value === o ? T.bgElev : 'transparent',
        color: value === o ? T.ink : T.inkDim,
        fontFamily: qxType.body, fontSize: 13,
        fontWeight: value === o ? 600 : 500, cursor: 'pointer',
        transition: `all 140ms ${qxEase}`,
        boxShadow: value === o ? qxShadow(false).sm : 'none',
      }}>{o}</button>
    ))}
  </div>
);

Object.assign(window, { HomeScreenA, qxGhostBtn: ghostBtn, qxConfigGroup: ConfigGroup, qxPills: Pills });
