// ============================================================
// Template presets
// Temporary source-of-truth until real Quidax template files are available.
// These presets act like layout recipes: generation, preview, slideshow,
// and export can all read the same defaults.
// ============================================================

const AutoDeckTemplatePresets = (() => {
  const allowedLayouts = ['standard', 'split', 'bigTitle', 'stat', 'quote', 'image', 'minimal', 'centered'];

  const presets = {
    professional: {
      id: 'professional',
      label: 'Professional',
      description: 'Executive-ready Quidax deck with clear sections and controlled density.',
      theme: 'purple',
      defaultLayout: 'standard',
      layoutSet: ['bigTitle', 'standard', 'split', 'stat', 'quote', 'minimal'],
      layoutSequence: ['bigTitle', 'standard', 'split', 'stat', 'standard', 'quote', 'split', 'minimal'],
      voiceKey: 'professional',
      tone: 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.',
      slideDensity: 'balanced',
      imageStyle: 'clean business photography or simple product-context imagery',
      titleRule: 'Open with the main takeaway, then organize supporting sections logically.',
      closingRule: 'End with decisions, asks, owners, or next steps when the source supports them.',
      lockedSections: ['brandMark', 'footer', 'confidentiality'],
      variables: ['deckTitle', 'audience', 'department', 'date'],
    },
    minimal: {
      id: 'minimal',
      label: 'Minimal',
      description: 'Sparse slides with short titles, calm pacing, and fewer points per slide.',
      theme: 'soft',
      defaultLayout: 'minimal',
      layoutSet: ['minimal', 'centered', 'standard', 'split'],
      layoutSequence: ['minimal', 'centered', 'standard', 'split', 'minimal', 'standard'],
      voiceKey: 'minimal',
      tone: 'Concise and restrained. Use fewer words, simple structure, and no decorative filler.',
      slideDensity: 'concise',
      imageStyle: 'light, uncluttered imagery only when it adds context',
      titleRule: 'Use short, useful titles and give each idea room to breathe.',
      closingRule: 'End with a short action list or a single clear recommendation.',
      lockedSections: ['brandMark', 'footer'],
      variables: ['deckTitle', 'audience', 'date'],
    },
    bold: {
      id: 'bold',
      label: 'Bold',
      description: 'Punchy narrative with strong headlines, stat-led moments, and sharper contrast.',
      theme: 'rose',
      defaultLayout: 'bigTitle',
      layoutSet: ['bigTitle', 'stat', 'split', 'quote', 'standard'],
      layoutSequence: ['bigTitle', 'stat', 'split', 'quote', 'bigTitle', 'standard', 'stat'],
      voiceKey: 'bold',
      tone: 'Punchy and direct. Short sentences, strong verbs, clear implications, no inflated claims.',
      slideDensity: 'concise',
      imageStyle: 'high-contrast product, market, or people imagery with a strong focal point',
      titleRule: 'Lead each slide with a sharp claim, not a label.',
      closingRule: 'End with a direct recommendation, decision, or ask.',
      lockedSections: ['brandMark', 'footer', 'confidentiality'],
      variables: ['deckTitle', 'audience', 'metric', 'date'],
    },
    fun: {
      id: 'fun',
      label: 'Fun',
      description: 'Warm, energetic slides for team updates, onboarding, and internal recaps.',
      theme: 'ocean',
      defaultLayout: 'image',
      layoutSet: ['image', 'split', 'quote', 'centered', 'standard'],
      layoutSequence: ['image', 'split', 'quote', 'centered', 'standard', 'image'],
      voiceKey: 'fun',
      tone: 'Warm, human, and upbeat while staying concrete. Avoid jokes that weaken clarity.',
      slideDensity: 'balanced',
      imageStyle: 'bright team, customer, product, or workplace imagery',
      titleRule: 'Use friendly titles that still explain the point of the slide.',
      closingRule: 'End with energizing but concrete next steps.',
      lockedSections: ['brandMark', 'footer'],
      variables: ['deckTitle', 'audience', 'team', 'date'],
    },
  };

  const normalizeTemplateStyle = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'professional';
    const compact = raw.replace(/[^a-z0-9]+/g, '');
    return Object.keys(presets).find((id) => id === compact || presets[id].label.toLowerCase() === raw) || 'professional';
  };

  const getTemplatePreset = (value) => presets[normalizeTemplateStyle(value)];
  const getTemplateOptions = () => Object.values(presets).map((preset) => preset.label);
  const isAllowedLayout = (layout) => allowedLayouts.includes(layout);

  const resolveTemplateLayout = (slide, index, templateStyle) => {
    const preset = getTemplatePreset(templateStyle);
    const requested = String(slide?.layout || '').trim();
    if (isAllowedLayout(requested) && preset.layoutSet.includes(requested)) return requested;
    if (isAllowedLayout(requested)) return requested;
    return preset.layoutSequence[index % preset.layoutSequence.length] || preset.defaultLayout;
  };

  const resolveTemplateTheme = (slide, templateStyle) => {
    const preset = getTemplatePreset(templateStyle);
    return String(slide?.theme || preset.theme || 'purple').trim();
  };

  const contentTypeToKicker = (contentType) => {
    const cleaned = String(contentType || '').replace(/[-_]+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const enhanceSlide = (slide, index, templateStyle) => {
    const preset = getTemplatePreset(templateStyle);
    return {
      ...slide,
      templatePresetId: preset.id,
      templateStyle: preset.label,
      layout: resolveTemplateLayout(slide, index, preset.id),
      theme: resolveTemplateTheme(slide, preset.id),
      contentType: slide?.contentType || 'section',
      kicker: slide?.kicker || contentTypeToKicker(slide?.contentType) || (index === 0 ? 'Opening' : 'Section'),
    };
  };

  const enhanceSlides = (slides, templateStyle) => {
    if (!Array.isArray(slides)) return [];
    return slides.map((slide, index) => enhanceSlide(slide, index, templateStyle));
  };

  const summarizeForPrompt = (templateStyle) => {
    const preset = getTemplatePreset(templateStyle);
    return {
      id: preset.id,
      label: preset.label,
      tone: preset.tone,
      slideDensity: preset.slideDensity,
      imageStyle: preset.imageStyle,
      allowedLayouts: preset.layoutSet,
      layoutSequence: preset.layoutSequence,
      titleRule: preset.titleRule,
      closingRule: preset.closingRule,
      lockedSections: preset.lockedSections,
      variables: preset.variables,
    };
  };

  return {
    allowedLayouts,
    presets,
    normalizeTemplateStyle,
    getTemplatePreset,
    getTemplateOptions,
    isAllowedLayout,
    resolveTemplateLayout,
    resolveTemplateTheme,
    enhanceSlide,
    enhanceSlides,
    summarizeForPrompt,
  };
})();

Object.assign(window, { AutoDeckTemplatePresets });
