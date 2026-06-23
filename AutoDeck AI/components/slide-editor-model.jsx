// ============================================================
// Slide editor model helpers
// Pure data/helpers used by SlideGenerator.
// ============================================================

const AutoDeckSlideEditorModel = (() => {
  const DEMO_SLIDES = [
    { title: 'Q2 Sales Strategy', renderLayout: 'standard', bullets: ['Strong Q2 performance across all verticals', 'New markets entered: Ghana, Senegal', 'Revenue up 34% YoY'] },
    { title: 'Market Overview', renderLayout: 'image', imagePrompt: 'African fintech team reviewing product growth dashboard', needsImage: true, bullets: ['Africa crypto market growing at 18% CAGR', 'Quidax positioned in top 3 exchanges', 'User base crossed 2M milestone'] },
    { title: 'Pricing And Feature Matrix', renderLayout: 'table_matrix', slideType: 'table_matrix', bullets: ['Starter package covers essentials', 'Growth package adds automation', 'Enterprise package includes dedicated support'] },
  ];

  const LAYOUTS = [
    { key: 'standard', name: 'Standard', desc: 'Title + body' },
    { key: 'split', name: 'Split', desc: 'Two zones' },
    { key: 'bigTitle', name: 'Bold', desc: 'Oversized title' },
    { key: 'stat', name: 'Stat', desc: 'Hero number' },
    { key: 'quote', name: 'Quote', desc: 'Pull quote' },
    { key: 'image', name: 'Image-led', desc: 'Image + text' },
    { key: 'minimal', name: 'Minimal', desc: 'Title only' },
    { key: 'centered', name: 'Centered', desc: 'Centered message' },
    { key: 'process_flow', name: 'Flow', desc: 'Steps' },
    { key: 'comparison', name: 'Compare', desc: 'Two sides' },
    { key: 'table_matrix', name: 'Table', desc: 'Editable rows' },
    { key: 'timeline', name: 'Timeline', desc: 'Chronology' },
    { key: 'statistics', name: 'KPI cards', desc: 'Numbers' },
    { key: 'hierarchy', name: 'Hierarchy', desc: 'Levels' },
    { key: 'roadmap', name: 'Roadmap', desc: 'Phases' },
    { key: 'problem_solution', name: 'Problem/Solution', desc: 'Tension + answer' },
    { key: 'feature_breakdown', name: 'Features', desc: 'Cards' },
    { key: 'summary', name: 'Summary', desc: 'Takeaways' },
    { key: 'image_focus', name: 'Image focus', desc: 'Full bleed image' },
  ];

  const deriveBrandColors = (brandConfig) => {
    if (brandConfig?.colors?.primary) return brandConfig.colors;
    if (!Array.isArray(brandConfig?.colorRows)) return null;
    const find = (...needles) => {
      const row = brandConfig.colorRows.find((r) => {
        const haystack = `${r.label || ''} ${r.role || ''}`.toLowerCase();
        return needles.some((needle) => haystack.includes(needle));
      });
      return row?.value;
    };
    const primary = find('primary') || brandConfig.colorRows[0]?.value;
    if (!primary) return null;
    return {
      primary,
      secondary: find('secondary') || brandConfig.colorRows[1]?.value || primary,
      accent: find('accent', 'lime', 'cta') || QX.lime,
      lime: find('lime') || QX.lime,
      bgDark: find('dark canvas', 'dark') || '#0F031F',
      bgLight: find('light canvas', 'light') || '#F6F1FB',
    };
  };

  const buildThemes = (customTheme) => ({
    ...(customTheme ? { custom: customTheme } : {}),
    purple:   { name: 'Quidax',   swatch: '#7B2FBE', gradient: 'linear-gradient(155deg,#1A0530 0%,#2D0F4E 50%,#451B6E 100%)', title: '#F6F1FB', text: 'rgba(246,241,251,0.78)', accent: QX.lime, rule: 'rgba(246,241,251,0.18)' },
    midnight: { name: 'Midnight', swatch: '#312E81', gradient: 'linear-gradient(155deg,#0F0A24 0%,#1E1B4B 55%,#312E81 100%)', title: '#F5F3FF', text: 'rgba(245,243,255,0.80)', accent: '#A5B4FC', rule: 'rgba(245,243,255,0.18)' },
    soft:     { name: 'Soft',     swatch: '#E9D5FF', gradient: 'linear-gradient(155deg,#FAF5FF 0%,#F3E8FF 55%,#FCE7F3 100%)', title: '#1A0530', text: 'rgba(26,5,48,0.72)', accent: '#7B2FBE', rule: 'rgba(26,5,48,0.18)' },
    ocean:    { name: 'Ocean',    swatch: '#0369A1', gradient: 'linear-gradient(155deg,#0C2B4E 0%,#0369A1 55%,#0891B2 100%)', title: '#F0F9FF', text: 'rgba(240,249,255,0.80)', accent: '#7DD3FC', rule: 'rgba(240,249,255,0.20)' },
    forest:   { name: 'Forest',   swatch: '#065F46', gradient: 'linear-gradient(155deg,#022C22 0%,#065F46 55%,#047857 100%)', title: '#ECFDF5', text: 'rgba(236,253,245,0.80)', accent: '#6EE7B7', rule: 'rgba(236,253,245,0.20)' },
    rose:     { name: 'Rose',     swatch: '#BE123C', gradient: 'linear-gradient(155deg,#4C0519 0%,#881337 55%,#BE123C 100%)', title: '#FFF1F2', text: 'rgba(255,241,242,0.82)', accent: '#FECACA', rule: 'rgba(255,241,242,0.20)' },
  });

  const pptFontName = (family, fallback, role = 'body') => {
    const raw = String(family || fallback || '').split(',')[0].replace(/['"]/g, '').trim();
    const name = raw || (role === 'display' ? 'Aptos Display' : 'Aptos');
    const lower = name.toLowerCase();
    const safe = ['aptos', 'aptos display', 'arial', 'verdana', 'georgia', 'calibri', 'segoe ui', 'times new roman'];
    if (safe.includes(lower)) return name;
    if (['playfair display', 'lora'].includes(lower) || lower.includes('serif')) return 'Georgia';
    return role === 'display' ? 'Aptos Display' : 'Aptos';
  };

  return {
    DEMO_SLIDES,
    LAYOUTS,
    buildThemes,
    deriveBrandColors,
    pptFontName,
  };
})();

if (typeof window !== 'undefined') {
  window.AutoDeckSlideEditorModel = AutoDeckSlideEditorModel;
}
