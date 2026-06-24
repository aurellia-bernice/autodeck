const trimWords = (value, maxWords) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, maxWords)
  .join(' ');

const resolveSlideCount = (slideCount, content, wordCount) => {
  const explicit = parseInt(slideCount, 10);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(3, Math.min(20, explicit));

  const words = wordCount(content);
  if (words < 350) return 5;
  if (words < 800) return 8;
  if (words < 1400) return 10;
  if (words < 2400) return 12;
  return 15;
};

const normalizeLayout = (value, fallback = 'standard') => {
  const allowed = new Set([
    'standard', 'split', 'bigTitle', 'stat', 'quote', 'image', 'minimal', 'centered',
    'process_flow', 'comparison', 'table_matrix', 'timeline', 'statistics', 'hierarchy', 'image_focus',
    'roadmap', 'problem_solution', 'feature_breakdown', 'summary',
  ]);
  const layout = String(value || '').trim();
  if (allowed.has(layout)) return layout;
  const alias = layout.toLowerCase().replace(/[_/-]+/g, ' ').replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = {
    'big title': 'bigTitle',
    bigtitle: 'bigTitle',
    bold: 'bigTitle',
    'bold title': 'bigTitle',
    headline: 'bigTitle',
    'image led': 'image',
    photo: 'image',
    flow: 'process_flow',
    'process flow': 'process_flow',
    process: 'process_flow',
    compare: 'comparison',
    table: 'table_matrix',
    matrix: 'table_matrix',
    'table matrix': 'table_matrix',
    'comparison table': 'table_matrix',
    kpi: 'statistics',
    metrics: 'statistics',
    'image focus': 'image_focus',
    'problem solution': 'problem_solution',
    'problem and solution': 'problem_solution',
    'problem vs solution': 'problem_solution',
    features: 'feature_breakdown',
    'feature breakdown': 'feature_breakdown',
    takeaways: 'summary',
    recap: 'summary',
  };
  return aliases[alias] || fallback;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (/^(true|yes|1)$/i.test(value.trim())) return true;
    if (/^(false|no|0)$/i.test(value.trim())) return false;
  }
  return fallback;
};

const normalizeVisualString = (value, maxWords = 8) => trimWords(value, maxWords)
  .toLowerCase()
  .replace(/[^a-z0-9_ -]+/g, '')
  .replace(/[\s-]+/g, '_');

const normalizeComponents = (components) => {
  if (!Array.isArray(components)) return [];
  return components
    .filter((component) => component && typeof component === 'object')
    .slice(0, 8)
    .map((component) => ({
      ...component,
      type: normalizeVisualString(component.type || 'card', 4) || 'card',
      label: trimWords(component.label || component.title || component.name || component.value, 12),
      icon: normalizeVisualString(component.icon || '', 4),
      value: component.value === undefined ? undefined : trimWords(component.value, 6),
      detail: component.detail === undefined ? undefined : trimWords(component.detail, 18),
      items: Array.isArray(component.items)
        ? component.items.map((item) => trimWords(item, 14)).filter(Boolean).slice(0, 5)
        : undefined,
      level: component.level === undefined ? undefined : Math.max(1, Math.min(4, parseInt(component.level, 10) || 1)),
    }))
    .filter((component) => component.label || component.value || component.items?.length);
};

const hasUsableMetric = (value) =>
  /\b\d+(?:\.\d+)?\s*(%|x|×|m|k|b|bn|usd|\$|₦|days?|weeks?|months?|years?|users?|customers?|transactions?|revenue|growth|tickets?|hours?|mins?)\b/i.test(String(value || ''));

const createSlideNormalizer = ({
  SlideIntelligence,
  SlideObjects,
  isNoisySourceUnit,
  sourceUnitKey,
}) => (slides, count) => {
  if (!Array.isArray(slides)) return [];
  const normalized = slides
    .map((slide) => {
      const title = trimWords(slide?.title, 12).replace(/^[^A-Za-z0-9$]+/, '').replace(/[.!?]+$/, '');
      const bullets = Array.isArray(slide?.bullets)
        ? slide.bullets
            .map((bullet) => trimWords(bullet, 26).replace(/^[^A-Za-z0-9$]+/, '').trim())
            .filter((bullet) => !isNoisySourceUnit(bullet))
            .filter(Boolean)
            .slice(0, 4)
        : [];
      const rawLayout = String(slide?.layout || slide?.visualLayout || '').trim();
      const legacyRenderLayout = normalizeLayout(slide?.renderLayout || slide?.visualTemplate, '');
      let renderLayout = legacyRenderLayout;
      if (renderLayout === 'stat' && !hasUsableMetric([title, ...bullets].join(' '))) renderLayout = 'standard';
      return {
        title,
        bullets,
        layout: rawLayout || renderLayout || 'standard',
        renderLayout,
        slideType: normalizeVisualString(slide?.slideType, 3),
        visualization: normalizeVisualString(slide?.visualization, 4),
        needsIcons: normalizeBoolean(slide?.needsIcons, false),
        needsChart: normalizeBoolean(slide?.needsChart, false),
        needsImage: normalizeBoolean(slide?.needsImage, false),
        components: normalizeComponents(slide?.components),
        storytellingNote: trimWords(slide?.storytellingNote, 28),
        contentType: trimWords(slide?.contentType || slide?.kicker || 'section', 4).toLowerCase(),
        kicker: trimWords(slide?.kicker || slide?.contentType || 'Section', 4),
        speakerNotes: trimWords(slide?.speakerNotes, 60),
        imagePrompt: trimWords(slide?.imagePrompt, 24),
      };
    })
    .filter((slide) => slide.title && !isNoisySourceUnit(slide.title) && slide.bullets.length >= 2)
    .map((slide, index) => ({ ...slide, index }));

  const seenTitles = new Set();
  const uniqueSlides = [];
  normalized.forEach((slide) => {
    let nextSlide = slide;
    let titleKey = sourceUnitKey(nextSlide.title);

    if (seenTitles.has(titleKey)) {
      const replacement = nextSlide.bullets
        .map((bullet) => trimWords(bullet, 10).replace(/^[^A-Za-z0-9$]+/, '').replace(/[.!?]+$/, ''))
        .find((bullet) => bullet && !seenTitles.has(sourceUnitKey(bullet)) && !isNoisySourceUnit(bullet));
      if (replacement) {
        nextSlide = { ...nextSlide, title: replacement };
        titleKey = sourceUnitKey(replacement);
      }
    }

    if (!titleKey || seenTitles.has(titleKey)) return;
    seenTitles.add(titleKey);
    uniqueSlides.push(nextSlide);
  });

  const enhanced = SlideIntelligence.enhanceSlides(uniqueSlides
    .map(({ index, ...slide }) => slide)
    .slice(0, count));
  return SlideObjects.ensureSlidesObjects(enhanced);
};

module.exports = {
  createSlideNormalizer,
  hasUsableMetric,
  normalizeBoolean,
  normalizeComponents,
  normalizeLayout,
  normalizeVisualString,
  resolveSlideCount,
  trimWords,
};
