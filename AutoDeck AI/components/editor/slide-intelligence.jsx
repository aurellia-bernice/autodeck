// ============================================================
// Slide Intelligence / Visual Storytelling Layer
// Classifies outline slides into visual story templates and
// returns structured metadata for rendering and export.
// ============================================================

(function attachSlideIntelligence(global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.AutoDeckSlideIntelligence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSlideIntelligence() {
  const SLIDE_TYPES = [
    'title_slide',
    'section_break',
    'process_flow',
    'comparison',
    'table_matrix',
    'timeline',
    'statistics',
    'hierarchy',
    'image_focus',
    'roadmap',
    'problem_solution',
    'feature_breakdown',
    'summary',
  ];

  const LEGACY_RENDER_LAYOUTS = ['standard', 'split', 'bigTitle', 'stat', 'quote', 'image', 'minimal', 'centered'];

  const TYPE_CONFIG = {
    title_slide: {
      layout: 'hero_title',
      renderLayout: 'bigTitle',
      visualization: 'title_hero',
      needsIcons: false,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Open with the central takeaway and frame the deck in one strong statement.',
    },
    section_break: {
      layout: 'section_divider',
      renderLayout: 'minimal',
      visualization: 'section_marker',
      needsIcons: false,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Use a quiet divider to reset the audience before the next narrative section.',
    },
    process_flow: {
      layout: 'horizontal_step_flow',
      renderLayout: 'process_flow',
      visualization: 'flowchart',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Show the sequence as a clear step-by-step progression.',
    },
    comparison: {
      layout: 'two_column_comparison',
      renderLayout: 'comparison',
      visualization: 'comparison_table',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Make the contrast explicit so the audience can scan the tradeoffs quickly.',
    },
    table_matrix: {
      layout: 'editable_table_matrix',
      renderLayout: 'table_matrix',
      visualization: 'table_matrix',
      needsIcons: false,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Use an editable table when the content is best scanned across rows and columns.',
    },
    timeline: {
      layout: 'chronological_timeline',
      renderLayout: 'timeline',
      visualization: 'timeline',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Anchor events in time and show how the story progresses chronologically.',
    },
    statistics: {
      layout: 'kpi_card_grid',
      renderLayout: 'statistics',
      visualization: 'kpi_cards',
      needsIcons: false,
      needsChart: true,
      needsImage: false,
      storytellingNote: 'Turn numbers into KPI cards with concise labels and business meaning.',
    },
    hierarchy: {
      layout: 'layered_hierarchy',
      renderLayout: 'hierarchy',
      visualization: 'hierarchy_diagram',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Show levels, ownership, or dependencies as a structured hierarchy.',
    },
    image_focus: {
      layout: 'full_bleed_image_with_caption',
      renderLayout: 'image_focus',
      visualization: 'image_story',
      needsIcons: false,
      needsChart: false,
      needsImage: true,
      storytellingNote: 'Use a strong visual anchor and keep the text as a captioned takeaway.',
    },
    roadmap: {
      layout: 'phased_roadmap',
      renderLayout: 'roadmap',
      visualization: 'roadmap',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Group work into phases so the path forward feels sequenced and owned.',
    },
    problem_solution: {
      layout: 'problem_vs_solution_split',
      renderLayout: 'problem_solution',
      visualization: 'split_story',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Put the tension and answer side by side to make the recommendation obvious.',
    },
    feature_breakdown: {
      layout: 'icon_card_grid',
      renderLayout: 'feature_breakdown',
      visualization: 'feature_cards',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Break capabilities into scannable cards with a clear user or business benefit.',
    },
    summary: {
      layout: 'key_takeaway_cards',
      renderLayout: 'summary',
      visualization: 'takeaway_cards',
      needsIcons: true,
      needsChart: false,
      needsImage: false,
      storytellingNote: 'Close with a small set of memorable takeaways or actions.',
    },
  };

  const VISUAL_LAYOUT_TO_RENDER = Object.fromEntries(
    Object.entries(TYPE_CONFIG).map(([, config]) => [config.layout, config.renderLayout])
  );

  const STOP_PREFIX = /^(users?|customers?|teams?|leaders?|employees?|admins?|the\s+team|the\s+user|the\s+customer|quidax)\s+/i;
  const METRIC_RE = /(?:[$#])?\d+(?:\.\d+)?\s*(?:%|x|\u00d7|m|k|b|bn|usd|ngn|\u20a6|days?|weeks?|months?|years?|users?|customers?|transactions?|revenue|growth|tickets?|hours?|mins?)?/gi;

  const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const lowerText = (value) => compactText(value).toLowerCase();
  const trimWords = (value, maxWords = 12) => compactText(value).split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
  const titleCase = (value) => compactText(value)
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const unique = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = lowerText(typeof item === 'string' ? item : item?.label || item?.value || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const slideText = (slide) => [
    slide?.title,
    slide?.content,
    slide?.kicker,
    slide?.contentType,
    ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
  ].filter(Boolean).join(' ');

  const cleanLabel = (value, maxWords = 8) => {
    let text = compactText(value)
      .replace(/^[\s\-*0-9.)]+/, '')
      .replace(STOP_PREFIX, '')
      .replace(/\b(and|then|finally|first|next|afterward|afterwards)\b/gi, ' ')
      .replace(/\bthrough\s+.+$/i, '')
      .replace(/\bin\s+order\s+to\b/gi, 'to')
      .replace(/[.;:,]+$/g, '')
      .trim();
    text = trimWords(text, maxWords);
    return titleCase(text);
  };

  const iconFor = (value) => {
    const text = lowerText(value);
    if (/social|discover|awareness|channel|media|campaign/.test(text)) return 'social-media';
    if (/sign|signup|register|onboard|account|join|user/.test(text)) return 'user-plus';
    if (/kyc|verify|identity|compliance|risk|secure|security|shield|approve/.test(text)) return 'shield-check';
    if (/fund|wallet|money|cash|deposit|payment|pay|revenue|price|cost/.test(text)) return 'wallet';
    if (/trad(e|ing)|growth|increase|trend|scale|expand|market|performance/.test(text)) return 'trending-up';
    if (/launch|ship|release|rocket|go-live|live/.test(text)) return 'rocket';
    if (/build|feature|product|tool|platform|capability|module/.test(text)) return 'box';
    if (/customer|client|person|people|team|employee|talent|hire/.test(text)) return 'users';
    if (/time|date|quarter|month|week|phase|roadmap|timeline/.test(text)) return 'calendar';
    if (/problem|challenge|pain|issue|gap|blocker/.test(text)) return 'alert-triangle';
    if (/solution|recommend|fix|resolve|mitigation|answer/.test(text)) return 'check-circle';
    if (/data|metric|kpi|number|volume|score|percent|rate/.test(text)) return 'bar-chart';
    if (/decision|ask|next|action|owner|step/.test(text)) return 'check-square';
    if (/image|brand|story|case|photo|visual/.test(text)) return 'image';
    return 'circle-dot';
  };

  const metricsFrom = (value) => {
    const text = compactText(value);
    const matches = [...text.matchAll(METRIC_RE)]
      .map((match) => compactText(match[0]))
      .filter((match) => /\d/.test(match));
    return unique(matches).slice(0, 8);
  };

  const metricCount = (slide) => metricsFrom(slideText(slide)).length;

  const hasAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

  const looksSequential = (slide) => {
    const text = lowerText(slideText(slide));
    const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
    const sequenceWords = /\b(first|second|third|then|next|finally|after|before|step|stage|workflow|journey|process|funnel|flow)\b/;
    const actionWords = /\b(discover|sign up|register|complete|verify|fund|deposit|trade|launch|approve|review|submit|build|ship|convert)\b/;
    return sequenceWords.test(text) || (bullets.length >= 3 && bullets.every((b) => actionWords.test(lowerText(b))));
  };

  const normalizeSlideType = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (SLIDE_TYPES.includes(raw)) return raw;
    if (raw === 'metrics' || raw === 'kpis' || raw === 'statistic') return 'statistics';
    if (raw === 'process' || raw === 'flow' || raw === 'flowchart') return 'process_flow';
    if (raw === 'table' || raw === 'matrix' || raw === 'comparison_table') return 'table_matrix';
    if (raw === 'features') return 'feature_breakdown';
    if (raw === 'image' || raw === 'photo') return 'image_focus';
    return '';
  };

  const classifySlide = (slide, index = 0, total = 1) => {
    const text = lowerText(slideText(slide));
    const title = lowerText(slide?.title);
    const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
    const isFirst = index === 0;
    const isFinal = total > 1 && index === total - 1;

    if (isFirst && hasAny(title, [/^title\b/, /^cover\b/, /^intro\b/, /^welcome\b/])) return 'title_slide';
    if (isFinal && hasAny(text, [/\bsummary\b/, /\brecap\b/, /\btakeaways?\b/, /\bnext steps?\b/, /\basks?\b/, /\bactions?\b/, /\bdecision\b/])) return 'summary';
    if (hasAny(text, [/\bproblem\b.*\bsolution\b/, /\bchallenge\b.*\bmitigation\b/, /\bpain\b.*\banswer\b/])) return 'problem_solution';
    if (hasAny(text, [/\broadmap\b/, /\bphase\s+\d+\b/, /\bnow\s+next\s+later\b/, /\bq[1-4]\b.*\bq[1-4]\b/])) return 'roadmap';
    if (hasAny(text, [/\btimeline\b/, /\bchronolog/, /\b\d{4}\b/, /\bjan(uary)?\b|\bfeb(ruary)?\b|\bmar(ch)?\b|\bapr(il)?\b|\bmay\b|\bjun(e)?\b|\bjul(y)?\b|\baug(ust)?\b|\bsep(t)?\b|\boct(ober)?\b|\bnov(ember)?\b|\bdec(ember)?\b/])) return 'timeline';
    if (hasAny(text, [/\btable\b/, /\bmatrix\b/, /\bpricing\b/, /\bpackages?\b/, /\btiers?\b/, /\bfeature\s+comparison\b/, /\bcolumns?\b/, /\brows?\b/])) return 'table_matrix';
    if (metricCount(slide) >= 2 || hasAny(text, [/\bkpis?\b/, /\bmetrics?\b/, /\bby the numbers\b/, /\bstats?\b/, /\bscore\b/, /\bvolume\b/])) return 'statistics';
    if (hasAny(text, [/\bversus\b/, /\bvs\.?\b/, /\bbefore\b.*\bafter\b/, /\bpros?\b.*\bcons?\b/, /\bcompare\b/, /\btradeoffs?\b/])) return 'comparison';
    if (hasAny(text, [/\bhierarchy\b/, /\borg chart\b/, /\breporting\b/, /\blayers?\b/, /\blevels?\b/, /\bownership\b/, /\broles?\b/])) return 'hierarchy';
    if (looksSequential(slide)) return 'process_flow';
    if (hasAny(text, [/\bfeatures?\b/, /\bcapabilities\b/, /\bmodules?\b/, /\bbenefits?\b/, /\bofferings?\b/, /\bcomponents?\b/])) return 'feature_breakdown';
    if (slide?.imagePrompt || slide?.layout === 'image' || hasAny(text, [/\bimage\b/, /\bphoto\b/, /\bvisual\b/, /\bcase study\b/, /\bcustomer story\b/, /\bbrand\b/])) return 'image_focus';
    if (bullets.length <= 1 && hasAny(text, [/\bsection\b/, /\bpart\s+\d+\b/])) return 'section_break';
    if (isFirst) return 'title_slide';
    if (isFinal) return 'summary';
    return bullets.length >= 3 ? 'feature_breakdown' : 'summary';
  };

  const visualLayoutFor = (slideType, rawLayout) => {
    const raw = String(rawLayout || '').trim();
    if (VISUAL_LAYOUT_TO_RENDER[raw]) return raw;
    return TYPE_CONFIG[slideType]?.layout || TYPE_CONFIG.summary.layout;
  };

  const renderLayoutFor = (slide, slideType) => {
    const explicitVisualTemplate = String(slide?.visualTemplate || '').trim();
    if (explicitVisualTemplate) return explicitVisualTemplate;
    const explicitRenderLayout = String(slide?.renderLayout || '').trim();
    if (explicitRenderLayout && !LEGACY_RENDER_LAYOUTS.includes(explicitRenderLayout)) return explicitRenderLayout;
    const raw = String(slide?.layout || '').trim();
    if (VISUAL_LAYOUT_TO_RENDER[raw]) return VISUAL_LAYOUT_TO_RENDER[raw];
    return TYPE_CONFIG[slideType]?.renderLayout || 'summary';
  };

  const processPartsFrom = (slide) => {
    const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
    const bulletSteps = bullets.map((b) => cleanLabel(b, 6)).filter(Boolean);
    if (bulletSteps.length >= 3) return bulletSteps;

    const firstSentence = compactText(slide?.content || slideText(slide)).split(/[.!?]/)[0] || '';
    const normalized = firstSentence
      .replace(/\s+(and then|then|next|finally)\s+/gi, ', ')
      .replace(/\s*(?:->|\u2192)\s*/g, ', ');
    return unique(normalized.split(/\s*,\s*|\s+\band\b\s+/i)
      .map((part) => {
        const cleaned = cleanLabel(part, 5);
        if (/^Discover\b/i.test(cleaned)) return 'Discover';
        if (/^Sign\s*Up\b/i.test(cleaned)) return 'Sign Up';
        if (/^Complete\s+Kyc\b/i.test(cleaned)) return 'Complete KYC';
        if (/^Fund\s+Wallet\b/i.test(cleaned)) return 'Fund Wallet';
        if (/^Begin\s+Trading\b/i.test(cleaned)) return 'Begin Trading';
        return cleaned;
      })
      .filter((part) => part && part.length > 2)).slice(0, 6);
  };

  const cardComponents = (slide, type = 'card') => {
    const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
    return unique(bullets.map((bullet) => {
      const label = cleanLabel(bullet, 10);
      return label ? { type, label, icon: iconFor(label) } : null;
    }).filter(Boolean)).slice(0, 6);
  };

  const generatedComponents = (slide, slideType) => {
    const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
    if (slideType === 'process_flow') {
      return processPartsFrom(slide).map((label) => ({ type: 'step', label, icon: iconFor(label) }));
    }
    if (slideType === 'statistics') {
      const source = [slide?.title, ...bullets].filter(Boolean);
      const kpis = [];
      source.forEach((item) => {
        metricsFrom(item).forEach((metric) => {
          const label = cleanLabel(String(item).replace(metric, ''), 8) || cleanLabel(slide?.title, 8) || 'Metric';
          kpis.push({ type: 'kpi', value: metric, label, icon: iconFor(label) });
        });
      });
      return unique(kpis).slice(0, 4);
    }
    if (slideType === 'comparison') {
      const left = bullets.filter((b) => /\bbefore\b|\bcurrent\b|\bproblem\b|\bcon\b|\brisk\b/i.test(b));
      const right = bullets.filter((b) => /\bafter\b|\bfuture\b|\bsolution\b|\bpro\b|\bbenefit\b/i.test(b));
      return [
        { type: 'comparison_column', label: 'Current', icon: 'alert-triangle', items: (left.length ? left : bullets.slice(0, Math.ceil(bullets.length / 2))).map((b) => cleanLabel(b, 10)) },
        { type: 'comparison_column', label: 'Future', icon: 'check-circle', items: (right.length ? right : bullets.slice(Math.ceil(bullets.length / 2))).map((b) => cleanLabel(b, 10)) },
      ];
    }
    if (slideType === 'table_matrix') {
      return [
        { type: 'table_column', label: 'Item', icon: 'table', items: bullets.map((_, i) => `Point ${i + 1}`) },
        { type: 'table_column', label: cleanLabel(slide?.title, 6) || 'Detail', icon: 'list', items: bullets.map((b) => cleanLabel(b, 14)) },
      ];
    }
    if (slideType === 'problem_solution') {
      const problem = bullets.find((b) => /\bproblem|challenge|risk|gap|pain|issue|barrier\b/i.test(b)) || bullets[0] || 'Problem to solve';
      const solution = bullets.find((b) => /\bsolution|recommend|mitigat|resolve|fix|answer|path\b/i.test(b)) || bullets[1] || 'Recommended solution';
      return [
        { type: 'problem', label: cleanLabel(problem, 12), icon: 'alert-triangle' },
        { type: 'solution', label: cleanLabel(solution, 12), icon: 'check-circle' },
      ];
    }
    if (slideType === 'timeline' || slideType === 'roadmap') {
      return unique((bullets.length ? bullets : [slide?.title]).map((bullet, i) => {
        const phaseMatch = compactText(bullet).match(/\b(Q[1-4]|H[12]|Phase\s+\d+|20\d{2}|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
        return {
          type: slideType === 'roadmap' ? 'phase' : 'milestone',
          label: phaseMatch ? phaseMatch[0] : `${slideType === 'roadmap' ? 'Phase' : 'Moment'} ${i + 1}`,
          detail: cleanLabel(String(bullet).replace(phaseMatch?.[0] || '', ''), 12) || cleanLabel(bullet, 12),
          icon: iconFor(bullet),
        };
      })).slice(0, 6);
    }
    if (slideType === 'hierarchy') {
      return unique((bullets.length ? bullets : [slide?.title]).map((bullet, i) => ({
        type: 'node',
        label: cleanLabel(bullet, 9),
        level: Math.min(3, i + 1),
        icon: iconFor(bullet),
      }))).slice(0, 6);
    }
    if (slideType === 'image_focus') {
      return [{
        type: 'image_prompt',
        label: cleanLabel(slide?.imagePrompt || slide?.title || 'Visual focus', 10),
        icon: 'image',
      }];
    }
    if (slideType === 'title_slide' || slideType === 'section_break') {
      return [{ type: 'headline', label: cleanLabel(slide?.title, 10), icon: iconFor(slide?.title) }];
    }
    if (slideType === 'summary') return cardComponents(slide, 'takeaway');
    return cardComponents(slide, 'feature');
  };

  const normalizeComponent = (component, slideType) => {
    if (!component || typeof component !== 'object') return null;
    const type = compactText(component.type || (slideType === 'process_flow' ? 'step' : 'card')) || 'card';
    const label = cleanLabel(component.label || component.title || component.name || component.value || '', 12);
    if (!label && !component.value) return null;
    const next = {
      ...component,
      type,
      label: label || compactText(component.value),
      icon: compactText(component.icon || iconFor(label || component.value)),
    };
    if (Array.isArray(component.items)) {
      next.items = component.items.map((item) => cleanLabel(item, 10)).filter(Boolean).slice(0, 5);
    }
    if (component.value !== undefined) next.value = compactText(component.value);
    if (component.detail !== undefined) next.detail = cleanLabel(component.detail, 12);
    if (component.level !== undefined) next.level = Math.max(1, Math.min(4, parseInt(component.level, 10) || 1));
    return next;
  };

  const enhanceSlide = (slide = {}, index = 0, total = 1) => {
    const slideType = normalizeSlideType(slide.slideType) || classifySlide(slide, index, total);
    const config = TYPE_CONFIG[slideType] || TYPE_CONFIG.summary;
    const layout = visualLayoutFor(slideType, slide.layout);
    const renderLayout = renderLayoutFor(slide, slideType);
    const rawComponents = Array.isArray(slide.components) ? slide.components : [];
    const normalizedComponents = rawComponents
      .map((component) => normalizeComponent(component, slideType))
      .filter(Boolean);
    const components = (normalizedComponents.length ? normalizedComponents : generatedComponents(slide, slideType))
      .map((component) => normalizeComponent(component, slideType))
      .filter(Boolean)
      .slice(0, 6);

    return {
      ...slide,
      slideType,
      layout,
      visualLayout: layout,
      renderLayout,
      visualization: compactText(slide.visualization || config.visualization),
      needsIcons: typeof slide.needsIcons === 'boolean' ? slide.needsIcons : config.needsIcons,
      needsChart: typeof slide.needsChart === 'boolean' ? slide.needsChart : config.needsChart,
      needsImage: typeof slide.needsImage === 'boolean' ? slide.needsImage : config.needsImage,
      components,
      storytellingNote: compactText(slide.storytellingNote || config.storytellingNote),
    };
  };

  const enhanceSlides = (slides = []) => Array.isArray(slides)
    ? slides.map((slide, index) => enhanceSlide(slide, index, slides.length))
    : [];

  return {
    SLIDE_TYPES,
    TYPE_CONFIG,
    LEGACY_RENDER_LAYOUTS,
    VISUAL_LAYOUT_TO_RENDER,
    classifySlide,
    enhanceSlide,
    enhanceSlides,
    iconFor,
    metricsFrom,
  };
});
