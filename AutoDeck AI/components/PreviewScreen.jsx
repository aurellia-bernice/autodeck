// ============================================================
// PreviewScreen — editorial cover + collapsible outline.
// The deck announces itself like a magazine. The outline below
// is dense, ranked, and inline-editable. One lime moment: Open.
// ============================================================
const normalizePreviewSlides = (slides, templateStyle = 'Professional') => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide, index) => {
      const title = String(slide?.title || '').trim();
      const bullets = Array.isArray(slide?.bullets)
        ? slide.bullets.map((b) => String(b || '').trim()).filter(Boolean)
        : [];
      const normalized = { ...slide, title, bullets: bullets.slice(0, 4) };
      return window.AutoDeckTemplatePresets?.enhanceSlide
        ? window.AutoDeckTemplatePresets.enhanceSlide(normalized, index, slide?.templateStyle || templateStyle)
        : normalized;
    })
    .filter((slide) => slide.title || slide.bullets.length);
};

const makePreviewDraftSlides = (config, count) => {
  if (window.AutoDeckStoryDraft?.buildSlides) {
    return window.AutoDeckStoryDraft.buildSlides({ ...config, slideCount: config?.slideCount || count });
  }
  const source = [
    config?.inputText,
    config?.parsedFileText,
    config?.uploadedFile?.name ? `Source document: ${config.uploadedFile.name}` : '',
  ].filter(Boolean).join('\n\n').trim();
  if (!source) return [];

  const clean = (value, maxWords = 18) => String(value || '')
    .replace(/^[\s\-*0-9.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
    .replace(/[.,;:!]+$/, '');
  const title = (value, fallback) => {
    const t = clean(value, 8);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : fallback;
  };
  const compact = source.replace(/\s+/g, ' ').trim();
  const sentences = (compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact])
    .map((s) => clean(s, 22))
    .filter(Boolean);

  const draftSlides = Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * sentences.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sentences.length) / count));
    const chunk = sentences.slice(start, end);
    const bullets = chunk.slice(0, 4);
    while (bullets.length < 2) bullets.push('Clarify the main takeaway for this section');
    return {
      title: i === 0 ? title(compact, 'Presentation Overview') : title(chunk[0], `Section ${i + 1}`),
      contentType: i === 0 ? 'opening' : i === count - 1 ? 'next steps' : 'section',
      kicker: i === 0 ? 'Opening' : i === count - 1 ? 'Next steps' : 'From your context',
      bullets,
    };
  });
  return window.AutoDeckTemplatePresets?.enhanceSlides
    ? window.AutoDeckTemplatePresets.enhanceSlides(draftSlides, config?.templateStyle)
    : draftSlides;
};

