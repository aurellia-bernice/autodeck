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
const ghostButton = (T) => ({
  padding: '10px 18px', borderRadius: qxRadius.full,
  border: `1px solid ${T.border}`, background: 'transparent',
  color: T.inkDim, fontFamily: qxType.body, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
});

const AdminScreen = ({ tweaks, brandConfig, onBrandSave }) => {
  const T = qxTheme(tweaks?.darkMode);
  const [tab, setTab] = React.useState('brand');
  const [colors, setColors] = React.useState(brandConfig?.colors || {
    primary: '#5F2A91', secondary: '#7A3FB0', accent: '#B891DC',
    lime: '#D4FF3F', bgDark: '#0F031F', bgLight: '#FAF8FC',
  });
  const [voice, setVoice] = React.useState(brandConfig?.voice || 'professional');
  const [saved, setSaved] = React.useState(false);

  const tabs = [
    { id: 'brand', label: 'Brand colours' },
    { id: 'type',  label: 'Typography' },
    { id: 'tpl',   label: 'Templates' },
    { id: 'voice', label: 'Voice' },
  ];

  const colorRows = [
    { key: 'primary',   label: 'Primary purple',  role: 'Headers, links, key UI' },
    { key: 'secondary', label: 'Secondary purple', role: 'Hover states, secondary copy' },
    { key: 'accent',    label: 'Soft purple',      role: 'On-dark text, subtle highlights' },
    { key: 'lime',      label: 'Lime accent',      role: 'Single primary CTA per screen' },
    { key: 'bgDark',    label: 'Dark canvas',      role: 'Sidebar, dark slides' },
    { key: 'bgLight',   label: 'Light canvas',     role: 'App background' },
  ];

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
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < colorRows.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <label style={{ position: 'relative', width: 40, height: 40, borderRadius: qxRadius.sm, background: colors[row.key], border: `1px solid ${T.border}`, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                  <input type="color" value={colors[row.key]} onChange={e => setColors(p => ({ ...p, [row.key]: e.target.value }))}
                    style={{ position: 'absolute', inset: '-50%', width: '200%', height: '200%', opacity: 0, cursor: 'pointer' }} />
                </label>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 12.5, color: T.inkDim }}>{row.role}</div>
                </div>
                <span style={{ fontFamily: qxType.mono, fontSize: 12, color: T.ink, background: T.ghostBg, border: `1px solid ${T.border}`, padding: '6px 12px', borderRadius: qxRadius.xs }}>
                  {colors[row.key].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 }}>
            {saved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
            <button onClick={() => {
              const cfg = { colors, voice };
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
          <Card>
            <Eyebrow>Display · Space Grotesk</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: qxType.display, fontSize: 56, fontWeight: 500, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
                  Branded decks,<br/>
                  <span style={{ color: T.primary, fontStyle: 'italic', fontWeight: 400 }}>without the busywork.</span>
                </div>
              </div>
              <div style={{ width: 200, fontFamily: qxType.mono, fontSize: 11, color: T.inkDim, lineHeight: 1.7, padding: 12, background: T.ghostBg, border: `1px solid ${T.border}`, borderRadius: qxRadius.sm }}>
                "Space Grotesk",<br/>"Inter",<br/>system-ui
              </div>
            </div>
          </Card>
          <Card>
            <Eyebrow>Body · Inter</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: qxType.body, fontSize: 17, color: T.ink, lineHeight: 1.55, margin: 0 }}>
                  Inter is the primary UI face. Calm, neutral, and used for everything that isn't a moment.
                </p>
                <p style={{ fontFamily: qxType.body, fontSize: 13, color: T.inkDim, lineHeight: 1.6, margin: '12px 0 0' }}>
                  Smaller meta and helper copy lives at 13px / 1.6 in muted ink — readable but never loud.
                </p>
              </div>
              <div style={{ width: 200, fontFamily: qxType.mono, fontSize: 11, color: T.inkDim, lineHeight: 1.7, padding: 12, background: T.ghostBg, border: `1px solid ${T.border}`, borderRadius: qxRadius.sm }}>
                "Inter",<br/>system-ui
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'tpl' && (
        <Card>
          <Eyebrow>Active master template</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, background: T.ghostBg, borderRadius: qxRadius.md, border: `1px solid ${T.border}`, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: qxRadius.sm, background: T.primary, color: '#F6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M3 7h14M7 7v10" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: T.ink, marginBottom: 2 }}>Quidax Master v3.pptx</div>
              <div style={{ fontFamily: qxType.mono, fontSize: 10.5, color: T.inkMute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Uploaded 12 Apr 2026 · 4 layouts</div>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: qxRadius.full, background: 'rgba(52,199,123,0.10)', border: '1px solid rgba(52,199,123,0.25)', color: '#1F8A5B', fontFamily: qxType.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Active</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={primaryLimeButton()}>Upload new</button>
            <button style={ghostButton(T)}>Remove</button>
          </div>
        </Card>
      )}

      {tab === 'voice' && (
        <Card>
          <Eyebrow>Brand voice</Eyebrow>
          <p style={{ fontSize: 14, color: T.inkDim, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 560 }}>
            Shape how AutoDeck AI writes headlines, bullets, and summaries. Pick a tone that matches Quidax's communication style.
          </p>
          {[
            { id: 'professional', label: 'Professional', desc: 'Clear, confident, business-appropriate. No jargon.' },
            { id: 'bold',         label: 'Bold & direct', desc: 'Punchy, assertive, energetic. Short sentences.' },
            { id: 'approachable', label: 'Approachable',  desc: 'Warm and conversational. Human-first language.' },
            { id: 'data',         label: 'Data-led',      desc: 'Numbers front and centre. Evidence-based. Precise.' },
          ].map(v => (
            <div key={v.id} onClick={() => setVoice(v.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 16, marginBottom: 8,
              borderRadius: qxRadius.md,
              border: `1px solid ${voice === v.id ? T.primary : T.border}`,
              background: voice === v.id ? T.ghostBg : 'transparent',
              cursor: 'pointer', transition: `all 140ms ${qxEase}`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${voice === v.id ? T.primary : T.borderHi}`,
                background: voice === v.id ? T.primary : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {voice === v.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F6F1FB' }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{v.label}</div>
                <div style={{ fontSize: 13, color: T.inkDim }}>{v.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
            {saved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
            <button onClick={() => {
              const cfg = { colors, voice };
              onBrandSave && onBrandSave(cfg);
              if (window.firebaseDb) window.firebaseDb.doc('config/brand').set(cfg).catch(() => {});
              setSaved(true); setTimeout(() => setSaved(false), 2000);
            }} style={primaryLimeButton()}>Save voice</button>
          </div>
        </Card>
      )}
    </div>
  );
};
Object.assign(window, { AdminScreen });
