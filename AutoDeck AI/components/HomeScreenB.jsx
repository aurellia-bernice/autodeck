// ============================================================
// HomeScreen — Variation B: Studio workspace (two-column)
// Editor on the left, live deck preview / config on the right.
// More tool-y, more "you're driving something powerful."
// ============================================================
const HomeScreenB = ({ onGenerate, tweaks }) => {
  const T = qxTheme(tweaks?.darkMode);
  const [inputText, setInputText] = React.useState('');
  const [slideCount, setSlideCount] = React.useState('Auto');
  const [templateStyle, setTemplateStyle] = React.useState('Professional');
  const [uploadedFile, setUploadedFile] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [audience, setAudience] = React.useState('Internal team');

  const slideOptions = ['5', '8', '10', '15', 'Auto'];
  const templates = [
    { id: 'Professional', desc: 'Clean, structured, default Quidax brand.' },
    { id: 'Minimal',      desc: 'Generous whitespace, type-led.' },
    { id: 'Bold',         desc: 'High-contrast title moments.' },
    { id: 'Fun',          desc: 'Playful & energetic layouts.' },
  ];
  const audiences = ['Internal team', 'Leadership', 'Clients', 'Investors', 'Public'];

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;
  const estSlides = slideCount === 'Auto'
    ? Math.max(5, Math.min(20, Math.round(wordCount / 60) || 0))
    : parseInt(slideCount, 10);
  const readMin = Math.max(1, Math.round(wordCount / 200));
  const canGenerate = inputText.trim().length > 10 || uploadedFile;

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: qxType.body,
      color: T.ink,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* one ambient blob, top-right */}
      <div aria-hidden style={{
        position: 'absolute', top: '-15%', right: '-8%',
        width: '520px', height: '520px', borderRadius: '50%',
        background: `radial-gradient(circle, ${T.blob1} 0%, transparent 60%)`,
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />

      {/* topbar */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '24px 40px',
        display: 'flex', alignItems: 'baseline', gap: '16px',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          fontFamily: qxType.display, fontSize: '22px', fontWeight: 500,
          letterSpacing: '-0.02em', color: T.ink,
        }}>
          New deck
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: qxType.mono, fontSize: '11px', color: T.inkMute,
          letterSpacing: '0.08em',
        }}>
          DRAFT · UNSAVED
        </div>
      </div>

      {/* two-column body */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '0',
        minHeight: 'calc(100vh - 73px)',
      }}>
        {/* LEFT — editor */}
        <div style={{ padding: '40px', borderRight: `1px solid ${T.border}` }}>
          <div style={{
            fontFamily: qxType.mono, fontSize: '11px', letterSpacing: '0.18em',
            textTransform: 'uppercase', color: T.inkMute, marginBottom: '12px',
          }}>
            Source content
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              background: T.surface,
              borderRadius: qxRadius.lg,
              border: `1px solid ${dragOver ? T.primary : T.border}`,
              boxShadow: dragOver ? `0 0 0 4px ${T.ghostBg}` : qxShadow(tweaks?.darkMode).sm,
              transition: `all 220ms ${qxEase}`,
              overflow: 'hidden',
            }}
          >
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Paste meeting notes, an outline, or a brief.\n\nExample —\n\n# Q2 Sales Strategy\n- New ICP: mid-market fintechs in EMEA\n- Pricing tier launch in May\n- Target: 30% MQL → SQL by quarter close\n…`}
              style={{
                width: '100%',
                minHeight: '460px',
                padding: '24px',
                border: 'none', outline: 'none', resize: 'vertical',
                background: 'transparent',
                fontFamily: qxType.body,
                fontSize: '15px', lineHeight: 1.65, color: T.ink,
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 16px',
              borderTop: `1px solid ${T.border}`,
              background: tweaks?.darkMode ? 'rgba(0,0,0,0.18)' : T.surfaceHi,
            }}>
              <button
                onClick={() => document.getElementById('hsBFile').click()}
                style={qxGhostBtn(T)}
                onMouseEnter={e => e.currentTarget.style.background = T.ghostHi}
                onMouseLeave={e => e.currentTarget.style.background = T.ghostBg}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 1H3v12h8V3L9 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M9 1v2h2" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                {uploadedFile ? uploadedFile.name : 'Attach file'}
              </button>
              <input id="hsBFile" type="file" accept=".pdf,.docx,.txt,.pptx" style={{ display: 'none' }}
                     onChange={e => e.target.files[0] && setUploadedFile(e.target.files[0])} />
              {uploadedFile && (
                <button onClick={() => setUploadedFile(null)}
                  style={{ ...qxGhostBtn(T), background: 'transparent', color: T.inkMute }}>
                  ×
                </button>
              )}
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: qxType.mono, fontSize: '11px', color: T.inkMute, letterSpacing: '0.05em' }}>
                {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} words
              </span>
            </div>
          </div>

          {/* prompt chips */}
          <div style={{ marginTop: '24px' }}>
            <div style={{
              fontFamily: qxType.mono, fontSize: '11px', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.inkMute, marginBottom: '12px',
            }}>
              Quick start
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                'Quarterly business review',
                'Product launch',
                'Compliance training',
                'Investor update',
                'All-hands recap',
                'Sales pitch',
              ].map(p => (
                <button key={p} onClick={() => setInputText(p + ' — ')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: qxRadius.full,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.inkDim,
                    fontFamily: qxType.body, fontSize: '13px',
                    cursor: 'pointer',
                    transition: `all 160ms ${qxEase}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.ghostBg; e.currentTarget.style.color = T.ink; e.currentTarget.style.borderColor = T.borderHi; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.borderColor = T.border; }}
                >{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — config / live preview */}
        <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Live estimate */}
          <div>
            <div style={{
              fontFamily: qxType.mono, fontSize: '11px', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.inkMute, marginBottom: '12px',
            }}>
              Estimate
            </div>
            <div style={{
              padding: '20px',
              background: T.surface,
              borderRadius: qxRadius.md,
              border: `1px solid ${T.border}`,
              display: 'flex', gap: '24px',
            }}>
              <Stat label="Slides" value={canGenerate ? estSlides : '—'} T={T} />
              <Divider T={T} />
              <Stat label="Read" value={canGenerate ? `${readMin}m` : '—'} T={T} />
              <Divider T={T} />
              <Stat label="Words" value={wordCount.toLocaleString()} T={T} />
            </div>
          </div>

          {/* Slide count */}
          <Field label="Slide count" T={T}>
            {window.qxPills({ value: slideCount, onChange: setSlideCount, options: slideOptions, T })}
          </Field>

          {/* Style */}
          <Field label="Template style" T={T}>
            <div style={{ display: 'grid', gap: '6px' }}>
              {templates.map(t => (
                <button key={t.id} onClick={() => setTemplateStyle(t.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: qxRadius.md,
                    border: `1px solid ${templateStyle === t.id ? T.primary : T.border}`,
                    background: templateStyle === t.id ? T.ghostBg : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: `all 140ms ${qxEase}`,
                    display: 'flex', flexDirection: 'column', gap: '2px',
                  }}>
                  <span style={{
                    fontFamily: qxType.body, fontSize: '14px', fontWeight: 600,
                    color: T.ink,
                  }}>{t.id}</span>
                  <span style={{ fontSize: '12px', color: T.inkMute, lineHeight: 1.4 }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Audience */}
          <Field label="Audience" T={T}>
            <select value={audience} onChange={e => setAudience(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px',
                borderRadius: qxRadius.md,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.ink,
                fontFamily: qxType.body, fontSize: '14px',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='${encodeURIComponent(T.inkMute)}' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
                cursor: 'pointer',
              }}>
              {audiences.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>

          <div style={{ flex: 1 }} />

          {/* CTA — the ONE lime moment */}
          <button
            onClick={() => canGenerate && onGenerate({ inputText, slideCount, templateStyle, uploadedFile, audience })}
            disabled={!canGenerate}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: qxRadius.md,
              border: 'none',
              background: canGenerate ? QX.lime : T.ghostBg,
              color: canGenerate ? QX.limeInk : T.inkFaint,
              fontFamily: qxType.body,
              fontSize: '15px', fontWeight: 600,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: `all 180ms ${qxEase}`,
              boxShadow: canGenerate ? '0 4px 24px rgba(212,255,63,0.32)' : 'none',
            }}
            onMouseEnter={e => { if (canGenerate) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(212,255,63,0.42)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; if (canGenerate) e.currentTarget.style.boxShadow = '0 4px 24px rgba(212,255,63,0.32)'; }}
          >
            Generate deck
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{
            fontFamily: qxType.mono, fontSize: '11px', color: T.inkMute,
            textAlign: 'center', letterSpacing: '0.05em', marginTop: '-12px',
          }}>
            ⌘ ↵ to generate
          </div>
        </div>
      </div>
    </div>
  );
};

// ── helpers ────────────────────────────────────────────────
const Field = ({ label, children, T }) => (
  <div>
    <div style={{
      fontFamily: qxType.mono, fontSize: '11px', letterSpacing: '0.18em',
      textTransform: 'uppercase', color: T.inkMute, marginBottom: '12px',
    }}>{label}</div>
    {children}
  </div>
);

const Stat = ({ label, value, T }) => (
  <div style={{ flex: 1 }}>
    <div style={{
      fontFamily: qxType.display, fontSize: '24px', fontWeight: 500,
      letterSpacing: '-0.02em', color: T.ink, lineHeight: 1,
    }}>{value}</div>
    <div style={{
      fontFamily: qxType.mono, fontSize: '10px', letterSpacing: '0.18em',
      textTransform: 'uppercase', color: T.inkMute, marginTop: '6px',
    }}>{label}</div>
  </div>
);

const Divider = ({ T }) => (
  <div style={{ width: '1px', background: T.border }} />
);

Object.assign(window, { HomeScreenB });