const PreviewScreen = ({
  config,
  slides: generatedSlides = [],
  generationStatus = 'idle',
  generationError,
  activeDeckId,
  generationTrace,
  onGenerateAgain,
  onViewSlideshow,
  tweaks,
}) => {
  const T = qxTheme(tweaks?.darkMode);
  const dark = tweaks?.darkMode;
  const [editingIndex, setEditingIndex] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState({ title: '', bullets: [] });
  const [expanded, setExpanded] = React.useState(new Set([0]));
  const [theme, setTheme] = React.useState(() => window.AutoDeckTemplatePresets?.getTemplatePreset?.(config?.templateStyle)?.theme || 'purple');

  const inputText = config?.inputText || config?.parsedFileText || config?.uploadedFile?.name || 'Q2 Sales Strategy and market expansion plan for Quidax';
  const deckTitle = inputText.trim().split(/\s+/).slice(0, 8).join(' ').replace(/[.,;:!]+$/, '');
  const slideCount = config?.slideCount === 'Auto' || !config?.slideCount ? 10 : (parseInt(config.slideCount) || 10);
  const incomingSlides = normalizePreviewSlides(generatedSlides, config?.templateStyle);

  const seed = [
    { title: 'Executive Summary',     contentType: 'opening', kicker: 'Where we stand',      bullets: ['Strong Q2 performance across all verticals', 'New markets entered: Ghana, Senegal', 'Revenue up 34% YoY'] },
    { title: 'Market Overview',       kicker: 'The landscape',       bullets: ['Africa crypto market growing at 18% CAGR', 'Quidax positioned in top 3 exchanges', 'User base crossed 2M milestone'] },
    { title: 'Key Metrics',           kicker: 'By the numbers',      bullets: ['Monthly active users: 1.2M', 'Transaction volume: $280M', 'NPS score: 72'] },
    { title: 'Growth Initiatives',    kicker: 'What we shipped',     bullets: ['B2B partnerships with 12 new fintechs', 'Mobile app v4.0 launch', 'Merchant payment integration'] },
    { title: 'Challenges & Mitigations', kicker: 'What we navigated', bullets: ['Regulatory complexity in new markets', 'Liquidity management during volatility', 'Talent acquisition in competitive markets'] },
    { title: 'Product Roadmap',       kicker: 'What\u2019s next',     bullets: ['Q3: Stablecoin savings product', 'Q4: Cross-border remittance beta', 'H1 2027: DeFi gateway'] },
    { title: 'Team & Resources',      kicker: 'The people side',     bullets: ['Headcount grew from 120 to 180', 'New VP Engineering hired', 'Design team doubled'] },
    { title: 'Financial Projections', kicker: 'Looking ahead',       bullets: ['Q3 target: $95M transaction volume', '40% gross margin target', 'Cash runway: 28 months'] },
    { title: 'Partnerships',          kicker: 'Who we built with',   bullets: ['MTN Mobile Money integration live', 'Flutterwave API partnership signed', 'Binance liquidity pool access'] },
    { title: 'Next Steps & Asks',     kicker: 'Calls to action',     bullets: ['Board approval for Series B extension', 'Regulatory counsel in 3 new markets', 'Marketing budget increase for Q3'] },
  ];
  const previewFallbackSlides = generationStatus === 'idle'
    ? (makePreviewDraftSlides(config, slideCount).length ? makePreviewDraftSlides(config, slideCount) : normalizePreviewSlides(seed.slice(0, slideCount), config?.templateStyle))
    : [];
  const initialSlides = incomingSlides.length ? incomingSlides : previewFallbackSlides;
  const [slides, setSlides] = React.useState(initialSlides);

  React.useEffect(() => {
    const nextSlides = normalizePreviewSlides(generatedSlides, config?.templateStyle);
    if (!nextSlides.length) return;
    setSlides(nextSlides);
    setEditingIndex(null);
    setExpanded(new Set([0]));
  }, [JSON.stringify(incomingSlides.map((s) => ({ title: s.title, bullets: s.bullets })))]);

  const toggleExpand = (i) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  const expandAll = () => setExpanded(new Set(slides.map((_, i) => i)));
  const collapseAll = () => setExpanded(new Set());

  const handleDelete = (i) => { setSlides(p => p.filter((_, j) => j !== i)); if (editingIndex === i) setEditingIndex(null); };
  const handleEditStart = (i) => { setEditingIndex(i); setEditDraft({ title: slides[i].title, bullets: [...slides[i].bullets] }); setExpanded(p => new Set([...p, i])); };
  const handleEditSave = () => { setSlides(p => p.map((s, j) => j === editingIndex ? { ...s, ...editDraft } : s)); setEditingIndex(null); };
  const handleAdd = () => {
    setSlides((p) => {
      const nextSlide = { title: 'New slide', contentType: 'section', kicker: 'Untitled', bullets: ['Add your content here'] };
      const enhanced = window.AutoDeckTemplatePresets?.enhanceSlide
        ? window.AutoDeckTemplatePresets.enhanceSlide(nextSlide, p.length, config?.templateStyle)
        : nextSlide;
      return [...p, enhanced];
    });
  };

  const themes = {
    purple:   { name: 'Quidax',   c1: '#2D0F4E', c2: '#5F2A91', c3: '#B891DC' },
    midnight: { name: 'Midnight', c1: '#0F0A24', c2: '#312E81', c3: '#A5B4FC' },
    soft:     { name: 'Soft',     c1: '#FAF5FF', c2: '#E9D5FF', c3: '#7B2FBE' },
    ocean:    { name: 'Ocean',    c1: '#0C2B4E', c2: '#0369A1', c3: '#7DD3FC' },
    sunset:   { name: 'Sunset',   c1: '#431407', c2: '#9A3412', c3: '#FED7AA' },
    forest:   { name: 'Forest',   c1: '#022C22', c2: '#065F46', c3: '#6EE7B7' },
    rose:     { name: 'Rose',     c1: '#4C0519', c2: '#BE123C', c3: '#FECACA' },
  };
  const tc = themes[theme] || themes.purple;
  const generationFailedWithoutSlides = generationStatus === 'error' && !incomingSlides.length;
  const readyWithoutSlides = generationStatus === 'ready' && !incomingSlides.length;
  const statusEyebrow = generationStatus === 'ready'
    ? 'Ready · Firebase generated'
    : generationStatus === 'idle'
      ? 'Ready · Demo preview'
      : 'Ready · Generated slides';

  if (generationFailedWithoutSlides || readyWithoutSlides) {
    const traceDeckId = activeDeckId || generationTrace?.deckId || '';
    const traceStage = generationTrace?.stage || generationStatus;
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: qxType.body, color: T.ink, padding: '32px 40px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E03E6B', boxShadow: '0 0 12px rgba(224,62,107,0.4)' }} />
            Generation needs attention
          </div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkMute }}>
            AutoDeck AI · Preview
          </div>
        </div>

        <div style={{
          minHeight: 460,
          borderRadius: qxRadius.xl,
          border: `1px solid ${T.border}`,
          background: T.surface,
          boxShadow: qxShadow(dark).md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 14 }}>
              No local draft was used
            </div>
            <h1 style={{ fontFamily: qxType.display, fontSize: 42, fontWeight: 500, letterSpacing: '-0.025em', margin: '0 0 12px', color: T.ink }}>
              Generated slides were not returned.
            </h1>
            <p style={{ margin: '0 0 24px', color: T.inkDim, lineHeight: 1.6, fontSize: 15 }}>
              {generationError || 'Firebase finished without readable generated slides. Please try again with a shorter source or fewer requested slides.'}
            </p>
            {(traceDeckId || traceStage) && (
              <div style={{
                margin: '0 auto 24px',
                padding: '10px 14px',
                borderRadius: qxRadius.lg,
                border: `1px solid ${T.border}`,
                background: dark ? 'rgba(255,255,255,0.05)' : '#FAF8FC',
                color: T.inkMute,
                fontFamily: qxType.mono,
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {traceDeckId && <span>Deck {traceDeckId}</span>}
                {traceStage && <span>Stage {traceStage}</span>}
              </div>
            )}
            <button onClick={onGenerateAgain} style={{
              padding: '12px 20px',
              borderRadius: qxRadius.full,
              border: 'none',
              background: QX.lime,
              color: QX.limeInk,
              fontFamily: qxType.body,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Back to generator
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── COVER (editorial, full-bleed, unmistakable) ──────────
  const Cover = () => (
    <div style={{
      position: 'relative',
      borderRadius: qxRadius.xl,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${tc.c1} 0%, ${tc.c2} 60%, ${tc.c3} 140%)`,
      padding: '64px 56px 56px',
      minHeight: 520,
      color: '#F6F1FB',
      ...qxMotion.scaleIn(0),
      boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.55)' : '0 30px 80px rgba(45,15,78,0.25)',
    }}>
      {/* Geometric decoration */}
      <div aria-hidden style={{ position: 'absolute', top: -120, right: -120, width: 480, height: 480, borderRadius: '50%', border: `1px solid ${tc.c3}30`, opacity: 0.6 }} />
      <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 360, height: 360, borderRadius: '50%', border: `1px solid ${tc.c3}20`, opacity: 0.5 }} />
      <div aria-hidden style={{ position: 'absolute', bottom: -180, left: -180, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${tc.c3}22 0%, transparent 60%)`, filter: 'blur(20px)' }} />

      {/* Top row — issue mark on left, theme picker + diamond on right */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 56 }}>
        <div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 8 }}>
            Quidax · Internal
          </div>
          <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', opacity: 0.85 }}>
            Vol. 26 · Issue {String(Math.floor(Math.random() * 99) + 10).padStart(2, '0')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(themes).map(([k, t]) => (
              <button key={k} onClick={() => setTheme(k)} title={t.name} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: `linear-gradient(135deg, ${t.c1}, ${t.c2}, ${t.c3})`,
                border: theme === k ? '2px solid #F6F1FB' : '2px solid transparent',
                boxShadow: theme === k ? '0 0 0 1px rgba(246,241,251,0.4)' : 'none',
                cursor: 'pointer', padding: 0,
                transition: `all 140ms ${qxEase}`,
              }} />
            ))}
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L20 11L11 20L2 11L11 2Z" stroke="#F6F1FB" strokeWidth="1.4" fill="none"/>
              <circle cx="11" cy="11" r="2.5" fill="#F6F1FB"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: 'relative', maxWidth: 720 }}>
        <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.30em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 28, height: 1, background: 'rgba(246,241,251,0.4)' }} />
          The deck
        </div>
        <h1 style={{
          fontFamily: qxType.display,
          fontSize: 'clamp(48px, 6vw, 84px)',
          fontWeight: 500,
          lineHeight: 0.96,
          letterSpacing: '-0.035em',
          margin: 0,
          color: '#F6F1FB',
        }}>
          {deckTitle}<span style={{ color: tc.c3, fontStyle: 'italic', fontWeight: 400 }}>.</span>
        </h1>
      </div>

      {/* Bottom strip — meta on the left, actions on the right, single baseline */}
      <div style={{
        position: 'relative',
        marginTop: 56,
        paddingTop: 24,
        borderTop: `1px solid ${tc.c3}30`,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 32,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 40 }}>
          {[
            ['Slides', String(slides.length).padStart(2, '0')],
            ['Style', config?.templateStyle || 'Professional'],
            ['Created', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()],
            ['Read time', `${Math.max(2, Math.round(slides.length * 0.7))} min`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: qxType.mono, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 8 }}>{k}</div>
              <div style={{ fontFamily: qxType.display, fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={onGenerateAgain} style={{
            padding: '11px 18px', borderRadius: qxRadius.full,
            border: '1px solid rgba(246,241,251,0.25)',
            background: 'rgba(246,241,251,0.08)',
            backdropFilter: 'blur(10px)',
            color: '#F6F1FB',
            fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: `all 160ms ${qxEase}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(246,241,251,0.16)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(246,241,251,0.08)'; }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7A6 6 0 1112 4M1 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Generate again
          </button>
          <button onClick={() => onViewSlideshow && onViewSlideshow(slides)} style={{
            padding: '11px 22px', borderRadius: qxRadius.full,
            border: 'none', background: QX.lime, color: '#1A0530',
            fontFamily: qxType.body, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 8px 30px rgba(212,255,63,0.45)',
            transition: `all 180ms ${qxEase}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(212,255,63,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,255,63,0.45)'; }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><polygon points="3,2 12,7 3,12" fill="currentColor"/></svg>
            Open slideshow
          </button>
        </div>
      </div>

    </div>
  );

  return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: qxType.body, color: T.ink, padding: '32px 40px 80px' }}>
      {/* Eyebrow strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: QX.lime, boxShadow: `0 0 12px ${QX.lime}`, animation: 'qxBreathe 2.4s ease-in-out infinite' }} />
          {statusEyebrow}
        </div>
        <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkMute }}>
          AutoDeck AI · Preview
        </div>
      </div>

      {generationStatus === 'error' && generationError && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.inkDim, fontSize: 13.5 }}>
          {generationError}
        </div>
      )}

      <Cover />

      {/* Outline header */}
      <div style={{ marginTop: 56, marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', ...qxMotion.fadeUp(200) }}>
        <div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 8 }}>
            The outline
          </div>
          <h2 style={{ fontFamily: qxType.display, fontSize: 32, fontWeight: 500, color: T.ink, margin: 0, letterSpacing: '-0.025em' }}>
            <span style={{ color: T.primary, fontStyle: 'italic', fontWeight: 400 }}>{slides.length}</span> slides, ranked.
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={expandAll} style={miniPillBtn(T)}>Expand all</button>
          <button onClick={collapseAll} style={miniPillBtn(T)}>Collapse all</button>
        </div>
      </div>

      {/* Outline list */}
      <div style={{ borderTop: `1px solid ${T.borderHi}` }}>
        {slides.map((s, i) => {
          const isOpen = expanded.has(i);
          const isEditing = editingIndex === i;
          return (
            <div key={i} style={{
              borderBottom: `1px solid ${T.border}`,
              transition: `background 180ms ${qxEase}`,
              background: isOpen ? T.surface : 'transparent',
              ...qxMotion.fadeUp(220 + i * 30),
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '64px 110px 1fr auto',
                alignItems: 'center',
                gap: 20,
                padding: '20px 16px 20px 8px',
                cursor: isEditing ? 'default' : 'pointer',
              }}
                onClick={() => !isEditing && toggleExpand(i)}>
                {/* Index — oversized, editorial */}
                <div style={{
                  fontFamily: qxType.display,
                  fontSize: 36, fontWeight: 500,
                  color: isOpen ? T.primary : T.inkFaint,
                  letterSpacing: '-0.04em', lineHeight: 1,
                  textAlign: 'right',
                  transition: `color 180ms ${qxEase}`,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                {/* Kicker */}
                <div style={{
                  fontFamily: qxType.mono, fontSize: 10.5,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: T.inkMute, lineHeight: 1.3,
                }}>
                  {s.kicker || 'Section'}
                </div>
                {/* Title */}
                <div style={{ minWidth: 0 }}>
                  {isEditing ? (
                    <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontFamily: qxType.display, fontSize: 22, fontWeight: 500,
                        color: T.ink, background: T.bgElev,
                        border: `1px solid ${T.primary}`, borderRadius: qxRadius.sm,
                        padding: '8px 12px', outline: 'none', width: '100%',
                        letterSpacing: '-0.015em',
                      }} />
                  ) : (
                    <div style={{
                      fontFamily: qxType.display, fontSize: 22, fontWeight: 500,
                      color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.2,
                    }}>{s.title}</div>
                  )}
                </div>
                {/* Right meta + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => isEditing && e.stopPropagation()}>
                  <span style={{ fontFamily: qxType.mono, fontSize: 10, color: T.inkMute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {s.bullets.length} {s.bullets.length === 1 ? 'point' : 'points'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{
                    color: T.inkDim,
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: `transform 220ms ${qxEase}`,
                  }}>
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={{
                  padding: '0 16px 22px 182px',
                  ...qxMotion.fadeIn(0),
                }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
                      {editDraft.bullets.map((b, j) => (
                        <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input value={b}
                            onChange={e => setEditDraft(d => ({ ...d, bullets: d.bullets.map((x, k) => k === j ? e.target.value : x) }))}
                            style={{
                              flex: 1, fontSize: 14, color: T.ink,
                              background: T.bgElev, border: `1px solid ${T.border}`,
                              borderRadius: qxRadius.sm, padding: '8px 12px',
                              outline: 'none', fontFamily: qxType.body,
                            }} />
                          <button onClick={() => setEditDraft(d => ({ ...d, bullets: d.bullets.filter((_, k) => k !== j) }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute, padding: 4, display: 'flex' }}>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M5 3V2h4v1M4 3l.5 9h5L10 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setEditDraft(d => ({ ...d, bullets: [...d.bullets, ''] }))}
                        style={{ ...miniPillBtn(T), alignSelf: 'flex-start', marginTop: 4 }}>
                        + Add point
                      </button>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={handleEditSave} style={{
                          padding: '9px 18px', borderRadius: qxRadius.full,
                          border: 'none', background: QX.lime, color: '#1A0530',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          boxShadow: '0 4px 18px rgba(212,255,63,0.30)',
                        }}>Save changes</button>
                        <button onClick={() => setEditingIndex(null)} style={miniPillBtn(T)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720 }}>
                        {s.bullets.map((b, j) => (
                          <div key={j} style={{
                            display: 'grid', gridTemplateColumns: '24px 1fr', gap: 8,
                            fontSize: 14, color: T.inkDim, lineHeight: 1.6,
                          }}>
                            <span style={{
                              fontFamily: qxType.mono, fontSize: 10.5,
                              color: T.inkFaint, letterSpacing: '0.06em',
                              paddingTop: 4,
                            }}>·{String(j + 1).padStart(2, '0')}</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleEditStart(i); }} style={miniPillBtn(T)}>
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}><path d="M9.5 1.5l3 3L4 13H1V10z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(i); }} style={{ ...miniPillBtn(T), color: '#E03E6B', borderColor: 'rgba(224,62,107,0.20)' }}>
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}><path d="M2 3h10M5 3V2h4v1M4 3l.5 9h5L10 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add slide row */}
        <button onClick={handleAdd} style={{
          width: '100%', padding: '20px 16px',
          background: 'transparent', border: 'none',
          borderBottom: `1px solid ${T.border}`,
          display: 'grid', gridTemplateColumns: '64px 1fr', gap: 20,
          alignItems: 'center', cursor: 'pointer', textAlign: 'left',
          color: T.primary, fontFamily: qxType.body, fontSize: 14, fontWeight: 500,
          transition: `background 160ms ${qxEase}`,
        }}
          onMouseEnter={e => e.currentTarget.style.background = T.ghostBg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ fontFamily: qxType.display, fontSize: 36, fontWeight: 400, color: T.inkFaint, letterSpacing: '-0.04em', lineHeight: 1, textAlign: 'right' }}>+</div>
          <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Add a slide
          </div>
        </button>
      </div>
    </div>
  );
};

const miniPillBtn = (T) => ({
  padding: '6px 12px', borderRadius: qxRadius.full,
  border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim,
  fontFamily: qxType.body, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  transition: `all 140ms ${qxEase}`,
});

Object.assign(window, { PreviewScreen });
