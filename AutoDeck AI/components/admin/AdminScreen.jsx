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

const adminCallFn = (name, payload = {}, timeoutMs = 30000) => {
  const fn = firebase.app().functions('us-central1').httpsCallable(name, { timeout: timeoutMs });
  return fn(payload).then((result) => result.data);
};

const BRAND_ASSET_KINDS = [
  { value: 'logo', label: 'Logo / mark' },
  { value: 'icon', label: 'Icon' },
  { value: 'image', label: 'Image' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'pattern', label: 'Pattern / background' },
  { value: 'source', label: 'Design source' },
  { value: 'other', label: 'Other' },
];

const safeBrandAssetFileName = (value) => String(value || 'brand-asset')
  .replace(/[^\w.-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 120) || 'brand-asset';

const normalizeBrandAssetUrlForAdmin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { url: '', sourceUrl: '', sourceType: 'url' };
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const driveId = parsed.searchParams.get('id')
      || raw.match(/\/file\/d\/([^/?#]+)/)?.[1]
      || raw.match(/\/presentation\/d\/([^/?#]+)/)?.[1]
      || raw.match(/\/document\/d\/([^/?#]+)/)?.[1];
    if (driveId && host.includes('drive.google.com')) {
      return {
        url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`,
        sourceUrl: raw,
        sourceType: 'google',
      };
    }
    return {
      url: parsed.href,
      sourceUrl: raw,
      sourceType: host.includes('google.') || host.includes('googleusercontent.com') ? 'google' : 'url',
    };
  } catch (_) {
    return { url: raw, sourceUrl: raw, sourceType: 'url' };
  }
};

const inferBrandAssetKind = (file) => {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (/logo|mark/.test(name)) return 'logo';
  if (/icon|glyph/.test(name)) return 'icon';
  if (/pattern|background|texture/.test(name)) return 'pattern';
  if (type.startsWith('image/')) return 'image';
  return 'source';
};

const normalizeBrandAssetRows = (assets = []) => Array.isArray(assets)
  ? assets
      .filter((asset) => asset && typeof asset === 'object')
      .map((asset, index) => {
        const normalized = normalizeBrandAssetUrlForAdmin(asset.url || asset.sourceUrl || '');
        return {
          id: String(asset.id || `asset-${Date.now()}-${index}`).trim(),
          name: String(asset.name || asset.fileName || `Brand asset ${index + 1}`).trim(),
          kind: String(asset.kind || 'image').trim().toLowerCase(),
          url: normalized.url,
          sourceUrl: asset.sourceUrl || normalized.sourceUrl,
          sourceType: asset.sourceType || normalized.sourceType,
          usage: String(asset.usage || '').trim(),
          fileName: String(asset.fileName || '').trim(),
          storagePath: String(asset.storagePath || '').trim(),
          addedAt: String(asset.addedAt || '').trim(),
        };
      })
      .filter((asset) => asset.name && asset.url)
  : [];

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
  const [brandAssets, setBrandAssets] = React.useState(() => normalizeBrandAssetRows(brandConfig?.brandAssets));
  const [assetName, setAssetName] = React.useState('');
  const [assetUrl, setAssetUrl] = React.useState('');
  const [assetKind, setAssetKind] = React.useState('logo');
  const [assetKindTouched, setAssetKindTouched] = React.useState(false);
  const [assetUsage, setAssetUsage] = React.useState('');
  const [assetUploading, setAssetUploading] = React.useState(false);
  const [assetSaved, setAssetSaved] = React.useState(false);
  const [assetError, setAssetError] = React.useState('');
  const assetFileRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);

  const tabs = [
    { id: 'brand', label: 'Brand colours' },
    { id: 'type',  label: 'Typography' },
    { id: 'assets', label: 'Assets' },
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

  const [templates, setTemplates] = React.useState(() => {
    const presets = window.AutoDeckTemplatePresets?.presets || {};
    const entries = Object.values(presets);
    if (!entries.length) {
      return [{ id: 'preset-professional', name: 'Professional preset', date: 'Built-in', layouts: 4, active: true, locked: true }];
    }
    return entries.map((preset, index) => ({
      id: `preset-${preset.id}`,
      name: `${preset.label} preset`,
      date: 'Built-in',
      layouts: preset.layoutSet?.length || 0,
      active: index === 0,
      locked: true,
      description: preset.description,
    }));
  });
  const [nextTplId, setNextTplId] = React.useState(100);
  const tplInputRef = React.useRef(null);

  const handleTplUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newTpl = { id: nextTplId, name: file.name, date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), layouts: 0, active: false, locked: false };
    setTemplates(p => [...p, newTpl]);
    setNextTplId(n => n + 1);
    e.target.value = '';
  };

  const setActiveTemplate = (id) => setTemplates(p => p.map(t => ({ ...t, active: t.id === id })));
  const deleteTemplate    = (id) => setTemplates(p => {
    const remaining = p.filter(t => t.id !== id || t.locked);
    if (remaining.length && !remaining.some(t => t.active)) remaining[0].active = true;
    return remaining;
  });

  const [displayFont, setDisplayFont] = React.useState(() => {
    if (brandConfig?.displayFont) return FONTS.find(f => f.family === brandConfig.displayFont) || FONTS[0];
    return FONTS[0];
  });
  const [bodyFont, setBodyFont] = React.useState(() => {
    if (brandConfig?.bodyFont) return FONTS.find(f => f.family === brandConfig.bodyFont) || FONTS[1];
    return FONTS[1];
  });
  const [fontSaved, setFontSaved] = React.useState(false);

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

  const [swatchHovered, setSwatchHovered] = React.useState(null);

  const updateColor      = (id, value) => setColorRows(p => p.map(r => r.id === id ? { ...r, value, label: value.toUpperCase() } : r));
  const updateColorLabel = (id, label) => setColorRows(p => p.map(r => r.id === id ? { ...r, label } : r));
  const deleteColor = (id) => setColorRows(p => p.filter(r => r.id !== id));
  const addColor = () => {
    setColorRows(p => [...p, { id: nextId, label: 'New colour', role: 'Custom role', value: '#888888' }]);
    setNextId(n => n + 1);
  };
  const colorsFromRows = (rows) => {
    const find = (...needles) => {
      const row = rows.find((r) => {
        const haystack = `${r.label || ''} ${r.role || ''}`.toLowerCase();
        return needles.some((needle) => haystack.includes(needle));
      });
      return row?.value;
    };
    const primary = find('primary') || rows[0]?.value || '#5F2A91';
    return {
      primary,
      secondary: find('secondary') || rows[1]?.value || primary,
      accent: find('accent', 'lime', 'cta') || '#D4FF3F',
      lime: find('lime') || '#D4FF3F',
      bgDark: find('dark canvas', 'dark') || '#0F031F',
      bgLight: find('light canvas', 'light') || '#F6F1FB',
    };
  };

  React.useEffect(() => {
    setBrandAssets(normalizeBrandAssetRows(brandConfig?.brandAssets));
  }, [JSON.stringify(brandConfig?.brandAssets || [])]);

  const updateAsset = (id, patch) => {
    setBrandAssets((prev) => prev.map((asset) => asset.id === id ? { ...asset, ...patch } : asset));
  };

  const deleteAsset = (id) => setBrandAssets((prev) => prev.filter((asset) => asset.id !== id));

  const resetAssetDraft = () => {
    setAssetName('');
    setAssetUrl('');
    setAssetUsage('');
    setAssetKind('logo');
    setAssetKindTouched(false);
  };

  const addAssetFromUrl = () => {
    const normalized = normalizeBrandAssetUrlForAdmin(assetUrl);
    if (!normalized.url) {
      setAssetError('Paste a valid asset link first.');
      return;
    }
    setBrandAssets((prev) => [
      ...prev,
      {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: assetName.trim() || `Brand asset ${prev.length + 1}`,
        kind: assetKind,
        url: normalized.url,
        sourceUrl: normalized.sourceUrl,
        sourceType: normalized.sourceType,
        usage: assetUsage.trim(),
        fileName: '',
        storagePath: '',
        addedAt: new Date().toISOString(),
      },
    ]);
    setAssetError('');
    resetAssetDraft();
  };

  const uploadBrandAssetFile = async (file) => {
    if (!file) return;
    const uid = window.firebaseAuth?.currentUser?.uid;
    if (!uid || !window.firebaseStorage) {
      setAssetError('Sign in as an admin to upload brand assets.');
      return;
    }
    setAssetUploading(true);
    setAssetError('');
    const safeName = safeBrandAssetFileName(file.name);
    const storagePath = `brand-assets/${uid}/${Date.now()}_${safeName}`;
    try {
      const ref = window.firebaseStorage.ref(storagePath);
      const snap = await ref.put(file);
      const url = await snap.ref.getDownloadURL();
      const inferredKind = inferBrandAssetKind(file);
      setBrandAssets((prev) => [
        ...prev,
        {
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: assetName.trim() || file.name.replace(/\.[^.]+$/, ''),
          kind: assetKindTouched ? assetKind : inferredKind,
          url,
          sourceUrl: url,
          sourceType: 'upload',
          usage: assetUsage.trim(),
          fileName: file.name,
          storagePath,
          addedAt: new Date().toISOString(),
        },
      ]);
      resetAssetDraft();
    } catch (err) {
      setAssetError(err?.message || 'Brand asset upload failed.');
    } finally {
      setAssetUploading(false);
    }
  };

  const saveBrandAssets = () => {
    const cfg = { brandAssets: normalizeBrandAssetRows(brandAssets) };
    onBrandSave && onBrandSave(cfg);
    adminCallFn('saveBrand', { brand: cfg }).catch(() => {});
    setAssetSaved(true);
    setTimeout(() => setAssetSaved(false), 2000);
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
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: qxType.body, color: T.ink, position: 'relative' }}>
      {/* Subtle purple gradient wash at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, background: 'linear-gradient(180deg, rgba(95,42,145,0.06) 0%, transparent 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', padding: '40px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: qxRadius.full, background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.28)', color: '#9A6000', fontFamily: qxType.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 0l1.12 3.45H8.9L6.69 5.58l.85 3.32L5 7.13 2.46 8.9l.85-3.32L1.1 3.45H3.88L5 0z"/></svg>
            Design team only
          </span>
        </div>
        <h1 style={{ fontFamily: qxType.display, fontSize: 42, fontWeight: 500, color: T.ink, margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Brand admin
        </h1>
        <p style={{ fontSize: 15, color: T.inkDim, margin: 0, lineHeight: 1.6 }}>
          Manage Quidax brand configuration and slide templates.
        </p>
      </div>

      <div style={{ display: 'inline-flex', background: T.ghostBg, borderRadius: qxRadius.full, padding: 3, marginBottom: 24, border: `1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: qxRadius.full, border: 'none',
            background: tab === t.id ? T.primary : 'transparent',
            color: tab === t.id ? '#F6F1FB' : T.inkDim,
            fontFamily: qxType.body, fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
            cursor: 'pointer', transition: `all 160ms ${qxEase}`,
            boxShadow: tab === t.id ? '0 2px 10px rgba(95,42,145,0.28)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'brand' && (
        <Card>
          <Eyebrow>Colour palette</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {colorRows.map((row, i) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < colorRows.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <label
                  onMouseEnter={() => setSwatchHovered(row.id)}
                  onMouseLeave={() => setSwatchHovered(null)}
                  style={{ position: 'relative', width: 40, height: 40, borderRadius: qxRadius.sm, background: row.value, border: `1px solid ${T.border}`, cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: `box-shadow 120ms ${qxEase}`, boxShadow: swatchHovered === row.id ? '0 0 0 3px rgba(95,42,145,0.25)' : 'none' }}>
                  <input type="color" value={row.value}
                    onChange={e => updateColor(row.id, e.target.value)}
                    onInput={e => updateColor(row.id, e.target.value)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
                  {swatchHovered === row.id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </label>
                <div style={{ flex: 1 }}>
                  <input
                    value={row.label}
                    onChange={e => updateColorLabel(row.id, e.target.value)}
                    style={{ fontSize: 14, fontWeight: 500, color: T.ink, fontFamily: qxType.body, background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0, marginBottom: 2, cursor: 'text' }}
                  />
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
              const cfg = { colorRows, colors: colorsFromRows(colorRows), voice };
              onBrandSave && onBrandSave(cfg);
              adminCallFn('saveBrand', { brand: cfg }).catch(() => {});
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
            <button onClick={() => {
              const cfg = { displayFont: displayFont.family, bodyFont: bodyFont.family };
              onBrandSave && onBrandSave(cfg);
              adminCallFn('saveBrand', { brand: cfg }).catch(() => {});
              setFontSaved(true); setTimeout(() => setFontSaved(false), 2000);
            }} style={primaryLimeButton()}>
              Save typography
            </button>
          </div>
        </div>
      )}

      {tab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <Eyebrow>Brand assets</Eyebrow>
            <p style={{ fontSize: 14, color: T.inkDim, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 680 }}>
              Add logos, icons, patterns, and source links. Logo assets are stamped into exports; others are available to the editor and generation.
            </p>

            {/* Hidden file input */}
            <input
              ref={assetFileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.ai,.eps,.fig"
              style={{ display: 'none' }}
              onChange={e => { const file = e.target.files?.[0]; if (file) uploadBrandAssetFile(file); e.target.value = ''; }}
            />

            {/* Drag & drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) uploadBrandAssetFile(file); }}
              onClick={() => !assetUploading && assetFileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? T.primary : T.border}`,
                borderRadius: qxRadius.lg,
                background: dragOver ? 'rgba(95,42,145,0.05)' : T.bgElev,
                padding: '36px 24px',
                textAlign: 'center',
                cursor: assetUploading ? 'wait' : 'pointer',
                transition: `all 160ms ${qxEase}`,
                marginBottom: 20,
                userSelect: 'none',
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: qxRadius.lg, background: dragOver ? 'rgba(95,42,145,0.10)' : T.ghostBg, border: `1.5px solid ${dragOver ? T.primary : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', transition: `all 160ms ${qxEase}` }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 13V4M7 7l3-3 3 3M3.5 14.5v1A1.5 1.5 0 005 17h10a1.5 1.5 0 001.5-1.5v-1" stroke={dragOver ? T.primary : T.inkDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {assetUploading ? (
                <div style={{ fontSize: 14, color: T.inkDim, fontWeight: 500 }}>Uploading…</div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: dragOver ? T.primary : T.ink, marginBottom: 4, transition: `color 160ms ${qxEase}` }}>
                    {dragOver ? 'Drop to upload' : 'Drop files here or click to browse'}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.inkMute, fontFamily: qxType.mono, letterSpacing: '0.06em' }}>
                    PNG · JPG · SVG · PDF · AI · EPS · FIG
                  </div>
                </>
              )}
            </div>

            {/* Asset type pills */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: qxType.mono, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 8 }}>Asset type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BRAND_ASSET_KINDS.map(k => (
                  <button key={k.value}
                    onClick={() => { setAssetKind(k.value); setAssetKindTouched(true); }}
                    style={{
                      padding: '5px 13px', borderRadius: qxRadius.full, cursor: 'pointer',
                      border: `1px solid ${assetKind === k.value ? T.primary : T.border}`,
                      background: assetKind === k.value ? T.primary : 'transparent',
                      color: assetKind === k.value ? '#F6F1FB' : T.inkDim,
                      fontSize: 12.5, fontFamily: qxType.body, fontWeight: assetKind === k.value ? 600 : 400,
                      transition: `all 140ms ${qxEase}`,
                    }}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + usage */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, marginBottom: 18 }}>
              <input
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
                placeholder="Asset name"
                style={{ padding: '11px 13px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.bgElev, color: T.ink, fontFamily: qxType.body, fontSize: 13.5, outline: 'none' }}
              />
              <input
                value={assetUsage}
                onChange={e => setAssetUsage(e.target.value)}
                placeholder="Usage hint, e.g. primary logo for every deck, product screenshots"
                style={{ padding: '11px 13px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.bgElev, color: T.ink, fontFamily: qxType.body, fontSize: 13.5, outline: 'none' }}
              />
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <span style={{ fontSize: 11, color: T.inkMute, fontFamily: qxType.mono, letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>or add via link</span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>

            {/* External URL row */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={assetUrl}
                onChange={e => setAssetUrl(e.target.value)}
                placeholder="https://drive.google.com/... or https://..."
                style={{ flex: 1, padding: '11px 13px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.bgElev, color: T.ink, fontFamily: qxType.body, fontSize: 13.5, outline: 'none' }}
              />
              <button
                onClick={addAssetFromUrl}
                style={{ padding: '11px 20px', borderRadius: qxRadius.full, border: `1px solid ${T.border}`, background: T.bgElev, color: T.ink, fontSize: 13, fontFamily: qxType.body, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.ink; }}
              >
                Add link
              </button>
            </div>
            {assetError && <div style={{ marginTop: 10, fontSize: 12.5, color: '#C2410C' }}>{assetError}</div>}
          </Card>

          {/* Asset library */}
          <Card>
            <Eyebrow>Asset library</Eyebrow>
            {brandAssets.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: qxRadius.lg, background: T.ghostBg, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="4.5" width="15" height="12" rx="1.5" stroke={T.inkMute} strokeWidth="1.3"/><path d="M2.5 8.5h15M7 4.5V2.5" stroke={T.inkMute} strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.inkDim, marginBottom: 4 }}>No brand assets yet</div>
                <div style={{ fontSize: 13, color: T.inkMute }}>Upload files or add links above to build your library.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                {brandAssets.map(asset => (
                  <div key={asset.id} style={{ position: 'relative', borderRadius: qxRadius.lg, border: `1px solid ${T.border}`, background: T.bgElev, overflow: 'hidden', transition: `box-shadow 140ms ${qxEase}` }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = qxShadow(tweaks?.darkMode).md; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Thumbnail */}
                    <div style={{
                      height: 120,
                      background: T.ghostBg,
                      backgroundImage: asset.kind !== 'source' ? `url(${asset.url})` : 'none',
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      borderBottom: `1px solid ${T.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {asset.kind === 'source' && (
                        <span style={{ fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.inkMute, background: T.surface, padding: '4px 9px', borderRadius: qxRadius.xs, border: `1px solid ${T.border}` }}>Source file</span>
                      )}
                    </div>

                    {/* Kind badge — top left */}
                    <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: qxRadius.full, background: T.surface, border: `1px solid ${T.border}`, fontFamily: qxType.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.inkMute }}>
                      {asset.kind}
                    </div>

                    {/* Delete button — top right */}
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      title="Delete asset"
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all 120ms ${qxEase}` }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05A5A'; e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = 'rgba(224,90,90,0.07)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = T.surface; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>

                    {/* Card body */}
                    <div style={{ padding: '12px 12px 14px' }}>
                      <input
                        aria-label="Asset name"
                        value={asset.name}
                        onChange={e => updateAsset(asset.id, { name: e.target.value })}
                        placeholder="Asset name"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: qxType.body, fontSize: 13, fontWeight: 600, outline: 'none', marginBottom: 8 }}
                      />
                      <select
                        aria-label="Asset type"
                        value={asset.kind}
                        onChange={e => updateAsset(asset.id, { kind: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: qxType.body, fontSize: 12, outline: 'none', marginBottom: 8 }}
                      >
                        {BRAND_ASSET_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                      <textarea
                        aria-label="Asset description"
                        value={asset.usage || ''}
                        onChange={e => updateAsset(asset.id, { usage: e.target.value })}
                        placeholder="Where should this asset be used?"
                        rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 52, padding: '7px 10px', borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: qxType.body, fontSize: 12, lineHeight: 1.4, outline: 'none' }}
                      />
                      {(asset.fileName || asset.sourceType) && (
                        <div style={{ marginTop: 7, fontFamily: qxType.mono, fontSize: 9, color: T.inkMute, letterSpacing: '0.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.sourceType || 'url'}{asset.fileName ? ` · ${asset.fileName}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 }}>
              {assetSaved && <span style={{ fontSize: 13, color: '#1F8A5B' }}>✓ Saved</span>}
              <button onClick={saveBrandAssets} style={primaryLimeButton()}>Save assets</button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'tpl' && (
        <Card>
          <Eyebrow>Slide templates</Eyebrow>
          <p style={{ fontSize: 14, color: T.inkDim, margin: '0 0 18px', lineHeight: 1.55, maxWidth: 680 }}>
            Source template files can be added later. For now, AutoDeck uses built-in template presets as layout recipes for generation, preview, slideshow, and export.
          </p>

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
                    {tpl.locked ? tpl.date : `Uploaded ${tpl.date}`}{tpl.layouts > 0 ? ` · ${tpl.layouts} layouts` : ''}
                  </div>
                  {tpl.description && (
                    <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 3, whiteSpace: 'normal', lineHeight: 1.35 }}>{tpl.description}</div>
                  )}
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
                {!tpl.locked && <button onClick={() => deleteTemplate(tpl.id)}
                  style={{ width: 32, height: 32, borderRadius: qxRadius.sm, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all 140ms ${qxEase}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05A5A'; e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = 'rgba(224,90,90,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.inkDim; e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>}
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
              adminCallFn('saveBrand', { brand: cfg }).catch(() => {});
              setSaved(true); setTimeout(() => setSaved(false), 2000);
            }} style={primaryLimeButton()}>Save voice</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
Object.assign(window, { AdminScreen });
