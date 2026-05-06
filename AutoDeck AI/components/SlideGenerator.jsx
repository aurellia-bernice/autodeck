
// SlideGenerator — Gamma-style visual slideshow builder
const SlideGenerator = ({ slides: initialSlides, config, tweaks, onBack }) => {

  // ─── state ───────────────────────────────────────────────
  const [localSlides,       setLocalSlides]       = React.useState(() => initialSlides.map(s => ({...s})));
  const [currentIndex,      setCurrentIndex]      = React.useState(0);
  const [globalTheme,       setGlobalTheme]       = React.useState('purple');
  const [slideThemeOverrides,  setSlideThemeOverrides]  = React.useState({});
  const [slideLayoutOverrides, setSlideLayoutOverrides] = React.useState({});
  const [slideAlignments,   setSlideAlignments]   = React.useState({});
  const [slideImages,       setSlideImages]       = React.useState({});
  const [editPanelOpen,     setEditPanelOpen]     = React.useState(false);
  const [editTab,           setEditTab]           = React.useState('layout');
  const [imgQuery,          setImgQuery]          = React.useState('');
  const [imgResults,        setImgResults]        = React.useState([]);
  const [showMenu,          setShowMenu]          = React.useState(false);
  const [showSlideTheme,    setShowSlideTheme]    = React.useState(false);
  const [toast,             setToast]             = React.useState(null);
  const [slideHovered,      setSlideHovered]      = React.useState(false);

  // agent state
  const [agentOpen,         setAgentOpen]         = React.useState(false);
  const [agentSlideIndex,   setAgentSlideIndex]   = React.useState(0);
  const [agentMessages,     setAgentMessages]     = React.useState([]);
  const [agentInput,        setAgentInput]        = React.useState('');
  const [agentThinking,     setAgentThinking]     = React.useState(false);
  const agentScrollRef = React.useRef(null);
  const agentInputRef  = React.useRef(null);

  // ─── constants ───────────────────────────────────────────
  const THEMES = {
    purple:   { name:'Quidax',   swatch:'#7B2FBE', gradient:'linear-gradient(135deg,#4A148C 0%,#7B2FBE 55%,#D946A8 100%)', title:'#fff', text:'rgba(255,255,255,0.88)', accent:'#F9A8D4', d1:'rgba(255,255,255,0.07)', d2:'rgba(217,70,168,0.25)' },
    midnight: { name:'Midnight', swatch:'#312E81', gradient:'linear-gradient(135deg,#0F0A24 0%,#1E1B4B 55%,#312E81 100%)', title:'#fff', text:'rgba(255,255,255,0.82)', accent:'#A5B4FC', d1:'rgba(99,102,241,0.12)',  d2:'rgba(165,180,252,0.1)'  },
    soft:     { name:'Soft',     swatch:'#C4B5FD', gradient:'linear-gradient(135deg,#F5F3FF 0%,#EDE9FE 55%,#FCE7F3 100%)', title:'#1A0530', text:'#4A3560',           accent:'#7B2FBE', d1:'rgba(123,47,190,0.07)',  d2:'rgba(217,70,168,0.08)'  },
    ocean:    { name:'Ocean',    swatch:'#0369A1', gradient:'linear-gradient(135deg,#0C2B4E 0%,#0369A1 55%,#0891B2 100%)', title:'#fff', text:'rgba(255,255,255,0.88)', accent:'#7DD3FC', d1:'rgba(255,255,255,0.06)', d2:'rgba(14,165,233,0.22)'  },
    forest:   { name:'Forest',   swatch:'#065F46', gradient:'linear-gradient(135deg,#022C22 0%,#065F46 55%,#047857 100%)', title:'#fff', text:'rgba(255,255,255,0.85)', accent:'#6EE7B7', d1:'rgba(255,255,255,0.05)', d2:'rgba(52,211,153,0.18)'  },
    sunset:   { name:'Sunset',   swatch:'#C2410C', gradient:'linear-gradient(135deg,#431407 0%,#9A3412 50%,#EA580C 100%)', title:'#fff', text:'rgba(255,255,255,0.88)', accent:'#FED7AA', d1:'rgba(255,255,255,0.07)', d2:'rgba(251,146,60,0.22)'  },
    slate:    { name:'Slate',    swatch:'#334155', gradient:'linear-gradient(135deg,#0F172A 0%,#1E293B 55%,#334155 100%)', title:'#fff', text:'rgba(255,255,255,0.82)', accent:'#94A3B8', d1:'rgba(255,255,255,0.05)', d2:'rgba(148,163,184,0.1)'  },
    rose:     { name:'Rose',     swatch:'#BE123C', gradient:'linear-gradient(135deg,#4C0519 0%,#9F1239 55%,#BE123C 100%)', title:'#fff', text:'rgba(255,255,255,0.85)', accent:'#FCA5A5', d1:'rgba(255,255,255,0.07)', d2:'rgba(252,165,165,0.14)' },
  };

  const LAYOUTS = [
    { key:'standard', name:'Standard',  desc:'Title + bullets',         icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><rect x="2" y="3" width="18" height="2" rx="1" fill="currentColor" opacity=".9"/><rect x="2" y="7" width="8" height="1.2" rx=".6" fill="currentColor" opacity=".4"/><circle cx="2.8" cy="11.5" r=".8" fill="currentColor" opacity=".5"/><rect x="5" y="11" width="14" height="1.2" rx=".6" fill="currentColor" opacity=".5"/><circle cx="2.8" cy="14.5" r=".8" fill="currentColor" opacity=".5"/><rect x="5" y="14" width="10" height="1.2" rx=".6" fill="currentColor" opacity=".5"/><circle cx="2.8" cy="17.5" r=".8" fill="currentColor" opacity=".5"/><rect x="5" y="17" width="13" height="1.2" rx=".6" fill="currentColor" opacity=".5"/></svg> },
    { key:'centered', name:'Centered',  desc:'Everything centred',       icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><rect x="8" y="4" width="24" height="2" rx="1" fill="currentColor" opacity=".9"/><rect x="14" y="8" width="12" height="1.2" rx=".6" fill="currentColor" opacity=".4"/><rect x="5" y="12" width="30" height="1.2" rx=".6" fill="currentColor" opacity=".5"/><rect x="8" y="15" width="24" height="1.2" rx=".6" fill="currentColor" opacity=".5"/></svg> },
    { key:'split',    name:'Split',     desc:'Title left, list right',   icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><rect x="1" y="5" width="17" height="2.5" rx="1" fill="currentColor" opacity=".9"/><rect x="1" y="9" width="12" height="1.5" rx=".6" fill="currentColor" opacity=".4"/><line x1="21" y1="2" x2="21" y2="21" stroke="currentColor" strokeWidth=".8" opacity=".3"/><circle cx="23" cy="8" r=".8" fill="currentColor" opacity=".5"/><rect x="25" y="7.4" width="13" height="1.2" rx=".6" fill="currentColor" opacity=".5"/><circle cx="23" cy="12" r=".8" fill="currentColor" opacity=".5"/><rect x="25" y="11.4" width="10" height="1.2" rx=".6" fill="currentColor" opacity=".5"/><circle cx="23" cy="16" r=".8" fill="currentColor" opacity=".5"/><rect x="25" y="15.4" width="12" height="1.2" rx=".6" fill="currentColor" opacity=".5"/></svg> },
    { key:'bigTitle', name:'Bold',      desc:'Oversized headline',       icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><rect x="2" y="4" width="30" height="4" rx="1.5" fill="currentColor" opacity=".9"/><rect x="2" y="10" width="20" height="2.5" rx="1" fill="currentColor" opacity=".7"/><rect x="2" y="14" width="24" height="1.2" rx=".6" fill="currentColor" opacity=".35"/></svg> },
    { key:'quote',    name:'Quote',     desc:'Highlighted statement',    icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><text x="2" y="12" fontSize="14" fill="currentColor" opacity=".5" fontFamily="serif">"</text><rect x="11" y="5" width="27" height="1.8" rx=".9" fill="currentColor" opacity=".8"/><rect x="11" y="9" width="22" height="1.8" rx=".9" fill="currentColor" opacity=".8"/><rect x="11" y="13" width="19" height="1.8" rx=".9" fill="currentColor" opacity=".8"/><rect x="11" y="17" width="15" height="1.2" rx=".6" fill="currentColor" opacity=".4"/></svg> },
    { key:'minimal',  name:'Minimal',   desc:'Clean title only',         icon: <svg viewBox="0 0 40 23" width="40" height="23" fill="none"><rect x="5" y="8" width="30" height="3" rx="1.2" fill="currentColor" opacity=".9"/><rect x="14" y="13" width="12" height="1.5" rx=".6" fill="currentColor" opacity=".35"/></svg> },
  ];
  const TOP4_LAYOUTS = LAYOUTS.slice(0, 4);

  // ─── helpers ─────────────────────────────────────────────
  const getTheme  = (i) => THEMES[slideThemeOverrides[i] || globalTheme];
  const getLayout = (i) => slideLayoutOverrides[i] || 'standard';
  const getAlign  = (i) => slideAlignments[i] || 'left';
  const theme  = getTheme(currentIndex);
  const layout = getLayout(currentIndex);
  const align  = getAlign(currentIndex);
  const slide  = localSlides[currentIndex] || localSlides[0];
  const deckTitle = config?.inputText ? config.inputText.trim().split(/\s+/).slice(0,5).join(' ')+'…' : 'Presentation';

  const showToast = (msg, type='info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ─── image search (picsum seeds) ─────────────────────────
  const handleImgSearch = (q) => {
    setImgQuery(q);
    if (!q.trim()) { setImgResults([]); return; }
    setImgResults(Array.from({ length: 6 }, (_, i) => ({
      id: i,
      src:   `https://picsum.photos/seed/${encodeURIComponent(q)}${i+1}/800/450`,
      thumb: `https://picsum.photos/seed/${encodeURIComponent(q)}${i+1}/200/113`,
    })));
  };

  // ─── keyboard nav ────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setEditPanelOpen(false); setShowMenu(false); setShowSlideTheme(false); setAgentOpen(false); }
      if (editPanelOpen || agentOpen) return;
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(i+1, localSlides.length-1));
      if (e.key === 'ArrowLeft')  setCurrentIndex(i => Math.max(i-1, 0));
      if (e.key === 'f')          handlePresent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [localSlides.length, editPanelOpen, agentOpen]);

  // scroll agent chat to bottom when messages change
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

  const handleExportPDF = () => {
    setShowMenu(false);
    window.print();
  };

  const handleDownloadPPTX = () => {
    setShowMenu(false);
    showToast('Generating your .pptx file…', 'loading');
    setTimeout(() => showToast('✓ PPTX ready — check your downloads', 'success'), 2600);
  };

  const handleDownloadPNG = () => {
    setShowMenu(false);
    showToast('Saving slide as PNG…', 'loading');
    setTimeout(() => showToast('✓ Slide saved as PNG', 'success'), 1800);
  };

  const handleShare = () => {
    setShowMenu(false);
    const link = `https://autodeck.quidax.com/d/${Math.random().toString(36).slice(2,8)}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    showToast('🔗 Share link copied to clipboard!', 'success');
  };

  const handleDuplicate = () => {
    setShowMenu(false);
    showToast('Deck duplicated to your library', 'success');
  };

  const applyLayout = (key) => setSlideLayoutOverrides(p => ({ ...p, [currentIndex]: key }));
  const applyAlign  = (val) => setSlideAlignments(p => ({ ...p, [currentIndex]: val }));

  const applyImage = (url) => {
    setSlideImages(p => ({ ...p, [currentIndex]: url }));
    setEditTab('layout');
  };

  const removeImage = () => {
    setSlideImages(p => { const n = {...p}; delete n[currentIndex]; return n; });
  };

  const applySlideTheme = (key) => {
    setSlideThemeOverrides(p => {
      const n = {...p};
      if (n[currentIndex] === key) delete n[currentIndex]; else n[currentIndex] = key;
      return n;
    });
  };

  // ─── agent logic ─────────────────────────────────────────
  const openAgent = (idx) => {
    setAgentSlideIndex(idx);
    setAgentMessages([{ role:'assistant', text:`Hi! I'm editing slide ${idx+1}: "${localSlides[idx]?.title}". What changes would you like?` }]);
    setAgentInput('');
    setAgentOpen(true);
    setTimeout(() => agentInputRef.current?.focus(), 80);
  };

  const simulateAgentResponse = (userText, idx) => {
    const t = userText.toLowerCase();
    setLocalSlides(prev => {
      const next = prev.map(s => ({...s, bullets: [...s.bullets]}));
      const s = next[idx];

      if (t.includes('title') || t.includes('heading')) {
        const words = userText.replace(/title|heading|change|make|to|the|be/gi,'').trim();
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
        const newPoint = userText.replace(/add\s+(a\s+)?(bullet|point)\s*(about|on|for|:)?/i,'').trim();
        if (newPoint.length > 2) s.bullets.push(newPoint.charAt(0).toUpperCase() + newPoint.slice(1));
        else s.bullets.push('New key point to elaborate');
        return next;
      }
      if (t.includes('remove') && (t.includes('bullet') || t.includes('point') || t.includes('last'))) {
        if (s.bullets.length > 1) s.bullets.pop();
        return next;
      }
      if (t.includes('rewrite') || t.includes('rephrase') || t.includes('reword')) {
        s.bullets = s.bullets.map(b => b.split(' ').reverse().join(' ').charAt(0).toUpperCase() + b.split(' ').reverse().join(' ').slice(1));
        return next;
      }
      return next;
    });

    const replies = [
      `Done! I've updated slide ${idx+1} based on your request.`,
      `Slide ${idx+1} has been edited. Want to refine anything else?`,
      `Updated! The change is live on slide ${idx+1}.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  };

  const handleAgentSend = () => {
    const text = agentInput.trim();
    if (!text || agentThinking) return;
    const userMsg = { role:'user', text };
    setAgentMessages(p => [...p, userMsg]);
    setAgentInput('');
    setAgentThinking(true);
    setTimeout(() => {
      const reply = simulateAgentResponse(text, agentSlideIndex);
      setAgentMessages(p => [...p, { role:'assistant', text: reply }]);
      setAgentThinking(false);
      setTimeout(() => agentInputRef.current?.focus(), 30);
    }, 900 + Math.random() * 600);
  };

  // ─── decorative shapes ───────────────────────────────────
  const SlideDecor = ({ t }) => (
    <>
      <div style={{ position:'absolute', top:'-70px', right:'-70px', width:'260px', height:'260px', borderRadius:'50%', background:t.d1, border:`1px solid ${t.d2}`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-50px', left:'-50px', width:'190px', height:'190px', borderRadius:'50%', background:t.d2, opacity:.5, pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'50%', right:'7%', width:'68px', height:'68px', borderRadius:'50%', border:`1.5px solid ${t.d2}`, opacity:.7, transform:'translateY(-50%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:t.accent, opacity:.55, pointerEvents:'none' }} />
    </>
  );

  // ─── layout renderer ─────────────────────────────────────
  const SlideContent = ({ slide, t, layout, align, bgImg, index, total }) => {
    const hasImg = !!bgImg;
    const tc  = hasImg ? '#fff' : t.title;
    const txc = hasImg ? 'rgba(255,255,255,0.88)' : t.text;
    const ac  = hasImg ? 'rgba(255,255,255,0.75)' : t.accent;
    const ta  = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const ai  = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

    const Brand = () => (
      <div style={{ position:'absolute', top:'20px', left:'26px', display:'flex', alignItems:'center', gap:'6px', zIndex:2 }}>
        <div style={{ width:'16px', height:'16px', borderRadius:'4px', background:ac, opacity:.85 }} />
        <span style={{ color:tc, fontSize:'9px', fontFamily:'"Arial Black",sans-serif', letterSpacing:'2px', opacity:.6 }}>QUIDAX</span>
      </div>
    );

    const SlideNum = () => (
      <div style={{ position:'absolute', top:'20px', right:'26px', color:tc, opacity:.38, fontSize:'10px', fontFamily:'Calibri,sans-serif', letterSpacing:'1px', zIndex:2 }}>
        {String(index+1).padStart(2,'0')}
      </div>
    );

    const Footer = () => (
      <div style={{ position:'absolute', bottom:'14px', left:'26px', right:'26px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:2 }}>
        <div style={{ width:'28px', height:'2px', background:ac, opacity:.4, borderRadius:'1px' }} />
        <span style={{ color:tc, opacity:.28, fontSize:'9px', letterSpacing:'.5px' }}>{index+1} / {total}</span>
      </div>
    );

    const container = { position:'relative', width:'100%', height:'100%', overflow:'hidden',
      background: hasImg ? `url(${bgImg}) center/cover no-repeat` : t.gradient };

    if (layout === 'centered') return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,0,0,0.62),rgba(0,0,0,0.32))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px', textAlign:'center', zIndex:2 }}>
          <h2 style={{ fontFamily:'"Arial Black",sans-serif', fontSize:'clamp(18px,3.6vw,34px)', color:tc, marginBottom:'10px', letterSpacing:'-0.5px', lineHeight:1.1 }}>{slide.title}</h2>
          <div style={{ width:'38px', height:'3px', background:ac, borderRadius:'2px', marginBottom:'14px' }} />
          {slide.bullets.slice(0,3).map((b,j) => <div key={j} style={{ color:txc, fontSize:'clamp(11px,1.7vw,14px)', marginBottom:'6px', lineHeight:1.5 }}>{b}</div>)}
        </div>
        <Footer/>
      </div>
    );

    if (layout === 'split') return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,0,0,0.65),rgba(0,0,0,0.35))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', top:'44px', left:0, right:0, bottom:'36px', display:'grid', gridTemplateColumns:'1fr 1fr', zIndex:2 }}>
          <div style={{ padding:'16px 20px 16px 26px', display:'flex', flexDirection:'column', justifyContent:'center', borderRight:`1px solid ${hasImg?'rgba(255,255,255,0.18)':t.d2}` }}>
            <h2 style={{ fontFamily:'"Arial Black",sans-serif', fontSize:'clamp(13px,2.6vw,24px)', color:tc, lineHeight:1.1, marginBottom:'10px', textAlign:ta }}>{slide.title}</h2>
            <div style={{ width:'30px', height:'3px', background:ac, borderRadius:'2px', marginLeft: align==='right'?'auto': align==='center'?'auto':'0', marginRight: align==='right'?'0':align==='center'?'auto':'0' }} />
          </div>
          <div style={{ padding:'16px 26px 16px 20px', display:'flex', flexDirection:'column', justifyContent:'center', gap:'9px' }}>
            {slide.bullets.map((b,j) => (
              <div key={j} style={{ display:'flex', alignItems:'flex-start', gap:'8px', justifyContent:ai }}>
                <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:ac, flexShrink:0, marginTop:'5px' }} />
                <span style={{ color:txc, fontSize:'clamp(9px,1.4vw,13px)', lineHeight:1.5, textAlign:ta }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <Footer/>
      </div>
    );

    if (layout === 'bigTitle') return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,0,0,0.7),rgba(0,0,0,0.3))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'center', padding:'40px 44px 56px', alignItems:ai, zIndex:2 }}>
          <h2 style={{ fontFamily:'"Arial Black",sans-serif', fontSize:'clamp(22px,5vw,50px)', color:tc, letterSpacing:'-1px', lineHeight:1.05, marginBottom:'14px', textAlign:ta }}>{slide.title}</h2>
          <div style={{ width:'52px', height:'4px', background:ac, borderRadius:'2px', marginBottom:'14px' }} />
          {slide.bullets[0] && <div style={{ color:txc, fontSize:'clamp(11px,1.6vw,15px)', opacity:.9, textAlign:ta }}>{slide.bullets[0]}</div>}
        </div>
        <Footer/>
      </div>
    );

    if (layout === 'quote') return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,rgba(0,0,0,0.7),rgba(0,0,0,0.4))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'44px', textAlign:'center', zIndex:2 }}>
          <div style={{ fontSize:'clamp(40px,7vw,72px)', color:ac, fontFamily:'Georgia,serif', lineHeight:.7, marginBottom:'10px', opacity:.7 }}>"</div>
          <div style={{ color:tc, fontSize:'clamp(13px,2.4vw,20px)', fontFamily:'Calibri,sans-serif', fontStyle:'italic', lineHeight:1.55, maxWidth:'82%' }}>{slide.bullets[0] || slide.title}</div>
          <div style={{ marginTop:'18px', color:txc, fontSize:'clamp(9px,1.3vw,12px)', letterSpacing:'1.5px', textTransform:'uppercase', opacity:.7 }}>{slide.title}</div>
        </div>
        <Footer/>
      </div>
    );

    if (layout === 'minimal') return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,0,0,0.6),rgba(0,0,0,0.25))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent: align==='center'?'center':align==='right'?'flex-end':'flex-start', zIndex:2 }}>
          <div style={{ textAlign:ta, padding:'0 48px' }}>
            <h2 style={{ fontFamily:'"Arial Black",sans-serif', fontSize:'clamp(20px,4.2vw,42px)', color:tc, letterSpacing:'-0.6px' }}>{slide.title}</h2>
            <div style={{ width:'48px', height:'3px', background:ac, borderRadius:'2px', margin:`16px ${align==='center'?'auto':align==='right'?'0 auto':'0'} 0` }} />
          </div>
        </div>
        <Footer/>
      </div>
    );

    // standard (default)
    return (
      <div style={container}>
        {hasImg && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,0,0,0.65),rgba(0,0,0,0.3))', zIndex:1 }} />}
        {!hasImg && <SlideDecor t={t} />}
        <Brand/><SlideNum/>
        <div style={{ position:'absolute', top:'54px', left:'26px', right:'26px', bottom:'38px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:ai, zIndex:2 }}>
          <h2 style={{ fontFamily:'"Arial Black",sans-serif', fontSize:'clamp(15px,3vw,28px)', color:tc, margin:'0 0 8px', letterSpacing:'-0.4px', lineHeight:1.1, textAlign:ta, width:'100%' }}>{slide.title}</h2>
          <div style={{ width:'40px', height:'3px', background:ac, borderRadius:'2px', marginBottom:'15px', marginLeft: align==='right'?'auto':align==='center'?'auto':'0', marginRight: align==='right'?'0':align==='center'?'auto':'0' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:'9px', width:'100%' }}>
            {slide.bullets.map((b,j) => (
              <div key={j} style={{ display:'flex', alignItems:'flex-start', gap:'9px', justifyContent:ai }}>
                <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:ac, flexShrink:0, marginTop:'5px' }} />
                <span style={{ color:txc, fontSize:'clamp(10px,1.7vw,14px)', fontFamily:'Calibri,sans-serif', lineHeight:1.5, textAlign:ta }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <Footer/>
      </div>
    );
  };

  // ─── nav button style ────────────────────────────────────
  const navStyle = (disabled) => ({
    width:'40px', height:'40px', borderRadius:'50%', padding:0,
    border:'1.5px solid rgba(255,255,255,0.15)',
    background: disabled ? 'transparent' : 'rgba(255,255,255,0.06)',
    color: disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.75)',
    cursor: disabled ? 'default' : 'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', position:'absolute',
  });

  // ─── JSX ─────────────────────────────────────────────────
  return (
    <div style={{ height:'100vh', background:'#100220', display:'flex', flexDirection:'column', fontFamily:'Calibri,sans-serif', userSelect:'none', overflow:'hidden' }}
      onClick={() => { setShowMenu(false); setShowSlideTheme(false); }}>

      {/* ══════════ TOP TOOLBAR ══════════ */}
      <div style={{ padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'10px', background:'rgba(0,0,0,0.3)', flexShrink:0 }}
        onClick={e => e.stopPropagation()}>

        {/* Back */}
        <button onClick={onBack} style={{ padding:'6px 13px', borderRadius:'8px', border:'1.5px solid rgba(255,255,255,0.13)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.3)';e.currentTarget.style.color='#fff';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.13)';e.currentTarget.style.color='rgba(255,255,255,0.6)';}}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5 8 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>

        {/* Deck title */}
        <div style={{ flex:1, color:'rgba(255,255,255,0.38)', fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {deckTitle} · {localSlides.length} slides
        </div>

        {/* Global theme swatches */}
        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:'11px' }}>Theme</span>
          <div style={{ display:'flex', gap:'4px' }}>
            {Object.entries(THEMES).map(([key,t]) => (
              <button key={key} title={t.name} onClick={() => setGlobalTheme(key)} style={{
                width:'19px', height:'19px', borderRadius:'50%', background:t.swatch, padding:0, cursor:'pointer',
                border: globalTheme===key ? '2px solid #fff' : '2px solid transparent',
                boxShadow: globalTheme===key ? '0 0 0 1px rgba(255,255,255,0.22)' : 'none', transition:'all 0.12s',
              }} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:'1px', height:'24px', background:'rgba(255,255,255,0.1)' }} />

        {/* Present button */}
        <button onClick={handlePresent} style={{ padding:'6px 13px', borderRadius:'8px', border:'1.5px solid rgba(255,255,255,0.13)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.3)';e.currentTarget.style.color='#fff';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.13)';e.currentTarget.style.color='rgba(255,255,255,0.6)';}}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><polygon points="2,1 12,6.5 2,12" fill="currentColor"/></svg>
          Present
        </button>

        {/* Hamburger menu */}
        <div style={{ position:'relative' }}>
          <button onClick={e=>{e.stopPropagation();setShowMenu(p=>!p);}} style={{
            width:'36px', height:'36px', borderRadius:'8px', border:'1.5px solid rgba(255,255,255,0.13)',
            background: showMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
            color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:'3.5px', transition:'all 0.15s', padding:0,
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.28)';e.currentTarget.style.color='#fff';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.13)';e.currentTarget.style.color='rgba(255,255,255,0.7)';}}>
            {[0,1,2].map(i=><div key={i} style={{ width:'14px', height:'1.5px', background:'currentColor', borderRadius:'1px' }} />)}
          </button>

          {showMenu && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'#1A0535', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'6px', minWidth:'210px', zIndex:300, boxShadow:'0 12px 40px rgba(0,0,0,0.7)' }}
              onClick={e=>e.stopPropagation()}>
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><polygon points="2,1 12,6.5 2,12" fill="currentColor"/></svg>} label="Present" sub="Fullscreen (F)" onClick={handlePresent}/>
              <div style={{ height:'1px', background:'rgba(255,255,255,0.08)', margin:'4px 0' }} />
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>} label="Export as PDF" sub="Current slide via print" onClick={handleExportPDF}/>
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 4.5h3.5a1.5 1.5 0 010 3H4V4.5z" stroke="currentColor" strokeWidth="1.1"/></svg>} label="Download PPTX" sub="PowerPoint format" onClick={handleDownloadPPTX}/>
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="5.5" r="1" fill="currentColor" opacity=".6"/><path d="M1 9.5l3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>} label="Download PNG" sub="Save current slide as image" onClick={handleDownloadPNG}/>
              <div style={{ height:'1px', background:'rgba(255,255,255,0.08)', margin:'4px 0' }} />
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="3" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.3 7.3l4.5 2.5M4.3 5.7l4.5-2.5" stroke="currentColor" strokeWidth="1.1"/></svg>} label="Share link" sub="Copy shareable URL" onClick={handleShare}/>
              <MenuItem icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="#1A0535"/></svg>} label="Duplicate deck" sub="Save a copy to library" onClick={handleDuplicate}/>
            </div>
          )}
        </div>
      </div>

      {/* ══════════ MAIN AREA ══════════ */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Slide area */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 56px', position:'relative', transition:'padding-right 0.25s' }}
          onClick={() => { setShowMenu(false); setShowSlideTheme(false); }}>

          {/* Prev arrow */}
          <button
            onClick={e=>{e.stopPropagation();setCurrentIndex(i=>Math.max(i-1,0));}}
            disabled={currentIndex===0}
            style={{...navStyle(currentIndex===0), left:'10px'}}
            onMouseEnter={e=>{if(currentIndex!==0){e.currentTarget.style.background='rgba(255,255,255,0.1)';e.currentTarget.style.borderColor='rgba(255,255,255,0.3)';}}}
            onMouseLeave={e=>{e.currentTarget.style.background=currentIndex===0?'transparent':'rgba(255,255,255,0.06)';e.currentTarget.style.borderColor='rgba(255,255,255,0.15)';}}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3L5 7.5l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {/* The slide */}
          <div style={{ width:'100%', maxWidth:'880px', position:'relative' }}
            onMouseEnter={()=>setSlideHovered(true)}
            onMouseLeave={()=>setSlideHovered(false)}>
            <div id="main-slide" style={{ width:'100%', aspectRatio:'16/9', borderRadius:'14px', overflow:'hidden', boxShadow:'0 20px 72px rgba(0,0,0,0.65)', position:'relative' }}>
              <SlideContent slide={slide} t={theme} layout={layout} align={align} bgImg={slideImages[currentIndex]} index={currentIndex} total={localSlides.length}/>
            </div>

            {/* Hover overlay — two pill buttons at bottom centre */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex', justifyContent:'center', gap:'8px', padding:'12px', opacity: slideHovered ? 1 : 0, transition:'opacity 0.2s', pointerEvents: slideHovered ? 'auto' : 'none' }}>
              {/* Customise */}
              <button
                onClick={e=>{e.stopPropagation(); setEditPanelOpen(true); setEditTab('layout');}}
                style={{ padding:'7px 16px', borderRadius:'20px', border:'1.5px solid rgba(255,255,255,0.25)', background:'rgba(10,1,32,0.78)', backdropFilter:'blur(8px)', color:'#fff', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', letterSpacing:'.2px', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(123,47,190,0.55)';e.currentTarget.style.borderColor='rgba(168,85,247,0.6)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(10,1,32,0.78)';e.currentTarget.style.borderColor='rgba(255,255,255,0.25)';}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5a1.5 1.5 0 012.12 2.12L3.5 10.75 1 11.5l.75-3L8.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Customise
              </button>
              {/* Edit with Agent */}
              <button
                onClick={e=>{e.stopPropagation(); openAgent(currentIndex);}}
                style={{ padding:'7px 16px', borderRadius:'20px', border:'1.5px solid rgba(217,70,168,0.5)', background:'rgba(10,1,32,0.78)', backdropFilter:'blur(8px)', color:'#F9A8D4', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', letterSpacing:'.2px', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(217,70,168,0.28)';e.currentTarget.style.borderColor='rgba(217,70,168,0.8)';e.currentTarget.style.color='#fff';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(10,1,32,0.78)';e.currentTarget.style.borderColor='rgba(217,70,168,0.5)';e.currentTarget.style.color='#F9A8D4';}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1 2.8L9.8 4.8 7 5.8 6 8.5 5 5.8 2.2 4.8 5 3.8 6 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/><path d="M10 8l.5 1.2 1.2.5-1.2.5L10 11.4l-.5-1.2L8.3 9.7l1.2-.5L10 8z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
                Edit with Agent
              </button>
            </div>
          </div>

          {/* Next arrow */}
          <button
            onClick={e=>{e.stopPropagation();setCurrentIndex(i=>Math.min(i+1,localSlides.length-1));}}
            disabled={currentIndex===localSlides.length-1}
            style={{...navStyle(currentIndex===localSlides.length-1), right:'10px'}}
            onMouseEnter={e=>{if(currentIndex!==localSlides.length-1){e.currentTarget.style.background='rgba(255,255,255,0.1)';e.currentTarget.style.borderColor='rgba(255,255,255,0.3)';}}}
            onMouseLeave={e=>{e.currentTarget.style.background=currentIndex===localSlides.length-1?'transparent':'rgba(255,255,255,0.06)';e.currentTarget.style.borderColor='rgba(255,255,255,0.15)';}}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M5.5 3L10 7.5 5.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* ══ Edit panel (right drawer) ══ */}
        {editPanelOpen && (
          <div style={{ width:'272px', flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.08)', background:'#130228', display:'flex', flexDirection:'column', overflow:'hidden' }}
            onClick={e=>e.stopPropagation()}>

            {/* Panel header */}
            <div style={{ padding:'14px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ color:'#fff', fontSize:'13px', fontWeight:'700', fontFamily:'"Arial Black",sans-serif', letterSpacing:'.3px' }}>Customise</span>
              <button onClick={()=>setEditPanelOpen(false)} style={{ width:'26px', height:'26px', borderRadius:'6px', border:'none', background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', padding:'10px 16px 0', gap:'2px' }}>
              {['layout','image','style'].map(tab => (
                <button key={tab} onClick={()=>setEditTab(tab)} style={{
                  flex:1, padding:'7px 0', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', fontFamily:'Calibri,sans-serif',
                  background: editTab===tab ? 'rgba(123,47,190,0.22)' : 'transparent',
                  color: editTab===tab ? '#C084FC' : 'rgba(255,255,255,0.45)',
                  fontWeight: editTab===tab ? '700' : '400',
                  transition:'all 0.15s', textTransform:'capitalize',
                }}>{tab}</button>
              ))}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>

              {/* ── LAYOUT TAB ── */}
              {editTab==='layout' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* Alignment row */}
                  <div>
                    <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px', margin:'0 0 8px' }}>Content alignment</p>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {[
                        { val:'left',   icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="5.5" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6"/><rect x="1" y="9" width="10" height="1.5" rx=".75" fill="currentColor" opacity=".6"/></svg> },
                        { val:'center', icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="3" y="5.5" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6"/><rect x="2" y="9" width="10" height="1.5" rx=".75" fill="currentColor" opacity=".6"/></svg> },
                        { val:'right',  icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="5" y="5.5" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6"/><rect x="3" y="9" width="10" height="1.5" rx=".75" fill="currentColor" opacity=".6"/></svg> },
                      ].map(a => (
                        <button key={a.val} onClick={()=>applyAlign(a.val)} style={{
                          flex:1, height:'36px', borderRadius:'8px', border: align===a.val ? '2px solid #A855F7' : '2px solid rgba(255,255,255,0.1)',
                          background: align===a.val ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.03)',
                          color: align===a.val ? '#C084FC' : 'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                        }}>{a.icon}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ height:'1px', background:'rgba(255,255,255,0.07)' }} />

                  {/* Top 4 layouts */}
                  <div>
                    <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px', margin:'0 0 8px' }}>Slide layout</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      {TOP4_LAYOUTS.map(l => {
                        const active = layout===l.key;
                        return (
                          <button key={l.key} onClick={()=>applyLayout(l.key)} style={{
                            borderRadius:'10px', border: active ? '2px solid #A855F7' : '2px solid rgba(255,255,255,0.1)',
                            background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                            cursor:'pointer', padding:'10px 8px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'7px',
                            transition:'all 0.15s',
                          }}
                            onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor='rgba(255,255,255,0.22)';e.currentTarget.style.background='rgba(255,255,255,0.06)';}}}
                            onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}}
                          >
                            <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:'6px', background:theme.gradient, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', color: active?'#fff':'rgba(255,255,255,0.7)', position:'relative' }}>
                              {l.icon}
                            </div>
                            <div style={{ textAlign:'center' }}>
                              <div style={{ color: active?'#C084FC':'rgba(255,255,255,0.75)', fontSize:'11px', fontWeight:'600' }}>{l.name}</div>
                              <div style={{ color:'rgba(255,255,255,0.3)', fontSize:'9.5px', marginTop:'1px' }}>{l.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── IMAGE TAB ── */}
              {editTab==='image' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px', margin:0 }}>Search for a background photo</p>
                  <input
                    value={imgQuery}
                    onChange={e=>handleImgSearch(e.target.value)}
                    placeholder="e.g. business, finance, city…"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'12px', outline:'none', boxSizing:'border-box' }}
                  />
                  {slideImages[currentIndex] && (
                    <button onClick={removeImage} style={{ padding:'6px', borderRadius:'7px', border:'1px solid rgba(217,70,168,0.3)', background:'rgba(217,70,168,0.07)', color:'#D946A8', fontSize:'11px', cursor:'pointer' }}>
                      ✕ Remove current image
                    </button>
                  )}
                  {imgResults.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                      {imgResults.map(img => (
                        <button key={img.id} onClick={()=>applyImage(img.src)} style={{ padding:0, border: slideImages[currentIndex]===img.src ? '2px solid #A855F7' : '2px solid rgba(255,255,255,0.08)', borderRadius:'7px', overflow:'hidden', cursor:'pointer', aspectRatio:'16/9', background:'#0a0118' }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.3)';}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=slideImages[currentIndex]===img.src?'#A855F7':'rgba(255,255,255,0.08)';}}>
                          <img src={img.thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e=>{e.currentTarget.style.display='none';}} />
                        </button>
                      ))}
                    </div>
                  )}
                  {!imgResults.length && !imgQuery && (
                    <div style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'12px', padding:'20px 0' }}>
                      Search to find photos from Unsplash
                    </div>
                  )}
                </div>
              )}

              {/* ── STYLE TAB ── */}
              {editTab==='style' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <div>
                    <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px', margin:'0 0 10px' }}>Colour theme for this slide</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'7px' }}>
                      {Object.entries(THEMES).map(([key,t]) => {
                        const active = (slideThemeOverrides[currentIndex]||globalTheme)===key;
                        return (
                          <button key={key} title={t.name} onClick={()=>applySlideTheme(key)} style={{
                            height:'40px', borderRadius:'8px', background:t.gradient, padding:0, cursor:'pointer',
                            border: active ? '2.5px solid #fff' : '2px solid transparent',
                            boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.2)' : 'none',
                            transition:'all 0.12s',
                          }} />
                        );
                      })}
                    </div>
                    {slideThemeOverrides[currentIndex] && (
                      <button onClick={()=>{ setSlideThemeOverrides(p=>{const n={...p};delete n[currentIndex];return n;}); }} style={{ width:'100%', marginTop:'8px', padding:'5px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.4)', fontSize:'11px', cursor:'pointer' }}>
                        Reset to global theme
                      </button>
                    )}
                  </div>

                  <div style={{ height:'1px', background:'rgba(255,255,255,0.07)' }} />

                  <div>
                    <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px', margin:'0 0 10px' }}>Quick actions</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      <button onClick={handleExportPDF} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.65)', fontSize:'12px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:'8px' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y=".5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4.5h5M3.5 7h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                        Export slide as PDF
                      </button>
                      <button onClick={handleShare} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.65)', fontSize:'12px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:'8px' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="9.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="9.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.8 6.7l4.2 2.6M3.8 5.3l4.2-2.6" stroke="currentColor" strokeWidth="1"/></svg>
                        Share this deck
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit with Agent — pinned to panel bottom */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
              <button
                onClick={()=>{ setEditPanelOpen(false); openAgent(currentIndex); }}
                style={{ width:'100%', padding:'10px 14px', borderRadius:'10px', border:'1.5px solid rgba(217,70,168,0.4)', background:'linear-gradient(135deg,rgba(123,47,190,0.18),rgba(217,70,168,0.18))', color:'#F9A8D4', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', fontFamily:'Calibri,sans-serif', fontWeight:'600', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(123,47,190,0.4),rgba(217,70,168,0.35))';e.currentTarget.style.borderColor='rgba(217,70,168,0.75)';e.currentTarget.style.color='#fff';}}
                onMouseLeave={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(123,47,190,0.18),rgba(217,70,168,0.18))';e.currentTarget.style.borderColor='rgba(217,70,168,0.4)';e.currentTarget.style.color='#F9A8D4';}}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.2 3.3L11.5 5.5 8.2 6.7 7 10l-1.2-3.3L2.5 5.5l3.3-1.2L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M11.5 9l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L9.5 11l1.4-.6.6-1.4z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
                Edit with Agent
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ THUMBNAIL STRIP ══════════ */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'9px 18px', overflowX:'auto', display:'flex', gap:'7px', background:'rgba(0,0,0,0.3)', flexShrink:0 }}>
        {localSlides.map((s,i) => {
          const t = getTheme(i);
          const bgImg = slideImages[i];
          const active = i === currentIndex;
          return (
            <button key={i} onClick={()=>setCurrentIndex(i)} style={{
              flexShrink:0, width:'94px', height:'53px', borderRadius:'6px', padding:0, cursor:'pointer',
              position:'relative', overflow:'hidden',
              border: active ? '2px solid #A855F7' : '2px solid rgba(255,255,255,0.07)',
              background: bgImg ? `url(${bgImg}) center/cover no-repeat` : t.gradient,
              boxShadow: active ? '0 0 0 1px rgba(168,85,247,0.3)' : 'none',
              transition:'border-color 0.15s',
            }}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor='rgba(255,255,255,0.2)';}}
              onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';}}>
              {bgImg && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)' }} />}
              {!bgImg && <div style={{ position:'absolute', top:'-13px', right:'-13px', width:'44px', height:'44px', borderRadius:'50%', background:t.d1, pointerEvents:'none' }} />}
              {active && <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'#A855F7' }} />}
              <div style={{ position:'absolute', bottom:'4px', left:'5px', right:'18px', color:'#fff', fontSize:'6px', fontFamily:'"Arial Black",sans-serif', opacity:.85, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', zIndex:1 }}>{s.title}</div>
              <div style={{ position:'absolute', top:'4px', right:'4px', color:'#fff', opacity:.4, fontSize:'6px', zIndex:1 }}>{String(i+1).padStart(2,'0')}</div>
            </button>
          );
        })}
      </div>

      {/* ══════════ TOAST ══════════ */}
      {toast && (
        <div style={{ position:'fixed', bottom:'28px', left:'50%', transform:'translateX(-50%)', background: toast.type==='success'?'rgba(52,211,153,0.15)':toast.type==='loading'?'rgba(123,47,190,0.2)':'rgba(30,6,53,0.9)', border:`1px solid ${toast.type==='success'?'rgba(52,211,153,0.35)':toast.type==='loading'?'rgba(123,47,190,0.4)':'rgba(255,255,255,0.12)'}`, color: toast.type==='success'?'#6EE7B7':'#e0d0ff', padding:'10px 20px', borderRadius:'24px', fontSize:'13px', zIndex:500, whiteSpace:'nowrap', backdropFilter:'blur(10px)', boxShadow:'0 4px 24px rgba(0,0,0,0.5)', display:'flex', alignItems:'center', gap:'8px' }}>
          {toast.type==='loading' && <div style={{ width:'12px', height:'12px', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#A855F7', borderRadius:'50%', animation:'sgSpin 0.7s linear infinite', flexShrink:0 }} />}
          {toast.msg}
        </div>
      )}

      {/* ══════════ AGENT CHAT MODAL ══════════ */}
      {agentOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setAgentOpen(false)}>
          <div style={{ width:'460px', maxHeight:'560px', background:'#120228', border:'1px solid rgba(217,70,168,0.25)', borderRadius:'18px', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.8)' }}
            onClick={e=>e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:'linear-gradient(135deg,#7B2FBE,#D946A8)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.2 3.3L11.5 5.5 8.2 6.7 7 10l-1.2-3.3L2.5 5.5l3.3-1.2L7 1z" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/><path d="M11.5 9l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L9.5 11l1.4-.6.6-1.4z" stroke="white" strokeWidth="1" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fff', fontSize:'13px', fontWeight:'700' }}>Edit with Agent</div>
                <div style={{ color:'rgba(255,255,255,0.38)', fontSize:'11px' }}>Slide {agentSlideIndex+1} · {localSlides[agentSlideIndex]?.title}</div>
              </div>
              <button onClick={()=>setAgentOpen(false)} style={{ width:'28px', height:'28px', borderRadius:'7px', border:'none', background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={agentScrollRef} style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px' }}>
              {agentMessages.map((m, i) => (
                <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth:'80%', padding:'9px 13px', borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role==='user' ? 'linear-gradient(135deg,#7B2FBE,#D946A8)' : 'rgba(255,255,255,0.07)',
                    color: m.role==='user' ? '#fff' : 'rgba(255,255,255,0.85)',
                    fontSize:'13px', lineHeight:1.5,
                  }}>{m.text}</div>
                </div>
              ))}
              {agentThinking && (
                <div style={{ display:'flex', justifyContent:'flex-start' }}>
                  <div style={{ padding:'9px 13px', borderRadius:'14px 14px 14px 4px', background:'rgba(255,255,255,0.07)', display:'flex', gap:'4px', alignItems:'center' }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'rgba(255,255,255,0.4)', animation:`sgBounce 1s ease-in-out ${i*0.15}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input row */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'8px', alignItems:'flex-end' }}>
              <textarea
                ref={agentInputRef}
                value={agentInput}
                onChange={e=>setAgentInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleAgentSend();} }}
                placeholder="Describe what to change on this slide…"
                rows={2}
                style={{ flex:1, padding:'9px 12px', borderRadius:'10px', border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', outline:'none', resize:'none', fontFamily:'Calibri,sans-serif', lineHeight:1.45 }}
              />
              <button onClick={handleAgentSend} disabled={!agentInput.trim()||agentThinking} style={{
                width:'38px', height:'38px', borderRadius:'10px', border:'none', flexShrink:0,
                background: agentInput.trim()&&!agentThinking ? 'linear-gradient(135deg,#7B2FBE,#D946A8)' : 'rgba(255,255,255,0.08)',
                color: agentInput.trim()&&!agentThinking ? '#fff' : 'rgba(255,255,255,0.3)',
                cursor: agentInput.trim()&&!agentThinking ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sgSpin { to { transform: rotate(360deg); } }
        @keyframes sgBounce { 0%,80%,100% { transform:scale(0.6); opacity:.4 } 40% { transform:scale(1); opacity:1 } }
        @media print {
          body * { visibility: hidden !important; }
          #main-slide, #main-slide * { visibility: visible !important; }
          #main-slide { position:fixed !important; inset:0 !important; width:100vw !important; height:100vh !important; max-width:none !important; border-radius:0 !important; box-shadow:none !important; }
        }
      `}</style>
    </div>
  );
};

// ── Menu item helper ─────────────────────────────────────────
const MenuItem = ({ icon, label, sub, onClick }) => (
  <button onClick={onClick} style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:'none', background:'transparent', color:'rgba(255,255,255,0.75)', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', textAlign:'left', transition:'background 0.12s' }}
    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    <span style={{ color:'rgba(255,255,255,0.45)', flexShrink:0 }}>{icon}</span>
    <div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.82)' }}>{label}</div>
      {sub && <div style={{ fontSize:'10.5px', color:'rgba(255,255,255,0.35)', marginTop:'1px' }}>{sub}</div>}
    </div>
  </button>
);

Object.assign(window, { SlideGenerator });
