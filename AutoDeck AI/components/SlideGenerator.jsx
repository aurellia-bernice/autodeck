// ============================================================
// SlideGenerator — editorial slideshow editor
// Crafted-editor personality: hairline chrome, 12-col grid,
// magazine-feel slide layouts, mono labels, lime as primary CTA.
// ============================================================

const DEMO_SLIDES = [
  { title: 'Q2 Sales Strategy', bullets: ['Strong Q2 performance across all verticals', 'New markets entered: Ghana, Senegal', 'Revenue up 34% YoY'] },
  { title: 'Market Overview', bullets: ['Africa crypto market growing at 18% CAGR', 'Quidax positioned in top 3 exchanges', 'User base crossed 2M milestone'] },
  { title: 'Key Metrics', bullets: ['Monthly active users: 1.2M', 'Transaction volume: $280M', 'NPS score: 72'] },
];

const SlideGenerator = ({ slides: initialSlides, config, tweaks, brandConfig, onBack }) => {
  const safeInitial = Array.isArray(initialSlides) && initialSlides.length > 0 ? initialSlides : DEMO_SLIDES;

  // ─── state ───────────────────────────────────────────────
  const [localSlides, setLocalSlides] = React.useState(() => safeInitial.map((s) => ({ ...s })));
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [globalTheme, setGlobalTheme] = React.useState(brandConfig?.colors ? 'custom' : 'purple');
  const [slideThemeOverrides, setSlideThemeOverrides] = React.useState({});
  const [slideLayoutOverrides, setSlideLayoutOverrides] = React.useState({});
  const [slideAlignments, setSlideAlignments] = React.useState({});
  const [slideImages, setSlideImages] = React.useState({});
  const [editPanelOpen, setEditPanelOpen] = React.useState(false);
  const [editTab, setEditTab] = React.useState('layout');
  const [imgQuery, setImgQuery] = React.useState('');
  const [imgResults, setImgResults] = React.useState([]);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showThemePop, setShowThemePop] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [transitionKey, setTransitionKey] = React.useState(0);
  const [editingField, setEditingField] = React.useState(null); // { field: 'title'|'bullet', bi?: number }

  const commitEdit = (value) => {
    if (!editingField) return;
    const trimmed = value.trim();
    setLocalSlides(prev => prev.map((s, i) => {
      if (i !== currentIndex) return s;
      if (editingField.field === 'title') return { ...s, title: trimmed || s.title };
      if (editingField.field === 'eyebrow') return { ...s, eyebrow: trimmed || s.eyebrow };
      if (editingField.field === 'figure') return { ...s, figure: trimmed || s.figure };
      if (editingField.field === 'stat-num') {
        const bullets = [...s.bullets]; bullets[0] = trimmed || bullets[0]; return { ...s, bullets };
      }
      const bullets = [...s.bullets];
      bullets[editingField.bi] = trimmed || bullets[editingField.bi];
      return { ...s, bullets };
    }));
    setEditingField(null);
  };

  // agent state
  const [agentOpen, setAgentOpen] = React.useState(false);
  const [agentSlideIndex, setAgentSlideIndex] = React.useState(0);
  const [agentMessages, setAgentMessages] = React.useState([]);
  const [agentInput, setAgentInput] = React.useState('');
  const [agentThinking, setAgentThinking] = React.useState(false);
  const agentScrollRef = React.useRef(null);
  const agentInputRef = React.useRef(null);

  // ─── theme palette (per-slide) ───────────────────────────
  const customTheme = brandConfig?.colors ? {
    name: 'Brand',
    swatch: brandConfig.colors.primary,
    gradient: `linear-gradient(155deg,${brandConfig.colors.bgDark || '#0F031F'} 0%,${brandConfig.colors.primary} 55%,${brandConfig.colors.secondary || brandConfig.colors.primary} 100%)`,
    title: brandConfig.colors.bgLight || '#F6F1FB',
    text: `${brandConfig.colors.bgLight || '#F6F1FB'}c7`,
    accent: brandConfig.colors.lime || brandConfig.colors.accent || '#D4FF3F',
    rule: `${brandConfig.colors.bgLight || '#F6F1FB'}2e`,
  } : null;

  const THEMES = {
    ...(customTheme ? { custom: customTheme } : {}),
    purple:   { name: 'Quidax',   swatch: '#7B2FBE', gradient: 'linear-gradient(155deg,#1A0530 0%,#2D0F4E 50%,#451B6E 100%)', title: '#F6F1FB', text: 'rgba(246,241,251,0.78)', accent: '#D4FF3F', rule: 'rgba(246,241,251,0.18)' },
    midnight: { name: 'Midnight', swatch: '#312E81', gradient: 'linear-gradient(155deg,#0F0A24 0%,#1E1B4B 55%,#312E81 100%)', title: '#F5F3FF', text: 'rgba(245,243,255,0.78)', accent: '#A5B4FC', rule: 'rgba(245,243,255,0.18)' },
    soft:     { name: 'Soft',     swatch: '#E9D5FF', gradient: 'linear-gradient(155deg,#FAF5FF 0%,#F3E8FF 55%,#FCE7F3 100%)', title: '#1A0530', text: 'rgba(26,5,48,0.72)',     accent: '#7B2FBE', rule: 'rgba(26,5,48,0.18)'    },
    ocean:    { name: 'Ocean',    swatch: '#0369A1', gradient: 'linear-gradient(155deg,#0C2B4E 0%,#0369A1 55%,#0891B2 100%)', title: '#F0F9FF', text: 'rgba(240,249,255,0.78)', accent: '#7DD3FC', rule: 'rgba(240,249,255,0.20)' },
    forest:   { name: 'Forest',   swatch: '#065F46', gradient: 'linear-gradient(155deg,#022C22 0%,#065F46 55%,#047857 100%)', title: '#ECFDF5', text: 'rgba(236,253,245,0.78)', accent: '#6EE7B7', rule: 'rgba(236,253,245,0.20)' },
    sunset:   { name: 'Sunset',   swatch: '#C2410C', gradient: 'linear-gradient(155deg,#431407 0%,#7C2D12 50%,#C2410C 100%)', title: '#FFF7ED', text: 'rgba(255,247,237,0.80)', accent: '#FED7AA', rule: 'rgba(255,247,237,0.20)' },
    slate:    { name: 'Slate',    swatch: '#334155', gradient: 'linear-gradient(155deg,#0F172A 0%,#1E293B 55%,#334155 100%)', title: '#F8FAFC', text: 'rgba(248,250,252,0.78)', accent: '#CBD5E1', rule: 'rgba(248,250,252,0.18)' },
    rose:     { name: 'Rose',     swatch: '#BE123C', gradient: 'linear-gradient(155deg,#4C0519 0%,#881337 55%,#BE123C 100%)', title: '#FFF1F2', text: 'rgba(255,241,242,0.80)', accent: '#FECACA', rule: 'rgba(255,241,242,0.20)' },
  };

  // ─── layouts ─────────────────────────────────────────────
  const layoutSwatch = (variant, t) => {
    const fg = t.title;
    const acc = t.accent;
    const rule = t.rule;
    const common = { width: 40, height: 23, viewBox: '0 0 40 23', fill: 'none' };
    if (variant === 'standard') return (
      <svg {...common}><rect x="2" y="3" width="14" height="2" rx=".5" fill={fg} opacity=".95" /><rect x="2" y="6" width="6" height=".8" rx=".4" fill={acc} /><rect x="2" y="10" width="20" height=".7" fill={fg} opacity=".55" /><rect x="2" y="12.5" width="16" height=".7" fill={fg} opacity=".4" /><rect x="2" y="15" width="22" height=".7" fill={fg} opacity=".55" /><rect x="2" y="20" width="6" height=".5" fill={rule} /></svg>);
    if (variant === 'split') return (
      <svg {...common}><rect x="2" y="4" width="13" height="2.5" rx=".5" fill={fg} opacity=".95" /><rect x="2" y="8" width="6" height=".8" rx=".4" fill={acc} /><line x1="20" y1="3" x2="20" y2="20" stroke={rule} strokeWidth=".5" /><rect x="22" y="5" width="14" height=".7" fill={fg} opacity=".6" /><rect x="22" y="7.5" width="11" height=".7" fill={fg} opacity=".55" /><rect x="22" y="10" width="14" height=".7" fill={fg} opacity=".55" /><rect x="22" y="12.5" width="9" height=".7" fill={fg} opacity=".55" /></svg>);
    if (variant === 'bigTitle') return (
      <svg {...common}><rect x="2" y="3" width="36" height="3.5" rx=".7" fill={fg} opacity=".95" /><rect x="2" y="8.5" width="28" height="3.5" rx=".7" fill={fg} opacity=".85" /><rect x="2" y="14" width="6" height=".8" rx=".4" fill={acc} /><rect x="2" y="17" width="22" height=".7" fill={fg} opacity=".5" /></svg>);
    if (variant === 'quote') return (
      <svg {...common}><text x="3" y="9" fontSize="9" fontFamily="Georgia" fill={acc}>"</text><rect x="9" y="6" width="28" height="1.2" rx=".5" fill={fg} opacity=".85" /><rect x="9" y="9" width="24" height="1.2" rx=".5" fill={fg} opacity=".85" /><rect x="9" y="12" width="20" height="1.2" rx=".5" fill={fg} opacity=".85" /><rect x="9" y="17" width="10" height=".6" rx=".3" fill={fg} opacity=".5" /></svg>);
    if (variant === 'minimal') return (
      <svg {...common}><rect x="2" y="10" width="22" height="2" rx=".5" fill={fg} opacity=".95" /><rect x="2" y="14" width="4" height=".7" rx=".3" fill={acc} /></svg>);
    if (variant === 'stat') return (
      <svg {...common}><text x="2" y="16" fontSize="14" fontWeight="600" fontFamily="serif" fill={fg}>34</text><text x="14" y="16" fontSize="14" fontWeight="600" fontFamily="serif" fill={acc}>%</text><rect x="22" y="6" width="14" height=".7" fill={fg} opacity=".5" /><rect x="22" y="8.5" width="12" height=".7" fill={fg} opacity=".5" /><rect x="22" y="11" width="14" height=".7" fill={fg} opacity=".5" /></svg>);
    if (variant === 'image') return (
      <svg {...common}><rect x="2" y="3" width="17" height="17" rx="1" fill={fg} opacity=".18" /><line x1="3" y1="4" x2="18" y2="19" stroke={fg} strokeWidth=".4" opacity=".4" /><circle cx="14" cy="7" r="1.2" fill={fg} opacity=".5" /><rect x="22" y="6" width="14" height="1.2" rx=".5" fill={fg} opacity=".9" /><rect x="22" y="9" width="6" height=".7" rx=".3" fill={acc} /><rect x="22" y="12" width="14" height=".7" fill={fg} opacity=".5" /><rect x="22" y="14.5" width="11" height=".7" fill={fg} opacity=".5" /></svg>);
    return null;
  };

  const LAYOUTS = [
    { key: 'standard', name: 'Standard',  desc: 'Title + bullets' },
    { key: 'split',    name: 'Split',      desc: 'Title left · list right' },
    { key: 'bigTitle', name: 'Bold',       desc: 'Oversized headline' },
    { key: 'stat',     name: 'Stat',       desc: 'Hero number + context' },
    { key: 'quote',    name: 'Quote',      desc: 'Pull quote, attributed' },
    { key: 'image',    name: 'Image-led',  desc: 'Photo + text panel' },
    { key: 'minimal',  name: 'Minimal',    desc: 'Title alone' },
  ];

  // ─── derived ─────────────────────────────────────────────
  const getTheme  = (i) => THEMES[slideThemeOverrides[i] || globalTheme];
  const getLayout = (i) => slideLayoutOverrides[i] || 'standard';
  const getAlign  = (i) => slideAlignments[i] || 'left';
  const theme  = getTheme(currentIndex);
  const layout = getLayout(currentIndex);
  const align  = getAlign(currentIndex);
  const slide  = localSlides[currentIndex] || localSlides[0];
  const total  = localSlides.length;
  const deckTitleRaw = config?.inputText ? config.inputText.trim() : 'Untitled deck';
  const deckTitle = deckTitleRaw.split(/\s+/).slice(0, 6).join(' ') + (deckTitleRaw.split(/\s+/).length > 6 ? '…' : '');

  // ─── helpers ─────────────────────────────────────────────
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const goTo = (i) => {
    setEditingField(null);
    const next = Math.max(0, Math.min(localSlides.length - 1, i));
    setCurrentIndex(next);
    setTransitionKey((k) => k + 1);
  };

  const handleImgSearch = (q) => {
    setImgQuery(q);
    if (!q.trim()) { setImgResults([]); return; }
    setImgResults(Array.from({ length: 6 }, (_, i) => ({
      id: i,
      src:   `https://picsum.photos/seed/${encodeURIComponent(q)}${i + 1}/1600/900`,
      thumb: `https://picsum.photos/seed/${encodeURIComponent(q)}${i + 1}/280/158`,
    })));
  };

  // keyboard
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setEditPanelOpen(false); setShowMenu(false); setShowThemePop(false); setAgentOpen(false); }
      if (editPanelOpen || agentOpen || editingField) return;
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
      if (e.key === 'ArrowLeft')  goTo(currentIndex - 1);
      if (e.key === 'g') setShowGrid((s) => !s);
      if (e.key === 'f') handlePresent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, localSlides.length, editPanelOpen, agentOpen, editingField]);

  // scroll agent chat
  React.useEffect(() => {
    if (agentScrollRef.current) agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight;
  }, [agentMessages, agentThinking]);

  // ─── action handlers ─────────────────────────────────────
  const handlePresent = () => {
    setShowMenu(false);
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    showToast('Press Esc to exit presentation', 'info');
  };
  const handleExportPDF    = () => { setShowMenu(false); window.print(); };

  const handleDownloadPPTX = async () => {
    setShowMenu(false);
    showToast('Generating .pptx…', 'loading');
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      localSlides.forEach((s, i) => {
        const t = getTheme(i);
        const pSlide = pptx.addSlide();
        const bg = t.swatch.replace('#', '');
        pSlide.background = { color: bg };
        pSlide.addText(s.title || '', {
          x: 0.5, y: 1.0, w: '85%', h: 1.2,
          fontSize: 36, bold: true,
          color: (t.title || '#FFFFFF').replace('#', ''),
          fontFace: 'Calibri',
        });
        if (s.bullets && s.bullets.length) {
          pSlide.addText(s.bullets.map(b => ({ text: b, options: { bullet: { type: 'number' } } })), {
            x: 0.5, y: 2.6, w: '85%', h: 3.8,
            fontSize: 18,
            color: 'FFFFFF',
            fontFace: 'Calibri',
          });
        }
      });
      await pptx.writeFile({ fileName: `${deckTitle || 'AutoDeck'}.pptx` });
      showToast('✓ PPTX downloaded', 'success');
    } catch (err) {
      showToast('Export failed — try again', 'info');
    }
  };

  const handleDownloadPNG = async () => {
    setShowMenu(false);
    showToast('Saving slide as PNG…', 'loading');
    try {
      const el = document.getElementById('main-slide');
      if (!el) { showToast('Slide not found', 'info'); return; }
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `slide-${currentIndex + 1}.png`;
      a.click();
      showToast('✓ Slide saved as PNG', 'success');
    } catch (err) {
      showToast('Export failed — try again', 'info');
    }
  };
  const handleShare        = () => { setShowMenu(false); const link = `autodeck.quidax.com/d/${Math.random().toString(36).slice(2, 8)}`; navigator.clipboard?.writeText(link).catch(() => {}); showToast('Link copied · ' + link, 'success'); };
  const handleDuplicate    = () => { setShowMenu(false); showToast('Deck duplicated to your library', 'success'); };

  const applyLayout     = (key) => setSlideLayoutOverrides((p) => ({ ...p, [currentIndex]: key }));
  const applyAlign      = (val) => setSlideAlignments((p) => ({ ...p, [currentIndex]: val }));
  const applyImage      = (url) => { setSlideImages((p) => ({ ...p, [currentIndex]: url })); setEditTab('layout'); };
  const removeImage     = ()    => setSlideImages((p) => { const n = { ...p }; delete n[currentIndex]; return n; });
  const applySlideTheme = (key) => setSlideThemeOverrides((p) => {
    const n = { ...p };
    if (n[currentIndex] === key) delete n[currentIndex]; else n[currentIndex] = key;
    return n;
  });

  // ─── agent logic ─────────────────────────────────────────
  const openAgent = (idx) => {
    setAgentSlideIndex(idx);
    setAgentMessages([{ role: 'assistant', text: `I've got slide ${idx + 1} open — "${localSlides[idx]?.title}". What should I change?` }]);
    setAgentInput('');
    setAgentOpen(true);
    setTimeout(() => agentInputRef.current?.focus(), 80);
  };

  const simulateAgentResponse = (userText, idx) => {
    const t = userText.toLowerCase();
    setLocalSlides((prev) => {
      const next = prev.map((s) => ({ ...s, bullets: [...s.bullets] }));
      const s = next[idx];
      if (t.includes('title') || t.includes('heading')) {
        const words = userText.replace(/title|heading|change|make|to|the|be/gi, '').trim();
        if (words.length > 2) s.title = words.charAt(0).toUpperCase() + words.slice(1);
        return next;
      }
      if (t.includes('concise') || t.includes('shorter') || t.includes('shorten')) {
        s.bullets = s.bullets.slice(0, Math.max(1, Math.ceil(s.bullets.length / 2)));
        return next;
      }
      if (t.includes('expand') || t.includes('longer') || t.includes('more detail')) {
        const extra = ['This is key to success', 'Consider the broader implications', 'Teams should align on this priority'];
        s.bullets = [...s.bullets, ...extra.slice(0, 2)];
        return next;
      }
      if (t.includes('add bullet') || t.includes('add point')) {
        const newPoint = userText.replace(/add\s+(a\s+)?(bullet|point)\s*(about|on|for|:)?/i, '').trim();
        s.bullets.push(newPoint.length > 2 ? newPoint.charAt(0).toUpperCase() + newPoint.slice(1) : 'New key point');
        return next;
      }
      if (t.includes('remove') && (t.includes('bullet') || t.includes('point') || t.includes('last'))) {
        if (s.bullets.length > 1) s.bullets.pop();
        return next;
      }
      return next;
    });
    const replies = [
      `Done — slide ${idx + 1} is updated.`,
      `Updated. Anything else on slide ${idx + 1}?`,
      `Live now. The change is in.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  };

  const handleAgentSend = async () => {
    const text = agentInput.trim();
    if (!text || agentThinking) return;
    const updatedHistory = [...agentMessages, { role: 'user', text }];
    setAgentMessages(updatedHistory);
    setAgentInput('');
    setAgentThinking(true);

    let reply = null;
    let usedRealApi = false;

    try {
      if (window.firebase?.app) {
        const agentEditFn = firebase.app().functions('us-central1').httpsCallable('agentEdit');
        const slide = localSlides[agentSlideIndex] || {};
        const { data } = await agentEditFn({
          slideTitle: slide.title || '',
          bullets: slide.bullets || [],
          userMessage: text,
          history: agentMessages.map(m => ({ role: m.role, text: m.text })),
        });
        if (data.updatedTitle || data.updatedBullets) {
          setLocalSlides((prev) => {
            const next = prev.map((s) => ({ ...s, bullets: [...s.bullets] }));
            const s = next[agentSlideIndex];
            if (data.updatedTitle) s.title = data.updatedTitle;
            if (data.updatedBullets) s.bullets = data.updatedBullets;
            return next;
          });
          reply = data.assistantReply || `Done — slide ${agentSlideIndex + 1} updated.`;
          usedRealApi = true;
        }
      }
    } catch (_) {}

    if (!usedRealApi) {
      reply = simulateAgentResponse(text, agentSlideIndex);
    }

    setAgentMessages((p) => [...p, { role: 'assistant', text: reply }]);
    setAgentThinking(false);
    setTimeout(() => agentInputRef.current?.focus(), 30);
  };

  // ─── slide chrome (inside the slide canvas) ──────────────
  const SlideFrame = ({ t, hasImg, index, total, isLight }) => {
    const fg   = hasImg ? '#fff' : t.title;
    const rule = hasImg ? 'rgba(255,255,255,0.22)' : t.rule;
    const dim  = hasImg ? 'rgba(255,255,255,0.55)' : isLight ? 'rgba(26,5,48,0.5)' : 'rgba(246,241,251,0.5)';
    return (
      <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, background: t.accent, borderRadius: 1 }} />
            <span style={{ color: fg, fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.32em', textTransform: 'uppercase', opacity: 0.75 }}>Quidax</span>
          </div>
          <span style={{ color: fg, fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', opacity: 0.65 }}>{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div style={{ position: 'absolute', top: 36, left: 32, right: 32, height: 1, background: rule, zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: 30, left: 32, right: 32, height: 1, background: rule, zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 32px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 }}>
          <span style={{ color: dim, fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Internal · Confidential</span>
          <span style={{ color: dim, fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em' }}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        </div>
      </>
    );
  };

  // ─── grid overlay (only when editing) ────────────────────
  const GridOverlay = ({ visible, color }) => {
    if (!visible) return null;
    return (
      <div style={{ position: 'absolute', inset: '48px 32px 48px 32px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, pointerEvents: 'none', zIndex: 4 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ height: '100%', borderLeft: `1px dashed ${color}`, borderRight: i === 11 ? `1px dashed ${color}` : 'none', opacity: 0.7 }} />
        ))}
      </div>
    );
  };

  // ─── slide renderers ─────────────────────────────────────
  const SlideContent = ({ slide, t, layout, align, bgImg, index, total, gridOn }) => {
    const dFont = brandConfig?.displayFont || qxType.display;
    const bFont = brandConfig?.bodyFont    || qxType.body;

    const EditableText = ({ tag: Tag = 'div', field, bi, editValue, style, children, ...rest }) => {
      const isEditing =
        field === 'title'    ? editingField?.field === 'title'    :
        field === 'eyebrow'  ? editingField?.field === 'eyebrow'  :
        field === 'figure'   ? editingField?.field === 'figure'   :
        field === 'stat-num' ? editingField?.field === 'stat-num' :
        editingField?.field === 'bullet' && editingField?.bi === bi;
      return (
        <Tag
          contentEditable={isEditing}
          suppressContentEditableWarning
          onDoubleClick={(e) => {
            e.stopPropagation();
            const el = e.currentTarget;
            const ef =
              field === 'title'    ? { field: 'title' }    :
              field === 'eyebrow'  ? { field: 'eyebrow' }  :
              field === 'figure'   ? { field: 'figure' }   :
              field === 'stat-num' ? { field: 'stat-num' } :
              { field: 'bullet', bi };
            setEditingField(ef);
            requestAnimationFrame(() => {
              if (editValue !== undefined) el.textContent = editValue;
              el.focus();
            });
          }}
          onBlur={isEditing ? (e) => commitEdit(e.currentTarget.textContent) : undefined}
          onKeyDown={isEditing ? (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(e.currentTarget.textContent); }
            if (e.key === 'Escape') { e.preventDefault(); setEditingField(null); }
          } : undefined}
          style={{
            ...style,
            cursor: 'text',
            outline: isEditing ? '2px solid rgba(212,255,63,0.55)' : 'none',
            borderRadius: isEditing ? 4 : undefined,
          }}
          {...rest}
        >
          {children}
        </Tag>
      );
    };

    const hasImg  = !!bgImg && layout !== 'image';
    const isLight = t.swatch === '#E9D5FF';
    const fg  = hasImg ? '#fff' : t.title;
    const tx  = hasImg ? 'rgba(255,255,255,0.86)' : t.text;
    const ac  = t.accent;
    const ta  = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const ai  = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const overlay   = hasImg ? 'linear-gradient(135deg,rgba(0,0,0,0.62),rgba(0,0,0,0.32))' : 'none';
    const gridColor = isLight ? 'rgba(26,5,48,0.10)' : 'rgba(246,241,251,0.08)';
    const container = { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: hasImg ? `url(${bgImg}) center/cover no-repeat` : t.gradient };
    const bodyInset = { position: 'absolute', top: 64, left: 32, right: 32, bottom: 54, zIndex: 2, display: 'flex' };

    const Eyebrow = ({ children, color }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: ai }}>
        <div style={{ width: 24, height: 1, background: color || ac }} />
        <EditableText tag="span" field="eyebrow" style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.30em', textTransform: 'uppercase', color: color || ac, opacity: 0.95 }}>{children}</EditableText>
      </div>
    );

    if (layout === 'centered') return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
          <Eyebrow>{slide.eyebrow || `Slide ${String(index + 1).padStart(2, '0')}`}</Eyebrow>
          <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(28px,4.6vw,52px)', color: fg, lineHeight: 1.05, letterSpacing: '-0.025em', margin: 0, maxWidth: '82%' }}>{slide.title}</EditableText>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '70%' }}>
            {slide.bullets.slice(0, 3).map((b, j) => (
              <EditableText key={j} tag="div" field="bullet" bi={j} style={{ color: tx, fontFamily: bFont, fontSize: 'clamp(13px,1.45vw,16px)', lineHeight: 1.6 }}>{b}</EditableText>
            ))}
          </div>
        </div>
      </div>
    );

    if (layout === 'split') return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, gap: 48 }}>
          <div style={{ flex: '0 0 44%', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${t.rule}`, paddingRight: 36 }}>
            <Eyebrow>{slide.eyebrow || `Section · ${String(index + 1).padStart(2, '0')}`}</Eyebrow>
            <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(26px,3.4vw,40px)', color: fg, lineHeight: 1.06, letterSpacing: '-0.022em', margin: 0, textAlign: ta }}>{slide.title}</EditableText>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, paddingLeft: 8 }}>
            {slide.bullets.map((b, j) => (
              <div key={j} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 11, color: ac, letterSpacing: '0.10em', flexShrink: 0, marginTop: 4 }}>{String(j + 1).padStart(2, '0')}</span>
                <EditableText tag="span" field="bullet" bi={j} style={{ color: tx, fontFamily: bFont, fontSize: 'clamp(13px,1.4vw,16px)', lineHeight: 1.55 }}>{b}</EditableText>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    if (layout === 'bigTitle') return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, flexDirection: 'column', justifyContent: 'flex-end', alignItems: ai }}>
          <Eyebrow>{slide.eyebrow || 'The headline'}</Eyebrow>
          <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(40px,7vw,84px)', color: fg, lineHeight: 0.98, letterSpacing: '-0.035em', margin: 0, textAlign: ta, maxWidth: '95%' }}>{slide.title}</EditableText>
          {slide.bullets[0] && (
            <EditableText tag="div" field="bullet" bi={0} style={{ marginTop: 24, color: tx, fontFamily: bFont, fontSize: 'clamp(14px,1.55vw,18px)', lineHeight: 1.55, maxWidth: '62%', textAlign: ta }}>{slide.bullets[0]}</EditableText>
          )}
        </div>
      </div>
    );

    if (layout === 'quote') return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg,rgba(0,0,0,0.7),rgba(0,0,0,0.45))', zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(80px,11vw,140px)', color: ac, lineHeight: 0.5, marginBottom: 8, opacity: 0.85 }}>"</div>
          <EditableText tag="blockquote" field="bullet" bi={0} style={{ fontFamily: dFont, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(20px,2.6vw,32px)', color: fg, lineHeight: 1.35, letterSpacing: '-0.012em', margin: 0, maxWidth: '82%' }}>
            {slide.bullets[0] || slide.title}
          </EditableText>
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 1, background: ac }} />
            <EditableText tag="span" field="title" style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: tx }}>{slide.title}</EditableText>
          </div>
        </div>
      </div>
    );

    if (layout === 'minimal') return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, flexDirection: 'column', justifyContent: 'center', alignItems: ai }}>
          <Eyebrow>{slide.eyebrow || `Slide ${String(index + 1).padStart(2, '0')} · ${String(total).padStart(2, '0')}`}</Eyebrow>
          <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 500, fontSize: 'clamp(34px,5.5vw,68px)', color: fg, lineHeight: 1.0, letterSpacing: '-0.030em', margin: 0, textAlign: ta, maxWidth: '90%' }}>{slide.title}</EditableText>
        </div>
      </div>
    );

    if (layout === 'stat') {
      const m   = (slide.bullets[0] || '').match(/(\d+(?:\.\d+)?)\s*(%|x|×|M|K|B|bn|m)?/i);
      const num = m ? m[1] : '34';
      const suf = m ? (m[2] || '%') : '%';
      const ctx = (slide.bullets[0] || 'Year-on-year growth').replace(/(\d+(?:\.\d+)?)\s*(%|x|×|M|K|B|bn|m)?/i, '').replace(/^[^\w]+|[^\w]+$/g, '').trim() || 'Year-on-year growth';
      return (
        <div style={container}>
          {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
          <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
          <GridOverlay visible={gridOn} color={gridColor} />
          <div style={{ ...bodyInset, gap: 48, alignItems: 'center' }}>
            <div style={{ flex: '0 0 56%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Eyebrow>{slide.eyebrow || 'The number'}</Eyebrow>
              <EditableText field="stat-num" editValue={slide.bullets[0] || ''} style={{ display: 'flex', alignItems: 'flex-start', lineHeight: 0.85, gap: 4 }}>
                <span style={{ fontFamily: dFont, fontWeight: 500, fontSize: 'clamp(120px,18vw,240px)', color: fg, letterSpacing: '-0.05em' }}>{num}</span>
                <span style={{ fontFamily: dFont, fontWeight: 500, fontSize: 'clamp(48px,7vw,90px)', color: ac, letterSpacing: '-0.02em', marginTop: '0.5em' }}>{suf}</span>
              </EditableText>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, borderLeft: `1px solid ${t.rule}`, paddingLeft: 36 }}>
              <EditableText tag="h3" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(20px,2.4vw,28px)', color: fg, lineHeight: 1.15, letterSpacing: '-0.018em', margin: 0 }}>{slide.title}</EditableText>
              <p style={{ fontFamily: bFont, fontSize: 'clamp(13px,1.4vw,16px)', lineHeight: 1.55, color: tx, margin: 0 }}>{ctx}</p>
              {slide.bullets[1] && (
                <EditableText tag="div" field="bullet" bi={1} style={{ paddingTop: 14, borderTop: `1px solid ${t.rule}`, fontFamily: bFont, fontSize: 'clamp(12px,1.25vw,14px)', color: tx, opacity: 0.85, lineHeight: 1.5 }}>{slide.bullets[1]}</EditableText>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (layout === 'image') {
      const img = bgImg || `https://picsum.photos/seed/${encodeURIComponent(slide.title)}/1600/900`;
      return (
        <div style={{ ...container, background: t.gradient }}>
          <SlideFrame t={t} hasImg={false} index={index} total={total} isLight={isLight} />
          <GridOverlay visible={gridOn} color={gridColor} />
          <div style={{ ...bodyInset, gap: 36 }}>
            <div style={{ flex: '0 0 52%', borderRadius: 8, overflow: 'hidden', position: 'relative', background: `url(${img}) center/cover no-repeat`, border: `1px solid ${t.rule}`, cursor: 'pointer' }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditPanelOpen(true); setEditTab('image'); }}
              onMouseEnter={(e) => { const ov = e.currentTarget.querySelector('.img-hover-ov'); if (ov) ov.style.opacity = '1'; }}
              onMouseLeave={(e) => { const ov = e.currentTarget.querySelector('.img-hover-ov'); if (ov) ov.style.opacity = '0'; }}
            >
              <EditableText tag="div" field="figure" style={{ position: 'absolute', top: 14, left: 14, fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#fff', opacity: 0.85, padding: '5px 9px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', borderRadius: 4, zIndex: 2, position: 'absolute' }}>{slide.figure || `Figure ${String(index + 1).padStart(2, '0')}`}</EditableText>
              <div className="img-hover-ov" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 180ms', pointerEvents: 'none' }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#fff', padding: '6px 12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: 6 }}>Double-click to change image</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              <Eyebrow>{slide.eyebrow || `Section · ${String(index + 1).padStart(2, '0')}`}</Eyebrow>
              <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(22px,3vw,38px)', color: fg, lineHeight: 1.08, letterSpacing: '-0.022em', margin: 0 }}>{slide.title}</EditableText>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                {slide.bullets.map((b, j) => (
                  <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: ac, marginTop: 9, flexShrink: 0 }} />
                    <EditableText tag="span" field="bullet" bi={j} style={{ color: tx, fontFamily: bFont, fontSize: 'clamp(13px,1.35vw,15px)', lineHeight: 1.55 }}>{b}</EditableText>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // standard (default)
    return (
      <div style={container}>
        {hasImg && <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 1 }} />}
        <SlideFrame t={t} hasImg={hasImg} index={index} total={total} isLight={isLight} />
        <GridOverlay visible={gridOn} color={gridColor} />
        <div style={{ ...bodyInset, flexDirection: 'column', justifyContent: 'center', alignItems: ai }}>
          <Eyebrow>{slide.eyebrow || `Section · ${String(index + 1).padStart(2, '0')}`}</Eyebrow>
          <EditableText tag="h2" field="title" style={{ fontFamily: dFont, fontWeight: 600, fontSize: 'clamp(26px,3.6vw,42px)', color: fg, lineHeight: 1.08, letterSpacing: '-0.025em', margin: 0, textAlign: ta, maxWidth: '80%' }}>{slide.title}</EditableText>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: '82%' }}>
            {slide.bullets.map((b, j) => (
              <div key={j} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: ai === 'flex-end' ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 11, color: ac, letterSpacing: '0.10em', flexShrink: 0, marginTop: 5 }}>{String(j + 1).padStart(2, '0')}</span>
                <EditableText tag="span" field="bullet" bi={j} style={{ color: tx, fontFamily: bFont, fontSize: 'clamp(13px,1.45vw,16.5px)', lineHeight: 1.55, textAlign: ta }}>{b}</EditableText>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── nav arrow style ─────────────────────────────────────
  const navStyle = (disabled, side) => ({
    width: 38, height: 38, borderRadius: '50%', padding: 0,
    border: '1px solid rgba(246,241,251,0.14)',
    background: disabled ? 'transparent' : 'rgba(246,241,251,0.04)',
    backdropFilter: 'blur(6px)',
    color: disabled ? 'rgba(246,241,251,0.18)' : 'rgba(246,241,251,0.7)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: `all 160ms ${qxEase}`,
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 14, zIndex: 5,
  });

  // ─── chrome button style ─────────────────────────────────
  const chromeBtn = (active = false) => ({
    height: 32, padding: '0 12px', borderRadius: 8,
    border: `1px solid ${active ? 'rgba(246,241,251,0.28)' : 'rgba(246,241,251,0.10)'}`,
    background: active ? 'rgba(246,241,251,0.06)' : 'transparent',
    color: active ? '#F6F1FB' : 'rgba(246,241,251,0.70)',
    fontFamily: qxType.body, fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
    transition: `all 140ms ${qxEase}`, letterSpacing: '0.005em',
  });

  // ─── JSX ─────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: '#0B0118', display: 'flex', flexDirection: 'column', fontFamily: qxType.body, userSelect: 'none', overflow: 'hidden' }}
      onClick={() => { setShowMenu(false); setShowThemePop(false); }}>

      {/* ══════════ TOP CHROME — editorial bar ══════════ */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(246,241,251,0.08)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.30)', flexShrink: 0, position: 'relative', zIndex: 50 }}
        onClick={(e) => e.stopPropagation()}>

        <button onClick={onBack} style={{ ...chromeBtn(), padding: '0 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,241,251,0.06)'; e.currentTarget.style.color = '#F6F1FB'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(246,241,251,0.70)'; }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5 8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>

        <div style={{ width: 1, height: 22, background: 'rgba(246,241,251,0.10)' }} />

        {/* Masthead */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 6, height: 6, background: QX.lime, borderRadius: 1 }} />
            <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.55)' }}>Quidax</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 3 }}>
            <span style={{ fontFamily: qxType.display, fontSize: 15, fontWeight: 600, color: '#F6F1FB', letterSpacing: '-0.012em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>{deckTitle}</span>
            <span style={{ fontFamily: qxType.mono, fontSize: 10, color: 'rgba(246,241,251,0.45)', letterSpacing: '0.14em' }}>{String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Right tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

          <button onClick={() => setShowGrid((s) => !s)} title="Toggle grid (G)" style={chromeBtn(showGrid)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1h11v11H1V1zM1 5h11M1 9h11M5 1v11M9 1v11" stroke="currentColor" strokeWidth="1" /></svg>
            Grid
          </button>

          {/* Theme picker */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowThemePop((p) => !p); setShowMenu(false); }} style={chromeBtn(showThemePop)}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: theme.swatch, border: '1px solid rgba(246,241,251,0.3)', display: 'inline-block' }} />
              Theme
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {showThemePop && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#170729', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 12, padding: 14, width: 240, zIndex: 300, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}>
                <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.45)', marginBottom: 10 }}>Deck theme</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  {Object.entries(THEMES).map(([k, t]) => (
                    <button key={k} title={t.name} onClick={() => setGlobalTheme(k)} style={{ aspectRatio: '1', borderRadius: 8, padding: 0, cursor: 'pointer', background: t.gradient, border: globalTheme === k ? '2px solid #F6F1FB' : '1px solid rgba(246,241,251,0.10)', transition: `all 140ms ${qxEase}` }} />
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(246,241,251,0.08)', display: 'flex', justifyContent: 'space-between', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.14em', color: 'rgba(246,241,251,0.5)' }}>
                  <span>Active</span>
                  <span style={{ color: '#F6F1FB' }}>{theme.name}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 22, background: 'rgba(246,241,251,0.10)', margin: '0 2px' }} />

          <button onClick={() => { setEditPanelOpen((p) => !p); setEditTab('layout'); }} style={chromeBtn(editPanelOpen)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a1.5 1.5 0 012.12 2.12L3.5 10.75 1 11.5l.75-3L8.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Customise
          </button>

          {/* Edit with Agent */}
          <button onClick={() => openAgent(currentIndex)} style={{ ...chromeBtn(), borderColor: 'rgba(212,255,63,0.35)', color: '#D4FF3F' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,255,63,0.08)'; e.currentTarget.style.borderColor = 'rgba(212,255,63,0.55)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(212,255,63,0.35)'; }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.2 3.3L10.5 5.5 7.2 6.7 6 10l-1.2-3.3L1.5 5.5l3.3-1.2L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
            Agent
          </button>

          <div style={{ width: 1, height: 22, background: 'rgba(246,241,251,0.10)', margin: '0 2px' }} />

          {/* Present — lime CTA */}
          <button onClick={handlePresent} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: QX.lime, color: '#1A0530', fontFamily: qxType.body, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: `all 160ms ${qxEase}`, boxShadow: '0 6px 22px rgba(212,255,63,0.30)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(212,255,63,0.42)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(212,255,63,0.30)'; }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><polygon points="2,1 10,5.5 2,10" fill="currentColor" /></svg>
            Present
          </button>

          {/* Overflow menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu((p) => !p); setShowThemePop(false); }} style={{ ...chromeBtn(showMenu), padding: '0 9px', width: 32 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="2.5" cy="6.5" r="1.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor" /><circle cx="10.5" cy="6.5" r="1.2" fill="currentColor" /></svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#170729', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 12, padding: 6, minWidth: 230, zIndex: 300, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}>
                <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>} label="Export as PDF" sub="Print current slide" onClick={handleExportPDF} />
                <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M4 4.5h3.5a1.5 1.5 0 010 3H4V4.5z" stroke="currentColor" strokeWidth="1.1" /></svg>} label="Download .pptx" sub="PowerPoint format" onClick={handleDownloadPPTX} />
                <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="4.5" cy="5.5" r="1" fill="currentColor" opacity=".6" /><path d="M1 9.5l3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>} label="Save slide as PNG" sub="Current slide only" onClick={handleDownloadPNG} />
                <div style={{ height: 1, background: 'rgba(246,241,251,0.08)', margin: '4px 0' }} />
                <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="3" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.3 7.3l4.5 2.5M4.3 5.7l4.5-2.5" stroke="currentColor" strokeWidth="1.1" /></svg>} label="Share link" sub="Copy shareable URL" onClick={handleShare} />
                <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="1" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="#170729" /></svg>} label="Duplicate deck" sub="Save a copy to library" onClick={handleDuplicate} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ MAIN AREA ══════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Slide stage */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 64px', position: 'relative' }}
          onClick={() => { setShowMenu(false); setShowThemePop(false); }}>

          <button onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }} disabled={currentIndex === 0} style={navStyle(currentIndex === 0, 'left')}
            onMouseEnter={(e) => { if (currentIndex !== 0) { e.currentTarget.style.background = 'rgba(246,241,251,0.10)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.30)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = currentIndex === 0 ? 'transparent' : 'rgba(246,241,251,0.04)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.14)'; }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          <div style={{ width: '100%', maxWidth: editPanelOpen ? 880 : 1040, position: 'relative', transition: `max-width 240ms ${qxEase}` }}>
            <div id="main-slide" key={transitionKey} style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(246,241,251,0.06)', position: 'relative', animation: `sgFadeIn 280ms ${qxEase}` }}>
              <SlideContent slide={slide} t={theme} layout={layout} align={align} bgImg={slideImages[currentIndex]} index={currentIndex} total={total} gridOn={showGrid || editPanelOpen} />
            </div>

            {/* Slide caption strip */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.40)' }}>Layout</span>
                <span style={{ fontFamily: qxType.body, fontSize: 12, color: 'rgba(246,241,251,0.75)' }}>{LAYOUTS.find((l) => l.key === layout)?.name || 'Standard'}</span>
                {slideThemeOverrides[currentIndex] && (
                  <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: QX.lime, padding: '2px 7px', border: `1px solid ${QX.lime}45`, borderRadius: 4 }}>Override</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(246,241,251,0.40)' }}>
                <span>← →  Navigate</span>
                <span>·</span>
                <span>G  Grid</span>
                <span>·</span>
                <span>F  Present</span>
              </div>
            </div>
          </div>

          <button onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }} disabled={currentIndex === total - 1} style={navStyle(currentIndex === total - 1, 'right')}
            onMouseEnter={(e) => { if (currentIndex !== total - 1) { e.currentTarget.style.background = 'rgba(246,241,251,0.10)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.30)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = currentIndex === total - 1 ? 'transparent' : 'rgba(246,241,251,0.04)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.14)'; }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* ══ Edit panel (right drawer) ══ */}
        {editPanelOpen && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(246,241,251,0.08)', background: '#0F031F', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: `sgSlideIn 220ms ${qxEase}` }}
            onClick={(e) => e.stopPropagation()}>

            <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.40)' }}>Slide {String(currentIndex + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: qxType.display, fontSize: 16, fontWeight: 600, color: '#F6F1FB', letterSpacing: '-0.012em', marginTop: 2 }}>Customise</div>
              </div>
              <button onClick={() => setEditPanelOpen(false)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(246,241,251,0.06)', color: 'rgba(246,241,251,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', padding: '14px 18px 0', gap: 4 }}>
              {['layout', 'image', 'style'].map((tab) => (
                <button key={tab} onClick={() => setEditTab(tab)} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: qxType.body, fontSize: 12, background: editTab === tab ? 'rgba(212,255,63,0.10)' : 'transparent', color: editTab === tab ? '#D4FF3F' : 'rgba(246,241,251,0.5)', fontWeight: editTab === tab ? 600 : 500, transition: `all 140ms ${qxEase}`, textTransform: 'capitalize' }}>{tab}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

              {/* LAYOUT TAB */}
              {editTab === 'layout' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginBottom: 9 }}>Alignment</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { val: 'left',   icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.4" rx=".7" fill="currentColor" /><rect x="1" y="5.5" width="8" height="1.4" rx=".7" fill="currentColor" opacity=".55" /><rect x="1" y="9" width="10" height="1.4" rx=".7" fill="currentColor" opacity=".55" /></svg> },
                        { val: 'center', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.4" rx=".7" fill="currentColor" /><rect x="3" y="5.5" width="8" height="1.4" rx=".7" fill="currentColor" opacity=".55" /><rect x="2" y="9" width="10" height="1.4" rx=".7" fill="currentColor" opacity=".55" /></svg> },
                        { val: 'right',  icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.4" rx=".7" fill="currentColor" /><rect x="5" y="5.5" width="8" height="1.4" rx=".7" fill="currentColor" opacity=".55" /><rect x="3" y="9" width="10" height="1.4" rx=".7" fill="currentColor" opacity=".55" /></svg> },
                      ].map((a) => (
                        <button key={a.val} onClick={() => applyAlign(a.val)} style={{ flex: 1, height: 34, borderRadius: 7, padding: 0, border: align === a.val ? '1px solid rgba(212,255,63,0.55)' : '1px solid rgba(246,241,251,0.08)', background: align === a.val ? 'rgba(212,255,63,0.10)' : 'rgba(246,241,251,0.02)', color: align === a.val ? '#D4FF3F' : 'rgba(246,241,251,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all 140ms ${qxEase}` }}>{a.icon}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginBottom: 9 }}>Layout</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                      {LAYOUTS.map((l) => {
                        const active = layout === l.key;
                        return (
                          <button key={l.key} onClick={() => applyLayout(l.key)} style={{ borderRadius: 8, padding: 0, cursor: 'pointer', border: active ? '1px solid rgba(212,255,63,0.55)' : '1px solid rgba(246,241,251,0.08)', background: active ? 'rgba(212,255,63,0.06)' : 'rgba(246,241,251,0.02)', transition: `all 140ms ${qxEase}`, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}
                            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = 'rgba(246,241,251,0.18)'; e.currentTarget.style.background = 'rgba(246,241,251,0.05)'; } }}
                            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = 'rgba(246,241,251,0.08)'; e.currentTarget.style.background = 'rgba(246,241,251,0.02)'; } }}>
                            <div style={{ width: '100%', aspectRatio: '16/9', background: theme.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {layoutSwatch(l.key, theme)}
                            </div>
                            <div style={{ padding: '7px 9px 8px', textAlign: 'left' }}>
                              <div style={{ fontFamily: qxType.body, fontSize: 11.5, fontWeight: 600, color: active ? '#D4FF3F' : 'rgba(246,241,251,0.85)' }}>{l.name}</div>
                              <div style={{ fontFamily: qxType.mono, fontSize: 9, color: 'rgba(246,241,251,0.40)', letterSpacing: '0.04em', marginTop: 2 }}>{l.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE TAB */}
              {editTab === 'image' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)' }}>Background photo</div>
                  <input value={imgQuery} onChange={(e) => handleImgSearch(e.target.value)} placeholder="Search — business, finance, city…"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(246,241,251,0.10)', background: 'rgba(246,241,251,0.04)', color: '#F6F1FB', fontFamily: qxType.body, fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }} />
                  {slideImages[currentIndex] && (
                    <button onClick={removeImage} style={{ padding: '8px', borderRadius: 7, border: '1px solid rgba(224,62,107,0.35)', background: 'rgba(224,62,107,0.06)', color: '#F472A6', fontFamily: qxType.body, fontSize: 11.5, cursor: 'pointer' }}>
                      Remove current image
                    </button>
                  )}
                  {imgResults.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {imgResults.map((img) => (
                        <button key={img.id} onClick={() => applyImage(img.src)} style={{ padding: 0, border: slideImages[currentIndex] === img.src ? '1px solid rgba(212,255,63,0.55)' : '1px solid rgba(246,241,251,0.08)', borderRadius: 7, overflow: 'hidden', cursor: 'pointer', aspectRatio: '16/9', background: '#0a0118' }}>
                          <img src={img.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </button>
                      ))}
                    </div>
                  )}
                  {!imgResults.length && !imgQuery && (
                    <div style={{ textAlign: 'center', color: 'rgba(246,241,251,0.30)', fontFamily: qxType.body, fontSize: 12, padding: '24px 12px', border: '1px dashed rgba(246,241,251,0.10)', borderRadius: 8 }}>
                      Search to find photos
                    </div>
                  )}
                </div>
              )}

              {/* STYLE TAB */}
              {editTab === 'style' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginBottom: 9 }}>Theme override</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {Object.entries(THEMES).map(([key, t]) => {
                        const active     = (slideThemeOverrides[currentIndex] || globalTheme) === key;
                        const isOverride = slideThemeOverrides[currentIndex] === key;
                        return (
                          <button key={key} title={t.name} onClick={() => applySlideTheme(key)} style={{ aspectRatio: '1', borderRadius: 8, background: t.gradient, padding: 0, cursor: 'pointer', border: active ? `2px solid ${isOverride ? '#D4FF3F' : '#F6F1FB'}` : '1px solid rgba(246,241,251,0.10)', transition: `all 140ms ${qxEase}` }} />
                        );
                      })}
                    </div>
                    {slideThemeOverrides[currentIndex] && (
                      <button onClick={() => setSlideThemeOverrides((p) => { const n = { ...p }; delete n[currentIndex]; return n; })}
                        style={{ width: '100%', marginTop: 10, padding: '7px', borderRadius: 7, border: '1px solid rgba(246,241,251,0.08)', background: 'transparent', color: 'rgba(246,241,251,0.55)', fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Reset to deck theme
                      </button>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.42)', marginBottom: 9 }}>Quick actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <PanelAction label="Export slide as PDF" onClick={handleExportPDF} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y=".5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3.5 4.5h5M3.5 7h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>} />
                      <PanelAction label="Save as PNG" onClick={handleDownloadPNG} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="4" cy="5" r=".9" fill="currentColor" opacity=".6" /><path d="M1 9l2.5-2.5L6 9l1.5-1.5L11 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
                      <PanelAction label="Share this deck" onClick={handleShare} icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="9.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="9.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3.8 6.7l4.2 2.6M3.8 5.3l4.2-2.6" stroke="currentColor" strokeWidth="1" /></svg>} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit with Agent — pinned bottom */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(246,241,251,0.08)', flexShrink: 0 }}>
              <button onClick={() => { setEditPanelOpen(false); openAgent(currentIndex); }}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: '1px solid rgba(212,255,63,0.4)', background: 'rgba(212,255,63,0.08)', color: '#D4FF3F', fontFamily: qxType.body, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `all 160ms ${qxEase}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,255,63,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(212,255,63,0.08)'; }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.2 3.3L11 5.5 7.7 6.7 6.5 10l-1.2-3.3L2 5.5l3.3-1.2L6.5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                Edit with Agent
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ FILMSTRIP — quieter, mono, hairline ══════════ */}
      <div style={{ borderTop: '1px solid rgba(246,241,251,0.08)', padding: '10px 24px 12px', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.30)', flexShrink: 0 }}>
        {localSlides.map((s, i) => {
          const t      = getTheme(i);
          const bgImg  = slideImages[i];
          const active = i === currentIndex;
          const isLight = t.swatch === '#E9D5FF';
          const tFg    = isLight ? '#1A0530' : '#F6F1FB';
          return (
            <button key={i} onClick={() => goTo(i)} style={{ flexShrink: 0, width: 124, padding: 0, cursor: 'pointer', position: 'relative', background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', gap: 5, transition: `all 160ms ${qxEase}`, opacity: active ? 1 : 0.78 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? '1' : '0.78'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 5, overflow: 'hidden', position: 'relative', background: bgImg ? `url(${bgImg}) center/cover no-repeat` : t.gradient, border: active ? `1px solid ${QX.lime}` : '1px solid rgba(246,241,251,0.08)', boxShadow: active ? `0 0 0 1px ${QX.lime}30` : 'none' }}>
                <div style={{ position: 'absolute', top: 5, left: 7, fontFamily: qxType.mono, fontSize: 7, letterSpacing: '0.2em', color: tFg, opacity: 0.7 }}>QX</div>
                <div style={{ position: 'absolute', top: 5, right: 7, fontFamily: qxType.mono, fontSize: 7, letterSpacing: '0.18em', color: tFg, opacity: 0.55 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ position: 'absolute', left: 7, right: 7, bottom: 6, fontFamily: qxType.display, fontWeight: 600, fontSize: 7, color: tFg, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.95 }}>{s.title}</div>
                <div style={{ position: 'absolute', left: 7, bottom: 3, width: 14, height: 1, background: t.accent, opacity: 0.7 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1px' }}>
                <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.18em', color: active ? QX.lime : 'rgba(246,241,251,0.42)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: qxType.body, fontSize: 10, color: 'rgba(246,241,251,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90, textAlign: 'right' }}>{s.title}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ══════════ TOAST ══════════ */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 170, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'rgba(52,199,123,0.14)' : toast.type === 'loading' ? 'rgba(212,255,63,0.10)' : 'rgba(23,7,41,0.94)', border: `1px solid ${toast.type === 'success' ? 'rgba(52,199,123,0.40)' : toast.type === 'loading' ? 'rgba(212,255,63,0.30)' : 'rgba(246,241,251,0.12)'}`, color: toast.type === 'success' ? '#6EE7B7' : toast.type === 'loading' ? '#D4FF3F' : '#F6F1FB', padding: '10px 18px', borderRadius: 24, fontFamily: qxType.body, fontSize: 12.5, zIndex: 500, backdropFilter: 'blur(12px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 10, animation: `sgFadeUp 220ms ${qxEase}` }}>
          {toast.type === 'loading' && <div style={{ width: 11, height: 11, border: '1.5px solid rgba(212,255,63,0.20)', borderTopColor: '#D4FF3F', borderRadius: '50%', animation: 'sgSpin 0.7s linear infinite', flexShrink: 0 }} />}
          {toast.msg}
        </div>
      )}

      {/* ══════════ AGENT MODAL ══════════ */}
      {agentOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `sgFadeIn 200ms ${qxEase}` }}
          onClick={() => setAgentOpen(false)}>
          <div style={{ width: 480, maxHeight: 600, background: '#0F031F', border: '1px solid rgba(246,241,251,0.10)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.7)', animation: `sgZoomIn 220ms ${qxEase}` }}
            onClick={(e) => e.stopPropagation()}>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(246,241,251,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${QX.lime}, ${QX.purple[300]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.2 3.3L11.5 5.5 8.2 6.7 7 10l-1.2-3.3L2.5 5.5l3.3-1.2L7 1z" stroke="#1A0530" strokeWidth="1.3" strokeLinejoin="round" fill="#1A0530" fillOpacity="0.15" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(246,241,251,0.45)' }}>Agent · Slide {agentSlideIndex + 1}</div>
                <div style={{ fontFamily: qxType.display, fontSize: 14, fontWeight: 600, color: '#F6F1FB', letterSpacing: '-0.012em', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{localSlides[agentSlideIndex]?.title}</div>
              </div>
              <button onClick={() => setAgentOpen(false)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(246,241,251,0.06)', color: 'rgba(246,241,251,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div ref={agentScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agentMessages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? QX.lime : 'rgba(246,241,251,0.06)', color: m.role === 'user' ? '#1A0530' : 'rgba(246,241,251,0.92)', fontFamily: qxType.body, fontSize: 13, lineHeight: 1.5, fontWeight: m.role === 'user' ? 500 : 400 }}>{m.text}</div>
                </div>
              ))}
              {agentThinking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(246,241,251,0.06)', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(246,241,251,0.50)', animation: `sgBounce 1s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(246,241,251,0.08)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea ref={agentInputRef} value={agentInput} onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAgentSend(); } }}
                placeholder="Make the title shorter, add a bullet about pricing…" rows={2}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(246,241,251,0.10)', background: 'rgba(246,241,251,0.04)', color: '#F6F1FB', fontFamily: qxType.body, fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.45 }} />
              <button onClick={handleAgentSend} disabled={!agentInput.trim() || agentThinking}
                style={{ width: 38, height: 38, borderRadius: 9, border: 'none', flexShrink: 0, background: agentInput.trim() && !agentThinking ? QX.lime : 'rgba(246,241,251,0.06)', color: agentInput.trim() && !agentThinking ? '#1A0530' : 'rgba(246,241,251,0.30)', cursor: agentInput.trim() && !agentThinking ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all 160ms ${qxEase}` }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sgSpin    { to { transform: rotate(360deg); } }
        @keyframes sgBounce  { 0%,80%,100% { transform:scale(0.55); opacity:.4 } 40% { transform:scale(1); opacity:1 } }
        @keyframes sgFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes sgFadeUp  { from { opacity:0; transform:translate(-50%, 8px) } to { opacity:1; transform:translate(-50%, 0) } }
        @keyframes sgSlideIn { from { transform: translateX(20px); opacity:0 } to { transform: translateX(0); opacity:1 } }
        @keyframes sgZoomIn  { from { transform: scale(0.96); opacity:0 } to { transform: scale(1); opacity:1 } }
        @media print {
          body * { visibility: hidden !important; }
          #main-slide, #main-slide * { visibility: visible !important; }
          #main-slide { position:fixed !important; inset:0 !important; width:100vw !important; height:100vh !important; max-width:none !important; border-radius:0 !important; box-shadow:none !important; }
        }
      `}</style>
    </div>
  );
};

// ─── helpers ─────────────────────────────────────────────────
const MenuItem = ({ icon, label, sub, onClick }) => (
  <button onClick={onClick} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(246,241,251,0.85)', fontFamily: qxType.body, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', transition: 'background 120ms' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,241,251,0.06)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    <span style={{ color: 'rgba(246,241,251,0.50)', flexShrink: 0 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 12.5, color: 'rgba(246,241,251,0.92)' }}>{label}</div>
      {sub && <div style={{ fontFamily: qxType.mono, fontSize: 9.5, color: 'rgba(246,241,251,0.40)', marginTop: 2, letterSpacing: '0.10em' }}>{sub}</div>}
    </div>
  </button>
);

const PanelAction = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(246,241,251,0.08)', background: 'rgba(246,241,251,0.02)', color: 'rgba(246,241,251,0.78)', fontFamily: qxType.body, fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 140ms' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,241,251,0.06)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.16)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(246,241,251,0.02)'; e.currentTarget.style.borderColor = 'rgba(246,241,251,0.08)'; }}>
    <span style={{ color: 'rgba(246,241,251,0.55)' }}>{icon}</span>
    {label}
  </button>
);

Object.assign(window, { SlideGenerator });
