// ============================================================
// ============================================================
// AdminScreen — brand admin tabs (colors, type, templates, voice)
// ============================================================
const primaryLimeButton = () => ({
  padding: '10px 20px', borderRadius: qxRadius.full,
  border: 'none', background: QX.lime, color: QX.limeInk,
  fontFamily: qxType.body, fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
  boxShadow: '0 6px 20px rgba(212,255,63,0.35)',
  transition: `all 160ms ${qxEase}`,
});

const AdminScreen = ({ tweaks, brandConfig, onBrandSave }) => {
  const T = qxTheme(tweaks?.darkMode);
  const [tab, setTab] = React.useState('brand');
  const [colorRows, setColorRows] = React.useState([
    { id: 1, label: 'Primary purple',  role: 'Headers, links, key UI',          value: '#5F2A91' },
    { id: 2, label: 'Secondary purple',role: 'Hover states, secondary copy',    value: '#7A3FB0' },
    { id: 3, label: 'Soft purple',     role: 'On-dark text, subtle highlights', value: '#B891DC' },
    { id: 4, label: 'Lime accent',     role: 'Single primary CTA per screen',   value: '#D4FF3F' },
    { id: 5, label: 'Dark canvas',     role: 'Sidebar, dark slides',            value: '#0F031F' },
    { id: 6, label: 'Light canvas',    role: 'App background',                  value: '#FAF8FC' },
  ]);
  const [nextId, setNextId] = React.useState(7);
  const [voice, setVoice] = React.useState(brandConfig?.voice || 'professional');
  const [voiceDocs, setVoiceDocs] = React.useState({ professional: null, minimal: null, bold: null, fun: null });
  const voiceDocRefs = {
    professional: React.useRef(null),
    minimal:      React.useRef(null),
    bold:         React.useRef(null),
    fun:          React.useRef(null),
  };
  const handleVoiceDocUpload = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVoiceDocs(p => ({ ...p, [id]: file }));
    e.target.value = '';
  };
  const removeVoiceDoc = (id) => setVoiceDocs(p => ({ ...p, [id]: null }));
  const [saved, setSaved] = React.useState(false);

  const tabs = [
    { id: 'brand', label: 'Brand colours' },
    { id: 'type',  label: 'Typography' },
    { id: 'tpl',   label: 'Templates' },
    { id: 'voice', label: 'Voice' },
  ];

  const FONTS = [
    { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif",     google: null },
    { name: 'Inter',          family: "'Inter', system-ui, sans-serif",  google: null },
    { name: 'Poppins',        family: "'Poppins', sans-serif",           google: 'Poppins:wght@400;500;600;700' },
    { name: 'Montserrat',     family: "'Montserrat', sans-serif",        google: 'Montserrat:wght@400;500;600;700' },
    { name: 'Raleway',        family: "'Raleway', sans-serif",           google: 'Raleway:wght@400;500;600;700' },
    { name: 'DM Sans',        family: "'DM Sans', sans-serif",           google: 'DM+Sans:wght@400;500;600;700' },
    { name: 'Nunito',         family: "'Nunito', sans-serif",            google: 'Nunito:wght@400;600;700' },
    { name: 'Lato',           family: "'Lato', sans-serif",              google: 'Lato:wght@400;700' },
    { name: 'Roboto',         family: "'Roboto', sans-serif",            google: 'Roboto:wght@400;500;700' },
    { name: 'Open Sans',      family: "'Open Sans', sans-serif",         google: 'Open+Sans:wght@400;600;700' },
    { name: 'Playfair Display', family: "'Playfair Display', serif",     google: 'Playfair+Display:wght@400;600;700' },
    { name: 'Lora',           family: "'Lora', serif",                   google: 'Lora:wght@400;600;700' },
    { name: 'Georgia',        family: 'Georgia, serif',                  google: null },
    { name: 'Arial',          family: 'Arial, sans-serif',               google: null },
    { name: 'Verdana',        family: 'Verdana, sans-serif',             google: null },
  ];

  const [templates, setTemplates] = React.useState([
    { id: 1, name: 'Quidax Master v3.pptx', date: '12 Apr 2026', layouts: 4, active: true },
  ]);
  const [nextTplId, setNextTplId] = React.useState(2);
  const tplInputRef = React.useRef(null);

  const handleTplUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newTpl = { id: nextTplId, name: file.name, date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), layouts: 0, active: false };
    setTemplates(p => [...p, newTpl]);
    setNextTplId(n => n + 1);
    e.target.value = '';
  };

  const setActiveTemplate = (id) => setTemplates(p => p.map(t => ({ ...t, active: t.id === id })));
  const deleteTemplate    = (id) => setTemplates(p => {
    const remaining = p.filter(t => t.id !== id);
    if (remaining.length && !remaining.some(t => t.active)) remaining[0].active = true;
    return remaining;
  });

  const [displayFont, setDisplayFont] = React.useState(FONTS[0]);
  const [bodyFont,    setBodyFont]    = React.useState(FONTS[1]);
  const [fontSaved,   setFontSaved]   = React.useState(false);

  const loadGoogleFont = (google) => {
    if (!google) return;
    const id = `gf-${google}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
    document.head.appendChild(link);
  };

  const selectDisplayFont = (f) => { loadGoogleFont(f.google); setDisplayFont(f); };
  const selectBodyFont    = (f) => { loadGoogleFont(f.google); setBodyFont(f); };

  const updateColor = (id, value) => setColorRows(p => p.map(r => r.id === id ? { ...r, value } : r));
  const deleteColor = (id) => setColorRows(p => p.filter(r => r.id !== id));
  const addColor = () => {
    setColorRows(p => [...p, { id: nextId, label: 'New colour', role: 'Custom role', value: '#888888' }]);
    setNextId(n => n + 1);
  };

  const Card = ({ children }) => (
    <div style={{ background: T.surface, borderRadius: qxRadius.lg, border: `1px solid ${T.border}`, padding: 28, boxShadow: qxShadow(tweaks?.darkMode).md }}>
      {children}
    </div>
  );
  const Eyebrow = ({ children }) => (
    <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 18 }}>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: qxType.body, color: T.ink, padding: '40px 48px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ padding: '4px 10px', borderRadius: qxRadius.full, background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.25)', color: '#B27000', fontFamily: qxType.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Design team only
          </span>
        </div>
        <h1 style={{ fontFamily: qxType.display, fontSize: 40, fontWeight: 500, color: T.ink, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Brand admin
        </h1>
        <p style={{ fontSize: 15, color: T.inkDim, margin: 0 }}>
          Manage Quidax brand configuration and slide templates.
        </p>
      </div>

      <div style={{ display: 'inline-flex', background: T.ghostBg, borderRadius: qxRadius.full, padding: 3, marginBottom: 24, border: `1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: qxRadius.full, border: 'none',
            background: tab === t.id ? T.bgElev : 'transparent',
            color: tab === t.id ? T.ink : T.inkDim,
            fontFamily: qxType.body, fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
            cursor: 'pointer', transition: `all 140ms ${qxEase}`,
            boxShadow: tab === t.id ? qxShadow(tweaks?.darkMode).sm : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'brand' && (
        <Card>
          <Eyebrow>Colour palette</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {colorRows.map((row, i) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < colorRows.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <label style={{ position: 'relative', width: 40, height: 40, borderRadius: qxRadius.sm, background: row.value, border: `1px solid ${T.border}`, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                  <input type="color" value={row.value} onChange={e => updateColor(row.id, e.target.value)}
                    style={{ position: 'absolute', inset: '-50%', width: '200%', height: '200%', opacity: 0, cursor: 'pointer' }} />
                </label>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 12.5, color: T.inkDim }}>{row.role}</div>
                </div>
                <span style={{ fontFamily: qxType.mono, fontSize: 12, color: T.ink, background: T.ghostBg, border: `1px solid ${T.border}`, padding: '6px 12px', borderRadius: qxRadius.xs }}>
                  {row.value.toUpperCase()}
                </span>
                <button
                  onClick={() => deleteColor(row.id)}
                  title="Delete colour"
                  style={{ width: 32, height: 32, borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05A5A'; e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = 'rgba(224,90,90,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add colour button */}
          <button
            onClick={addColor}
            style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: qxRadius.full, border: `1.5px dashed ${T.border}`, background: 'transparent', color: T.inkDim, fontSize: 13, fontFamily: qxType.body, cursor: 'pointer', transition: `all 140ms ${qxEase}` }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Add colour
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 }}>
            {saved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
            <button onClick={() => {
              const cfg = { colorRows, voice };
              onBrandSave && onBrandSave(cfg);
              if (window.firebaseDb) window.firebaseDb.doc('config/brand').set(cfg).catch(() => {});
              setSaved(true); setTimeout(() => setSaved(false), 2000);
            }} style={primaryLimeButton()}>
              Save palette
            </button>
          </div>
        </Card>
      )}

      {tab === 'type' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Display font card */}
          <Card>
            <Eyebrow>Display font · {displayFont.name}</Eyebrow>
            {/* Live preview */}
            <div style={{ padding: '24px 0 20px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
              <div style={{ fontFamily: displayFont.family, fontSize: 48, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 6 }}>
                Branded decks,
              </div>
              <div style={{ fontFamily: displayFont.family, fontSize: 48, fontWeight: 400, fontStyle: 'italic', color: T.primary, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                without the busywork.
              </div>
              <div style={{ marginTop: 14, fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, background: T.ghostBg, border: `1px solid ${T.border}`, borderRadius: qxRadius.xs, padding: '5px 10px', display: 'inline-block' }}>
                {displayFont.family}
              </div>
            </div>
            {/* Font picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FONTS.map(f => (
                <button key={f.name} onClick={() => selectDisplayFont(f)} style={{
                  padding: '7px 14px', borderRadius: qxRadius.full, cursor: 'pointer',
                  fontFamily: f.family, fontSize: 13, fontWeight: 500,
                  border: `1.5px solid ${displayFont.name === f.name ? T.primary : T.border}`,
                  background: displayFont.name === f.name ? T.ghostBg : 'transparent',
                  color: displayFont.name === f.name ? T.ink : T.inkDim,
                  transition: `all 140ms ${qxEase}`,
                }}>{f.name}</button>
              ))}
            </div>
          </Card>

          {/* Body font card */}
          <Card>
            <Eyebrow>Body font · {bodyFont.name}</Eyebrow>
            {/* Live preview */}
            <div style={{ padding: '20px 0 20px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
              <p style={{ fontFamily: bodyFont.family, fontSize: 17, color: T.ink, lineHeight: 1.6, margin: '0 0 10px' }}>
                AutoDeck AI helps your team create perfectly branded presentations in seconds — paste your notes and go.
              </p>
              <p style={{ fontFamily: bodyFont.family, fontSize: 13, color: T.inkDim, lineHeight: 1.6, margin: 0 }}>
                Smaller helper copy at 13px / 1.6 — readable, calm, never loud.
              </p>
              <div style={{ marginTop: 14, fontFamily: qxType.mono, fontSize: 11, color: T.inkMute, background: T.ghostBg, border: `1px solid ${T.border}`, borderRadius: qxRadius.xs, padding: '5px 10px', display: 'inline-block' }}>
                {bodyFont.family}
              </div>
            </div>
            {/* Font picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FONTS.map(f => (
                <button key={f.name} onClick={() => selectBodyFont(f)} style={{
                  padding: '7px 14px', borderRadius: qxRadius.full, cursor: 'pointer',
                  fontFamily: f.family, fontSize: 13, fontWeight: 400,
                  border: `1.5px solid ${bodyFont.name === f.name ? T.primary : T.border}`,
                  background: bodyFont.name === f.name ? T.ghostBg : 'transparent',
                  color: bodyFont.name === f.name ? T.ink : T.inkDim,
                  transition: `all 140ms ${qxEase}`,
                }}>{f.name}</button>
              ))}
            </div>
          </Card>

          {/* Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            {fontSaved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
            <button onClick={() => { setFontSaved(true); setTimeout(() => setFontSaved(false), 2000); }} style={primaryLimeButton()}>
              Save typography
            </button>
          </div>
        </div>
      )}

      {tab === 'tpl' && (
        <Card>
          <Eyebrow>Slide templates</Eyebrow>

          {/* Hidden file input */}
          <input ref={tplInputRef} type="file" accept=".pptx,.ppt,.key" style={{ display: 'none' }} onChange={handleTplUpload} />

          {/* Template list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {templates.map((tpl, i) => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < templates.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                {/* Icon */}
                <div style={{ width: 40, height: 40, borderRadius: qxRadius.sm, background: tpl.active ? T.primary : T.ghostBg, border: `1px solid ${T.border}`, color: tpl.active ? '#F6F1FB' : T.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all 140ms ${qxEase}` }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M2 6h14M6 6v10" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</div>
                  <div style={{ fontFamily: qxType.mono, fontSize: 10.5, color: T.inkMute, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Uploaded {tpl.date}{tpl.layouts > 0 ? ` · ${tpl.layouts} layouts` : ''}
                  </div>
                </div>

                {/* Active badge / Set active button */}
                {tpl.active ? (
                  <span style={{ padding: '4px 10px', borderRadius: qxRadius.full, background: 'rgba(52,199,123,0.10)', border: '1px solid rgba(52,199,123,0.25)', color: '#1F8A5B', fontFamily: qxType.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>Active</span>
                ) : (
                  <button onClick={() => setActiveTemplate(tpl.id)} style={{ padding: '5px 12px', borderRadius: qxRadius.full, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, fontSize: 12, fontFamily: qxType.body, cursor: 'pointer', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#1F8A5B'; e.currentTarget.style.color = '#1F8A5B'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; }}>
                    Set active
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => deleteTemplate(tpl.id)}
                  style={{ width: 32, height: 32, borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05A5A'; e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = 'rgba(224,90,90,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Upload button */}
          <button onClick={() => tplInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: qxRadius.full, border: `1.5px dashed ${T.border}`, background: 'transparent', color: T.inkDim, fontSize: 13, fontFamily: qxType.body, cursor: 'pointer', transition: `all 140ms ${qxEase}` }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Upload template
          </button>
        </Card>
      )}

      {tab === 'voice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: qxType.mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 8 }}>Brand voice</div>
            <p style={{ fontSize: 14, color: T.inkDim, margin: 0, lineHeight: 1.55, maxWidth: 580 }}>
              Each style has its own voice. Upload a doc — brand guidelines, tone of voice notes, sample copy — and AutoDeck AI will use it when generating decks in that style.
            </p>
          </div>

          {[
            { id: 'professional', label: 'Professional', desc: 'Clear, confident, business-appropriate. No jargon.' },
            { id: 'minimal',      label: 'Minimal',      desc: 'Stripped back. Let the content breathe.' },
            { id: 'bold',         label: 'Bold',         desc: 'Punchy, assertive, energetic. Short sentences.' },
            { id: 'fun',          label: 'Fun',          desc: 'Playful, warm, energetic. Human and upbeat.' },
          ].map(v => {
            const doc = voiceDocs[v.id];
            const isActive = voice === v.id;
            return (
              <div key={v.id} style={{
                borderRadius: qxRadius.lg,
                border: `1px solid ${isActive ? T.primary : T.border}`,
                background: isActive ? T.ghostBg : T.surface,
                overflow: 'hidden',
                transition: `all 140ms ${qxEase}`,
                boxShadow: isActive ? qxShadow(tweaks?.darkMode).sm : 'none',
              }}>
                {/* Header row — click to select */}
                <div onClick={() => setVoice(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${isActive ? T.primary : T.borderHi}`,
                    background: isActive ? T.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: `all 140ms ${qxEase}`,
                  }}>
                    {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F6F1FB' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{v.label}</div>
                    <div style={{ fontSize: 13, color: T.inkDim }}>{v.desc}</div>
                  </div>
                  {doc && (
                    <span style={{ padding: '3px 9px', borderRadius: qxRadius.full, background: 'rgba(52,199,123,0.10)', border: '1px solid rgba(52,199,123,0.25)', color: '#1F8A5B', fontFamily: qxType.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
                      Doc uploaded
                    </span>
                  )}
                </div>

                {/* Upload area */}
                <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    ref={voiceDocRefs[v.id]}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleVoiceDocUpload(v.id, e)}
                  />
                  {doc ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#1F8A5B', flexShrink: 0 }}><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ flex: 1, fontSize: 13, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                      <button
                        onClick={() => voiceDocRefs[v.id].current?.click()}
                        style={{ padding: '5px 12px', borderRadius: qxRadius.full, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, fontSize: 12, fontFamily: qxType.body, cursor: 'pointer', flexShrink: 0 }}>
                        Replace
                      </button>
                      <button
                        onClick={() => removeVoiceDoc(v.id)}
                        style={{ width: 28, height: 28, borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05A5A'; e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = 'rgba(224,90,90,0.07)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = 'transparent'; }}>
                        <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => voiceDocRefs[v.id].current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: qxRadius.full, border: `1.5px dashed ${T.border}`, background: 'transparent', color: T.inkDim, fontSize: 13, fontFamily: qxType.body, cursor: 'pointer', transition: `all 140ms ${qxEase}` }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Upload voice doc
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 4 }}>
            {saved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
            <button onClick={() => {
              const cfg = { colorRows, voice, voiceDocs: Object.fromEntries(Object.entries(voiceDocs).map(([k, v]) => [k, v ? v.name : null])) };
              onBrandSave && onBrandSave(cfg);
              if (window.firebaseDb) window.firebaseDb.doc('config/brand').set(cfg).catch(() => {});
              setSaved(true); setTimeout(() => setSaved(false), 2000);
            }} style={primaryLimeButton()}>Save voice</button>
          </div>
        </div>
      )}
    </div>
  );
};
Object.assign(window, { AdminScreen });
