// ============================================================
// HomeScreenA — Editorial canvas with personality.
// Big serif-italic accent, animated marquee strip, smart prompts.
// ============================================================
const HomeScreenA = ({ onGenerate, tweaks }) => {
  const T = qxTheme(tweaks?.darkMode);
  const [inputText, setInputText] = React.useState('');
  const [slideCount, setSlideCount] = React.useState('Auto');
  const [templateStyle, setTemplateStyle] = React.useState('Professional');
  const [uploadedFile, setUploadedFile] = React.useState(null);
  const [parsedFileText, setParsedFileText] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [activePrompt, setActivePrompt] = React.useState(0);

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(String(e.target.result || '').split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const pdfTextItemsToLines = (items = []) => {
    const rows = new Map();
    items.forEach((item) => {
      const text = String(item?.str || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const transform = Array.isArray(item?.transform) ? item.transform : [];
      const y = Number.isFinite(transform[5]) ? Math.round(transform[5]) : 0;
      const x = Number.isFinite(transform[4]) ? transform[4] : 0;
      const key = String(y);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x, text });
    });
    return [...rows.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, row]) => row
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(' '))
      .join('\n');
  };

  const isParsedDocumentNoise = (value) => {
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

  const sourceUnitKey = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const isLikelyRepeatedHeader = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const letters = text.replace(/[^A-Za-z]/g, '');
    const upper = text.replace(/[^A-Z]/g, '');
    const upperRatio = letters.length ? upper.length / letters.length : 0;
    return words.length <= 14 && (upperRatio > 0.72 || /[@|]\s*\b/.test(text));
  };

  const dedupeParsedUnits = (units) => {
    const counts = new Map();
    units.forEach((unit) => {
      const key = sourceUnitKey(unit);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const seen = new Map();
    return units.filter((unit) => {
      const key = sourceUnitKey(unit);
      if (!key) return false;
      const nextSeen = (seen.get(key) || 0) + 1;
      seen.set(key, nextSeen);
      if (nextSeen === 1) return true;
      return !(counts.get(key) > 1 || isLikelyRepeatedHeader(unit));
    });
  };

  const cleanParsedDocumentText = (value) => {
    const units = String(value || '')
      .replace(/\u0000/g, '')
      .split(/\n+/)
      .flatMap((line) => {
        const compact = line.replace(/\s+/g, ' ').trim();
        if (!compact) return [];
        return compact.length > 260
          ? (compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact])
          : [compact];
      })
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const cleaned = units.filter((line) => !isParsedDocumentNoise(line));
    return dedupeParsedUnits(cleaned.length ? cleaned : units).join('\n').trim();
  };

  const parseFile = async (file) => {
    if (!file) { setParsedFileText(''); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    setParsing(true);
    try {
      if (ext === 'txt') {
        const text = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.onerror = rej;
          r.readAsText(file);
        });
        setParsedFileText(cleanParsedDocumentText(text));
      } else if (ext === 'pdf' && window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(pdfTextItemsToLines(content.items));
        }
        setParsedFileText(cleanParsedDocumentText(pages.join('\n\n')));
      } else if (ext === 'docx' && window.firebase?.app) {
        const base64 = await fileToBase64(file);
        const parseDocxFn = firebase.app().functions('us-central1').httpsCallable('parseDocx');
        const { data } = await parseDocxFn({ base64 });
        setParsedFileText(cleanParsedDocumentText(data?.text || ''));
      } else if (ext === 'pptx' && window.firebase?.app) {
        const base64 = await fileToBase64(file);
        const parsePptxFn = firebase.app().functions('us-central1').httpsCallable('parsePptx');
        const { data } = await parsePptxFn({ base64 });
        setParsedFileText(cleanParsedDocumentText(data?.text || ''));
      } else {
        setParsedFileText('');
      }
    } catch (_) {
      setParsedFileText('');
    }
    setParsing(false);
  };

  const slideOptions = ['5', '8', '10', '15', 'Auto'];
  const templates = window.AutoDeckTemplatePresets?.getTemplateOptions?.() || ['Professional', 'Minimal', 'Bold', 'Fun'];

  const canGenerate = !parsing && (inputText.trim().length > 10 || uploadedFile);
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const parsedWordCount = parsedFileText.trim() ? parsedFileText.trim().split(/\s+/).length : 0;
  const estSlides = wordCount > 0 ? Math.max(3, Math.min(20, Math.round(wordCount / 60))) : 0;

  const promptIdeas = [
    { kicker: 'Quarterly', label: 'Q3 business review', seed: 'Quarterly business review for Q3 2026 covering revenue, retention, product wins, and outlook for Q4. Audience: leadership team.' },
    { kicker: 'Launch',    label: 'Product launch announcement', seed: 'Product launch announcement for a new merchant payment feature. Cover the problem, our solution, target customers, pricing, and rollout plan.' },
    { kicker: 'Training',  label: 'Compliance training deck', seed: 'Compliance training deck on AML and KYC procedures for new hires. Include policy basics, red flags, escalation, and a short quiz.' },
    { kicker: 'Investor',  label: 'Series B update', seed: 'Investor update for our Series B partners. Cover Q3 metrics, key milestones hit, runway, and what we need from the round.' },
    { kicker: 'All-hands', label: 'Team all-hands recap', seed: 'All-hands recap covering company highlights, team news, customer wins, and OKR progress for the quarter.' },
  ];

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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, margin: '0 auto', padding: '56px 32px 96px' }}>
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
          margin: '0 0 44px', maxWidth: 540,
        }}>
          Paste notes, drop a doc, or describe it. AutoDeck structures a brand-perfect Quidax deck in seconds.
        </p>

        {/* Textarea card */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            ...qxMotion.fadeUp(240),
            background: T.surface,
            borderRadius: qxRadius.lg,
            border: `1px solid ${dragOver ? T.primary : T.border}`,
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
            placeholder={inputText ? '' : promptIdeas[activePrompt].seed}
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

            <div style={{ flex: 1 }} />

            <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>
              {parsing ? 'parsing file...' : parsedWordCount > 0 ? `${parsedWordCount.toLocaleString()} file words parsed` : wordCount > 0 ? `${wordCount.toLocaleString()} words · ~${estSlides} slides` : 'or drag a file'}
            </span>
          </div>
        </div>

        {/* Compact config row */}
        <div style={{ ...qxMotion.fadeUp(300), marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
          <ConfigGroup label="Slides" T={T}>
            <Pills value={slideCount} onChange={setSlideCount} options={slideOptions} T={T} />
          </ConfigGroup>
          <ConfigGroup label="Style" T={T}>
            <Pills value={templateStyle} onChange={setTemplateStyle} options={templates} T={T} />
          </ConfigGroup>
        </div>

        {/* CTA — the lime moment */}
        <div style={{ ...qxMotion.fadeUp(360), marginTop: 36, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => canGenerate && onGenerate({
              inputText,
              slideCount,
              templateStyle,
              templatePreset: window.AutoDeckTemplatePresets?.summarizeForPrompt?.(templateStyle),
              uploadedFile,
              parsedFileText,
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
            {parsing ? 'Parsing file...' : 'Generate deck'}
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.05em' }}>⌘ ↵</span>
        </div>

        {/* Prompt seeds — editorial card row */}
        <div style={{ ...qxMotion.fadeUp(440), marginTop: 72, paddingTop: 32, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute }}>
              Or start from
            </div>
            <div style={{ fontFamily: qxType.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkFaint }}>
              {String(activePrompt + 1).padStart(2, '0')} / {String(promptIdeas.length).padStart(2, '0')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {promptIdeas.map((p, i) => (
              <button key={p.label} onClick={() => setInputText(p.seed)}
                onMouseEnter={() => setActivePrompt(i)}
                style={{
                  padding: '18px 18px 16px',
                  borderRadius: qxRadius.md,
                  border: `1px solid ${activePrompt === i ? T.primary : T.border}`,
                  background: activePrompt === i ? T.surface : 'transparent',
                  color: T.ink,
                  fontFamily: qxType.body,
                  cursor: 'pointer',
                  transition: `all 240ms ${qxEase}`,
                  textAlign: 'left',
                  boxShadow: activePrompt === i ? qxShadow(tweaks?.darkMode).md : 'none',
                  transform: activePrompt === i ? 'translateY(-2px)' : 'translateY(0)',
                }}>
                <div style={{
                  fontFamily: qxType.mono, fontSize: 10,
                  letterSpacing: '0.20em', textTransform: 'uppercase',
                  color: activePrompt === i ? T.primary : T.inkMute,
                  marginBottom: 8,
                }}>
                  {p.kicker}
                </div>
                <div style={{
                  fontFamily: qxType.display, fontSize: 17, fontWeight: 500,
                  letterSpacing: '-0.015em', lineHeight: 1.25, color: T.ink,
                }}>{p.label}</div>
              </button>
            ))}
          </div>
        </div>
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
