// ============================================================
// Template presets
// Temporary source-of-truth until real Quidax template files are available.
// These presets act like layout recipes: generation, preview, slideshow,
// and export can all read the same defaults.
// ============================================================

const AutoDeckTemplatePresets = (() => {
  const legacyLayouts = ['standard', 'split', 'bigTitle', 'stat', 'quote', 'image', 'minimal', 'centered'];
  const intelligentLayouts = [
    'process_flow',
    'comparison',
    'timeline',
    'statistics',
    'hierarchy',
    'image_focus',
    'roadmap',
    'problem_solution',
    'feature_breakdown',
    'summary',
  ];
  const allowedLayouts = [...legacyLayouts, ...intelligentLayouts];

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
  const visualLayoutToRender = () => window.AutoDeckSlideIntelligence?.VISUAL_LAYOUT_TO_RENDER || {};
  const typeConfig = () => window.AutoDeckSlideIntelligence?.TYPE_CONFIG || {};
  const isAllowedLayout = (layout) => allowedLayouts.includes(layout);

  const hasUsableMetric = (slide) => {
    const text = [
      slide?.title,
      ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
    ].filter(Boolean).join(' ');
    return /\b\d+(?:\.\d+)?\s*(%|x|×|m|k|b|bn|usd|\$|₦|days?|weeks?|months?|years?|users?|customers?|transactions?|revenue|growth|tickets?|hours?|mins?)\b/i.test(text);
  };

  const fallbackLayout = (preset, index, blockedLayout) => {
    const sequence = preset.layoutSequence?.length ? preset.layoutSequence : preset.layoutSet;
    for (let offset = 0; offset < sequence.length; offset += 1) {
      const candidate = sequence[(index + offset) % sequence.length];
      if (candidate !== blockedLayout && isAllowedLayout(candidate) && preset.layoutSet.includes(candidate)) {
        return candidate;
      }
    }
    return preset.defaultLayout === blockedLayout ? 'standard' : preset.defaultLayout;
  };

  const resolveTemplateLayout = (slide, index, templateStyle) => {
    const preset = getTemplatePreset(templateStyle);
    const requested = String(slide?.layout || '').trim();
    const mappedVisualLayout = visualLayoutToRender()[requested];
    if (isAllowedLayout(mappedVisualLayout)) return mappedVisualLayout;
    const typeRenderLayout = typeConfig()[slide?.slideType]?.renderLayout;
    if (isAllowedLayout(typeRenderLayout)) return typeRenderLayout;

    const explicitRender = String(slide?.renderLayout || slide?.visualTemplate || '').trim();
    if (isAllowedLayout(explicitRender)) return explicitRender;

    if (requested === 'stat' && !hasUsableMetric(slide)) return fallbackLayout(preset, index, 'stat');
    if (isAllowedLayout(requested) && preset.layoutSet.includes(requested)) return requested;
    if (isAllowedLayout(requested)) return requested;
    const sequenced = preset.layoutSequence[index % preset.layoutSequence.length] || preset.defaultLayout;
    if (sequenced === 'stat' && !hasUsableMetric(slide)) return fallbackLayout(preset, index + 1, 'stat');
    return sequenced;
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
    const intelligentSlide = window.AutoDeckSlideIntelligence?.enhanceSlide
      ? window.AutoDeckSlideIntelligence.enhanceSlide(slide, index)
      : slide;
    const renderLayout = resolveTemplateLayout(intelligentSlide, index, preset.id);
    return {
      ...intelligentSlide,
      templatePresetId: preset.id,
      templateStyle: preset.label,
      layout: intelligentSlide?.layout || intelligentSlide?.visualLayout || renderLayout,
      visualLayout: intelligentSlide?.visualLayout || intelligentSlide?.layout || renderLayout,
      renderLayout,
      theme: resolveTemplateTheme(intelligentSlide, preset.id),
      contentType: intelligentSlide?.contentType || 'section',
      kicker: intelligentSlide?.kicker || contentTypeToKicker(intelligentSlide?.contentType) || (index === 0 ? 'Opening' : 'Section'),
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
      visualSlideTypes: window.AutoDeckSlideIntelligence?.SLIDE_TYPES || [],
      visualLayouts: Object.fromEntries(
        Object.entries(window.AutoDeckSlideIntelligence?.TYPE_CONFIG || {}).map(([type, config]) => [type, config.layout])
      ),
      rendererMappings: Object.fromEntries(
        Object.entries(window.AutoDeckSlideIntelligence?.TYPE_CONFIG || {}).map(([type, config]) => [type, config.renderLayout])
      ),
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
