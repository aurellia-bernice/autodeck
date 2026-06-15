const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin    = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth  = require('mammoth');
const JSZip    = require('jszip');
const pdfParse = require('pdf-parse');
const SlideIntelligence = require('./slide-intelligence');

admin.initializeApp();
const db = admin.firestore();

const AnthropicClient = Anthropic.default || Anthropic;

const MAX_INPUT_CHARS = 8000;
const MAX_SOURCE_CHARS = 20000;
const CALLABLE_CORS_ORIGINS = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  'https://autodeck-ai.web.app',
  'https://autodeck-ai.firebaseapp.com',
];

const callableOptions = (overrides = {}) => ({
  region: 'us-central1',
  cors: CALLABLE_CORS_ORIGINS,
  invoker: 'public',
  ...overrides,
});

const compactText = (value, limit) => String(value || '')
  .replace(/\u0000/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim()
  .slice(0, limit);

const isNoisySourceUnit = (value) => {
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

const dedupeSourceUnits = (units) => {
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

const cleanSourceMaterial = (value, limit) => {
  const compact = compactText(value, limit);
  const units = compact
    .split(/\n+/)
    .flatMap((line) => {
      const normalized = line.replace(/\s+/g, ' ').trim();
      if (!normalized) return [];
      return normalized.length > 260
        ? (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized])
        : [normalized];
    })
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const cleaned = units.filter((unit) => !isNoisySourceUnit(unit));
  return compactText(dedupeSourceUnits(cleaned.length ? cleaned : units).join('\n'), limit);
};

const wordCount = (value) => compactText(value, Number.MAX_SAFE_INTEGER)
  .split(/\s+/)
  .filter(Boolean)
  .length;

const KEYWORD_STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'about', 'into', 'their', 'there', 'where',
  'when', 'what', 'were', 'been', 'being', 'they', 'them', 'than', 'then', 'also', 'should', 'could',
  'would', 'these', 'those', 'because', 'through', 'between', 'within', 'without', 'document', 'presentation',
  'slide', 'slides', 'deck', 'cover',
]);

const keywordsFrom = (value) => {
  const words = String(value || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return [...new Set(words.filter((word) => !KEYWORD_STOP_WORDS.has(word)))].slice(0, 40);
};

const keywordOverlap = (brief, source) => {
  const sourceKeywords = keywordsFrom(source);
  return keywordsFrom(brief).filter((keyword) =>
    sourceKeywords.some((sourceKeyword) => sourceKeyword.includes(keyword) || keyword.includes(sourceKeyword))
  );
};

const sourceFitGuide = (brief, source) => {
  if (!brief || !source) return 'No source-fit warning.';
  const briefKeywords = keywordsFrom(brief);
  if (briefKeywords.length < 3) return 'No source-fit warning.';
  const overlap = keywordOverlap(brief, source);
  if (overlap.length >= Math.min(3, Math.max(1, Math.floor(briefKeywords.length * 0.25)))) {
    return `The brief appears supported by the source. Shared anchors: ${overlap.slice(0, 8).join(', ')}.`;
  }
  return [
    'The brief appears weakly supported by the uploaded source.',
    'Use the brief only as audience/framing intent.',
    'Do not force unsupported investor, metric, runway, funding, product, or decision claims into the deck.',
    'If necessary, state missing source evidence concretely instead of pretending the document contains it.',
  ].join(' ');
};

const resolveSlideCount = (slideCount, content) => {
  const explicit = parseInt(slideCount, 10);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(3, Math.min(20, explicit));

  const words = wordCount(content);
  if (words < 350) return 5;
  if (words < 800) return 8;
  if (words < 1400) return 10;
  if (words < 2400) return 12;
  return 15;
};

const extractJsonArrayText = (raw) => {
  const text = String(raw || '').trim();
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']') + 1;
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Model did not return a JSON array');
  }
  return text.slice(jsonStart, jsonEnd);
};

const parseJsonArrayText = (jsonText) => {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error('Model JSON was not an array');
  return parsed;
};

const repairJsonArrayText = (jsonText) => {
  const knownKeys = [
    'title',
    'slideType',
    'layout',
    'visualization',
    'needsIcons',
    'needsChart',
    'needsImage',
    'contentType',
    'kicker',
    'bullets',
    'components',
    'storytellingNote',
    'speakerNotes',
    'imagePrompt',
    'type',
    'label',
    'icon',
    'value',
    'detail',
    'items',
    'level',
  ].join('|');
  const knownKeyLookahead = new RegExp(`(["}\\]\\d]|true|false|null)\\s+(?="(?:${knownKeys})"\\s*:)`, 'g');

  return String(jsonText || '')
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*{/g, '],{')
    .replace(knownKeyLookahead, '$1,');
};

const extractJsonArray = (raw) => {
  const jsonText = extractJsonArrayText(raw);
  try {
    return parseJsonArrayText(jsonText);
  } catch (firstError) {
    const repairedText = repairJsonArrayText(jsonText);
    if (repairedText !== jsonText) {
      try {
        return parseJsonArrayText(repairedText);
      } catch (repairError) {
        firstError.repairError = repairError.message;
      }
    }
    firstError.jsonChars = jsonText.length;
    throw firstError;
  }
};

const trimWords = (value, maxWords) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, maxWords)
  .join(' ');

const normalizeLayout = (value, fallback = 'standard') => {
  const allowed = new Set(['standard', 'split', 'bigTitle', 'stat', 'quote', 'image', 'minimal', 'centered']);
  const layout = String(value || '').trim();
  return allowed.has(layout) ? layout : fallback;
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

const normalizeSlides = (slides, count) => {
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

  return SlideIntelligence.enhanceSlides(uniqueSlides
    .map(({ index, ...slide }) => slide)
    .slice(0, count));
};

const generationMaxTokens = (count) => Math.min(8000, Math.max(3200, count * 550));

const repairGeneratedSlidesJson = async ({ anthropic, raw, count, parseError }) => {
  const jsonText = extractJsonArrayText(raw);
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: generationMaxTokens(count),
    temperature: 0,
    system: [
      'You repair JSON for AutoDeck AI.',
      'Return only one valid JSON array.',
      'Do not add markdown, comments, or explanatory text.',
      'Preserve the slide content and order as much as possible.',
    ].join(' '),
    messages: [{
      role: 'user',
      content: [
        'The JSON array below was generated for presentation slides but failed to parse.',
        `Parser error: ${parseError.message}`,
        'Repair only the JSON syntax. If a field is incomplete, close it cleanly without inventing unsupported facts.',
        'Return ONLY the repaired JSON array.',
        '',
        jsonText.slice(0, 45000),
      ].join('\n'),
    }],
  });

  return msg.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
};

const parseGeneratedSlides = async ({ anthropic, raw, count, deckId }) => {
  try {
    return {
      slides: normalizeSlides(extractJsonArray(raw), count),
      repaired: false,
      repairRawChars: 0,
    };
  } catch (parseError) {
    logger.warn('generateDeck response parse failed; attempting repair', {
      deckId,
      message: parseError.message,
      repairError: parseError.repairError || null,
      rawChars: raw.length,
      jsonChars: parseError.jsonChars || null,
    });

    try {
      const repairRaw = await repairGeneratedSlidesJson({ anthropic, raw, count, parseError });
      return {
        slides: normalizeSlides(extractJsonArray(repairRaw), count),
        repaired: true,
        repairRawChars: repairRaw.length,
      };
    } catch (repairError) {
      throw new Error(`Model returned invalid JSON and automatic repair failed: ${repairError.message}`);
    }
  }
};

const slideDocumentId = (index) => `slide-${String(index + 1).padStart(2, '0')}`;

const persistGeneratedSlides = async ({ deckId, uid, slides }) => {
  try {
    // Write deck-level slides and mark ready first so the Firestore listener
    // on the client fires as early as possible. Subcollection batch follows.
    await db.collection('decks').doc(deckId).set({
      userId: uid,
      status: 'ready',
      stage: 'ready',
      slideCount: slides.length,
      slides,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const batch = db.batch();
    slides.forEach((s, i) => {
      const ref = db.collection('decks').doc(deckId).collection('slides').doc(slideDocumentId(i));
      batch.set(ref, {
        index: i,
        title: s.title || '',
        bullets: s.bullets || [],
        layout: s.layout || 'standard',
        visualLayout: s.visualLayout || s.layout || null,
        renderLayout: s.renderLayout || null,
        slideType: s.slideType || null,
        visualization: s.visualization || null,
        needsIcons: s.needsIcons === true,
        needsChart: s.needsChart === true,
        needsImage: s.needsImage === true,
        components: Array.isArray(s.components) ? s.components : [],
        storytellingNote: s.storytellingNote || '',
        contentType: s.contentType || null,
        kicker: s.kicker || null,
        speakerNotes: s.speakerNotes || '',
        imagePrompt: s.imagePrompt || '',
      });
    });
    await batch.commit();

    logger.info('generateDeck completed', {
      deckId,
      slideCount: slides.length,
      persisted: true,
    });
    return true;
  } catch (e) {
    logger.error('generateDeck persistence failed', {
      deckId,
      message: e.message,
      name: e.name,
      code: e.code,
    });
    return false;
  }
};

const decodeXmlEntities = (value) => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const slideNumberFromPath = (path) => {
  const match = String(path || '').match(/slide(\d+)\.xml$/);
  return match ? parseInt(match[1], 10) : 0;
};

const extractPptxText = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumberFromPath(a) - slideNumberFromPath(b));

  const slides = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path).async('text');
    const textRuns = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlEntities(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (textRuns.length) {
      slides.push(`Slide ${slideNumberFromPath(path)}\n${textRuns.join('\n')}`);
    }
  }
  return slides.join('\n\n');
};

const buildDeckPrompt = ({ userInstruction, sourceMaterial, sourceDocumentName, sourceFit, count, templateStyle, voiceGuide, templatePreset }) => `Create exactly ${count} presentation slides from the user's context.

This is for an internal Quidax deck. The output must feel like a thoughtful first draft from a senior presentation strategist, not a generic summary.

Deck requirements:
- Treat "User instruction or pasted notes" as the brief: audience, goal, emphasis, missing context, and what story the user wants told.
- Treat "Parsed source material" as the evidence: the facts, details, sections, and language to synthesize into the deck.
- Factual content comes from the parsed source material first. The brief can frame the deck, but it cannot create facts that the document does not contain.
- Merge the brief and the source material into one coherent story. Do not make separate "prompt" and "document" sections.
- Do not mirror the original document/page/slide breaks mechanically; reorganize around the best narrative arc.
- Ignore cover-page boilerplate, table of contents, repeated headers/footers, page numbers, "prepared for" metadata, and lists of section titles. Use them only to infer structure; do not turn them into slide content.
- Do not copy phrases like "Requested focus" or "Source document" into slide bullets.
- If the brief asks for a different story than the source supports, make that mismatch explicit with "Needs source confirmation" or reframe the deck around the actual source topic.
- Use the user's supplied context as the source of truth.
- Preserve specific names, products, metrics, dates, markets, phases, risks, asks, owners, and decisions when they appear in the context.
- Every bullet must be directly supported by the context. Do not invent facts, numbers, customers, locations, or timelines.
- If the context is thin, make the limitation visible with concrete "TBD" or "Needs confirmation" bullets instead of making things up.
- Turn raw notes into a coherent narrative: context, problem/opportunity, evidence, plan/sections, risks, decisions, next steps.
- Avoid generic filler like "improve efficiency", "drive growth", "leverage technology", or "enhance collaboration" unless the context says that specifically.
- Titles should be specific and useful, not labels like "Overview" or "Key Metrics" unless the source truly supports them.
- Every slide title must be distinct. Do not reuse the document title, lecture title, event title, or a previous slide title with minor suffixes.
- Synthesize titles as takeaways from the evidence. Do not start multiple titles with the same person, event, institution, source name, or uploaded file name.
- If the source is a transcript, lecture, report, article, or PDF export, identify the thesis and argument beats; do not copy source headings as the slide outline.
- Bullets should state the point and the implication. Prefer concrete claims over vague phrases.
- Every slide must include Slide Intelligence fields: slideType, layout, visualization, needsIcons, needsChart, needsImage, components, and storytellingNote.
- The slideType must be one of: title_slide, section_break, process_flow, comparison, timeline, statistics, hierarchy, image_focus, roadmap, problem_solution, feature_breakdown, summary.
- Choose the visual treatment that best tells the story. Prefer transforming content into flows, timelines, comparisons, KPI cards, roadmaps, hierarchies, problem/solution splits, feature cards, or summary cards when the content supports it.
- Use "statistics" only when there is a real number or metric in the source.
- Never create placeholder/default metrics.
- Use "image_focus" only when you can provide a concrete imagePrompt.
- Before writing JSON, silently identify the source thesis, 5-8 evidence clusters, conflicts/missing information, and the cleanest narrative arc. Use that plan to produce the slides.

Voice: ${voiceGuide}
Template style: ${templateStyle || 'Professional'}
Template preset:
${JSON.stringify(templatePreset || {}, null, 2)}

Return ONLY valid JSON. No markdown. No comments. No text before or after the JSON.
JSON shape:
[
  {
    "title": "Specific slide title",
    "slideType": "title_slide|section_break|process_flow|comparison|timeline|statistics|hierarchy|image_focus|roadmap|problem_solution|feature_breakdown|summary",
    "layout": "hero_title|section_divider|horizontal_step_flow|two_column_comparison|chronological_timeline|kpi_card_grid|layered_hierarchy|full_bleed_image_with_caption|phased_roadmap|problem_vs_solution_split|icon_card_grid|key_takeaway_cards",
    "visualization": "flowchart|comparison_table|timeline|kpi_cards|hierarchy_diagram|image_story|roadmap|split_story|feature_cards|takeaway_cards|title_hero|section_marker",
    "needsIcons": true,
    "needsChart": false,
    "needsImage": false,
    "contentType": "opening|context|problem|evidence|plan|risk|decision|next steps",
    "kicker": "Short section label",
    "bullets": [
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication"
    ],
    "components": [
      { "type": "step|kpi|phase|milestone|problem|solution|feature|takeaway|node|comparison_column", "label": "Short component label", "icon": "semantic-icon-name" }
    ],
    "storytellingNote": "Short instruction for why this visual treatment helps the slide",
    "speakerNotes": "Optional short presenter guidance grounded in the source",
    "imagePrompt": "Optional concrete visual prompt if slideType is image_focus"
  }
]

Slide Intelligence mapping:
- title_slide -> hero_title -> title_hero
- section_break -> section_divider -> section_marker
- process_flow -> horizontal_step_flow -> flowchart. Components should be ordered steps with icons.
- comparison -> two_column_comparison -> comparison_table. Components should be two comparison_column objects with item lists.
- timeline -> chronological_timeline -> timeline. Components should be dated milestones.
- statistics -> kpi_card_grid -> kpi_cards. Components should be KPI objects with value and label.
- hierarchy -> layered_hierarchy -> hierarchy_diagram. Components should be nodes with level values when useful.
- image_focus -> full_bleed_image_with_caption -> image_story.
- roadmap -> phased_roadmap -> roadmap. Components should be phases.
- problem_solution -> problem_vs_solution_split -> split_story. Components should include one problem and one solution.
- feature_breakdown -> icon_card_grid -> feature_cards. Components should be feature cards with icons.
- summary -> key_takeaway_cards -> takeaway_cards. Components should be key takeaways or actions.

Slide structure guidance:
1. Start with the most important takeaway from the context, not a generic agenda.
2. Group related details into logical slides; do not create one slide per paragraph mechanically.
3. Use 2-4 bullets per slide.
4. Keep each bullet under 26 words.
5. Make the final slide a concrete decision, recommendation, or next-step slide when the context supports it.

Source document name:
${sourceDocumentName || '(none)'}

Brief/source fit guidance:
${sourceFit || 'No source-fit warning.'}

User instruction or pasted notes:
${userInstruction || '(none)'}

Parsed source material:
${sourceMaterial || userInstruction}`;

// ── generateDeck ──────────────────────────────────────────────
exports.generateDeck = onCall(
  callableOptions({ timeoutSeconds: 300, memory: '512MiB', secrets: ['ANTHROPIC_API_KEY'] }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error('generateDeck: ANTHROPIC_API_KEY is not set in the function environment');
      throw new HttpsError('internal', 'Anthropic API key is not configured. Generation cannot proceed.');
    }
    const anthropic = new AnthropicClient({ apiKey });

    const { deckId, inputText, parsedFileText, sourceDocumentName, slideCount, templateStyle, brandVoice, templatePreset } = request.data;
    const userInstruction = compactText(inputText, MAX_INPUT_CHARS);
    const sourceMaterial = cleanSourceMaterial(parsedFileText, MAX_SOURCE_CHARS);
    const content = [userInstruction, sourceMaterial].filter(Boolean).join('\n\n');
    if (!deckId) throw new HttpsError('invalid-argument', 'No deckId was provided for generation.');
    if (!content) throw new HttpsError('invalid-argument', 'No content was provided for deck generation.');

    const existingDeckSnap = await db.collection('decks').doc(deckId).get();
    if (!existingDeckSnap.exists) {
      throw new HttpsError('not-found', 'Deck not found. Create the deck before calling generateDeck.');
    }
    if (existingDeckSnap.data().userId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'You do not own this deck.');
    }

    const count = resolveSlideCount(slideCount, content);

    logger.info('generateDeck started', {
      deckId,
      uid: request.auth.uid,
      requestedSlides: count,
      templateStyle: templateStyle || 'Professional',
      inputChars: userInstruction.length,
      sourceChars: sourceMaterial.length,
      contentChars: content.length,
    });

    const voiceGuide = {
      professional: 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.',
      minimal:      'Concise and restrained. Use fewer words, simple structure, and no decorative filler.',
      bold:         'Punchy and direct. Short sentences, strong verbs, no inflated claims.',
      fun:          'Warm, human, and upbeat while staying concrete. Avoid jokes that weaken clarity.',
      approachable: 'Warm and conversational while still business-ready. Human-first and concrete.',
      data:         'Evidence-led. Put numbers, facts, trends, tradeoffs, and assumptions front and centre.',
    }[brandVoice] || templatePreset?.tone || 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.';

    const systemPrompt = `You are AutoDeck AI, an expert presentation strategist for Quidax.
You transform messy user context into accurate, useful slide content.
You must be faithful to the source. If a fact is not in the source, do not add it.`;

    const prompt = buildDeckPrompt({
      userInstruction,
      sourceMaterial,
      sourceDocumentName: compactText(sourceDocumentName, 300),
      sourceFit: sourceFitGuide(userInstruction, sourceMaterial),
      count,
      templateStyle,
      voiceGuide,
      templatePreset,
    });

    let slides = [];
    try {
      await db.collection('decks').doc(deckId).set({
        userId: request.auth.uid,
        status: 'processing',
        stage: 'calling-anthropic',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: generationMaxTokens(count),
        temperature: 0.25,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = msg.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      const parsed = await parseGeneratedSlides({ anthropic, raw, count, deckId });
      slides = parsed.slides;
      logger.info('generateDeck anthropic response parsed', {
        deckId,
        rawChars: raw.length,
        repaired: parsed.repaired,
        repairRawChars: parsed.repairRawChars,
        normalizedSlides: slides.length,
        requestedSlides: count,
      });
      await db.collection('decks').doc(deckId).set({
        stage: 'received-anthropic-response',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      if (slides.length < Math.min(count, 5)) {
        throw new Error('Model returned too few usable slides');
      }
    } catch (e) {
      logger.error('generateDeck failed', {
        deckId,
        message: e.message,
        name: e.name,
      });
      if (deckId) {
        await db.collection('decks').doc(deckId).set({
          userId: request.auth.uid,
          status: 'error',
          error: 'Generation failed: ' + e.message,
          stage: 'generation-error',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
      }
      throw new HttpsError('internal', 'Generation failed: ' + e.message);
    }

    const persisted = await persistGeneratedSlides({
      deckId,
      uid: request.auth.uid,
      slides,
    });

    return { slides, persisted };
  }
);

// ── agentEdit ─────────────────────────────────────────────────
exports.agentEdit = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB', secrets: ['ANTHROPIC_API_KEY'] }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Anthropic API key is not configured.');
    const anthropic = new AnthropicClient({ apiKey });

    const { slideTitle, bullets, userMessage, history = [] } = request.data;

    const systemPrompt = `You are an expert presentation editor for Quidax, a crypto exchange.
The user is editing a slide. Respond with a JSON object:
{
  "updatedTitle": "...",
  "updatedBullets": ["...", "..."],
  "assistantReply": "One sentence confirming the change."
}
Only output valid JSON — no markdown, no explanation.
Current slide: title="${slideTitle}", bullets=${JSON.stringify(bullets)}`;

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: userMessage },
    ];

    let result;
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });
      const raw      = msg.content[0].text.trim();
      const jsonStart = raw.indexOf('{');
      const jsonEnd   = raw.lastIndexOf('}') + 1;
      result = JSON.parse(raw.slice(jsonStart, jsonEnd));
    } catch (e) {
      throw new HttpsError('internal', 'Edit failed: ' + e.message);
    }

    return result;
  }
);

// ── geminiGenerate ─────────────────────────────────────────────
exports.geminiGenerate = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB', secrets: ['GEMINI_API_KEY'] }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { prompt, slideCount = 8 } = request.data;
    if (!prompt || !String(prompt).trim()) throw new HttpsError('invalid-argument', 'Prompt is required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Gemini API key not configured. Set GEMINI_API_KEY secret: firebase functions:secrets:set GEMINI_API_KEY');

    const count = Math.max(3, Math.min(20, parseInt(slideCount, 10) || 8));

    const systemInstruction = `You are an expert presentation strategist. Generate exactly ${count} professional presentation slides.

Return ONLY a valid JSON array — no markdown fences, no explanation, no text before or after.
JSON shape:
[
  {
    "title": "Specific slide title (max 12 words)",
    "layout": "standard|split|bigTitle|stat|quote|image|minimal|centered",
    "bullets": ["Concrete point one", "Concrete point two", "Concrete point three"]
  }
]

Rules:
- 2–4 bullets per slide, each under 22 words
- Use "stat" layout only when the prompt contains a real metric or number
- Use "bigTitle" for the opening/closing impact slide
- First slide: strong opening statement
- Last slide: clear next step or recommendation
- Titles must be specific — avoid generic labels like "Overview" or "Key Points"`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nUser prompt: ${compactText(prompt, 2000)}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpsError('internal', 'Gemini API error: ' + errText.slice(0, 300));
    }

    const body = await response.json();
    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let slides;
    try {
      slides = extractJsonArray(raw);
    } catch (e) {
      throw new HttpsError('internal', 'Failed to parse Gemini response as JSON: ' + e.message);
    }

    const normalized = normalizeSlides(slides, count);
    if (normalized.length < 2) throw new HttpsError('internal', 'Gemini returned too few usable slides');

    return { slides: normalized };
  }
);

// ── geminiGenerateImage ────────────────────────────────────────
exports.geminiGenerateImage = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '512MiB', secrets: ['GEMINI_API_KEY'] }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { prompt } = request.data;
    if (!prompt || !String(prompt).trim()) throw new HttpsError('invalid-argument', 'Prompt is required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Gemini API key not configured. Set it with: firebase functions:secrets:set GEMINI_API_KEY');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: compactText(prompt, 500) }],
          parameters: { sampleCount: 4, aspectRatio: '16:9' },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpsError('internal', 'Imagen API error: ' + errText.slice(0, 300));
    }

    const body = await response.json();
    const images = (body.predictions || [])
      .map((p) => p.bytesBase64Encoded)
      .filter(Boolean)
      .map((b64) => `data:image/png;base64,${b64}`);

    if (!images.length) throw new HttpsError('internal', 'No images were generated — try a different prompt');

    return { images };
  }
);

// ── searchImages ───────────────────────────────────────────────
exports.searchImages = onCall(
  callableOptions({
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['UNSPLASH_ACCESS_KEY', 'GEMINI_API_KEY'],
  }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { query, count = 6, orientation = 'landscape', page = 1 } = request.data || {};
    if (!query || !String(query).trim()) throw new HttpsError('invalid-argument', 'query is required');

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) throw new HttpsError('internal', 'Unsplash key not configured');

    let searchQuery = String(query).trim();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Convert this into 3 short stock-photo search keywords. Return ONLY the keywords as a comma-separated list, nothing else.\n\n"${compactText(query, 200)}"`,
                }],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 30 },
            }),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          const kw = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (kw) searchQuery = kw;
        }
      } catch (err) {
        logger.warn('searchImages Gemini refinement skipped', { message: err.message });
      }
    }

    const perPage = Math.max(1, Math.min(parseInt(count, 10) || 6, 10));
    const imageOrientation = ['landscape', 'portrait', 'squarish'].includes(orientation)
      ? orientation
      : 'landscape';
    const params = new URLSearchParams({
      query: searchQuery,
      orientation: imageOrientation,
      per_page: String(perPage),
      page: String(Math.max(1, parseInt(page, 10) || 1)),
      client_id: unsplashKey,
    });

    const uRes = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`);
    if (!uRes.ok) throw new HttpsError('internal', `Unsplash error: ${uRes.status}`);
    const uData = await uRes.json();

    const images = (uData.results || []).map((p, i) => ({
      id: p.id || i,
      src: p.urls?.full || p.urls?.regular || p.urls?.small || '',
      thumb: p.urls?.small || p.urls?.thumb || p.urls?.regular || '',
      alt: p.alt_description || p.description || searchQuery,
      credit: p.user?.name || '',
      creditUrl: p.user?.links?.html || '',
    })).filter((image) => image.src && image.thumb);

    return { images, refinedQuery: searchQuery };
  }
);

// ── parseDocx ─────────────────────────────────────────────────
exports.parseDocx = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const { base64 } = request.data;
    const buf = Buffer.from(base64, 'base64');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value };
  }
);

// ── parsePptx ─────────────────────────────────────────────────
exports.parsePptx = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const { base64 } = request.data;
    const buf = Buffer.from(base64, 'base64');
    const text = await extractPptxText(buf);
    return { text };
  }
);

// ── parseFile ─────────────────────────────────────────────────
exports.parseFile = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const storagePath = String(request.data?.storagePath || '');
    const fileName = String(request.data?.fileName || storagePath);
    if (!storagePath) throw new HttpsError('invalid-argument', 'storagePath is required');

    const expectedPrefix = `uploads/temp/${request.auth.uid}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      throw new HttpsError('permission-denied', 'storagePath must be under your own uploads/temp prefix');
    }

    const ext = fileName.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'txt'].includes(ext)) {
      throw new HttpsError('invalid-argument', `Unsupported file type: .${ext}`);
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError('not-found', 'File not found in storage');

    const [buffer] = await file.download();
    let text = '';
    try {
      if (ext === 'pdf') {
        const result = await pdfParse(buffer);
        text = result.text || '';
      } else if (ext === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } else if (ext === 'pptx') {
        text = await extractPptxText(buffer);
      } else {
        text = buffer.toString('utf8');
      }
    } finally {
      await file.delete({ ignoreNotFound: true }).catch((err) => {
        logger.warn('parseFile temp cleanup failed', { storagePath, message: err?.message });
      });
    }

    const cleaned = cleanSourceMaterial(text, MAX_SOURCE_CHARS);
    return {
      text: cleaned,
      wordCount: wordCount(cleaned),
    };
  }
);

const ADMIN_EMAILS_BE = ['admin@quidax.com'];

const templatePresetIdFromStyle = (style) => String(style || 'professional')
  .toLowerCase()
  .replace(/\s+/g, '-');

const sanitizeSlideForFirestore = (slide = {}, index = 0) => ({
  index,
  title: String(slide.title || '').trim(),
  bullets: Array.isArray(slide.bullets)
    ? slide.bullets.map((bullet) => String(bullet || '').trim()).filter(Boolean)
    : [],
  layout: slide.layout || 'standard',
  visualLayout: slide.visualLayout || slide.layout || null,
  renderLayout: slide.renderLayout || null,
  theme: slide.theme || null,
  slideType: slide.slideType || null,
  visualization: slide.visualization || null,
  needsIcons: slide.needsIcons === true,
  needsChart: slide.needsChart === true,
  needsImage: slide.needsImage === true,
  components: Array.isArray(slide.components) ? slide.components : [],
  storytellingNote: String(slide.storytellingNote || ''),
  contentType: slide.contentType || null,
  kicker: slide.kicker || null,
  speakerNotes: String(slide.speakerNotes || ''),
  imagePrompt: String(slide.imagePrompt || ''),
});

// ── createDeck ─────────────────────────────────────────────────
exports.createDeck = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { inputText, parsedFileText, templateStyle, slideCount, uploadedFileName } = request.data;
    if (!inputText && !parsedFileText) throw new HttpsError('invalid-argument', 'No content provided');

    const titleSource = String(inputText || parsedFileText || uploadedFileName || 'Untitled deck').trim();
    const title = titleSource.split(/\s+/).slice(0, 8).join(' ');

    const email = request.auth.token.email || '';
    const author = request.auth.token.name || email.split('@')[0] || 'Unknown';

    const explicit = parseInt(slideCount, 10);
    const words = String(inputText || parsedFileText || '').trim().split(/\s+/).filter(Boolean).length;
    const resolvedSlideCount = Number.isFinite(explicit) && explicit > 0
      ? Math.max(3, Math.min(20, explicit))
      : Math.max(5, Math.min(12, Math.round(words / 80) || 8));

    const deckRef = db.collection('decks').doc();
    await deckRef.set({
      userId: request.auth.uid,
      author,
      title,
      inputText: String(inputText || '').slice(0, MAX_INPUT_CHARS),
      parsedFileText: String(parsedFileText || '').slice(0, MAX_SOURCE_CHARS),
      templateStyle: templateStyle || 'Professional',
      templatePresetId: templatePresetIdFromStyle(templateStyle),
      slideCount: resolvedSlideCount,
      uploadedFileName: String(uploadedFileName || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing',
      stage: 'created',
    });

    logger.info('createDeck', { deckId: deckRef.id, uid: request.auth.uid });
    return { deckId: deckRef.id };
  }
);

// ── finalizeDeck ───────────────────────────────────────────────
exports.finalizeDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, slides, config = {} } = request.data;
    if (!Array.isArray(slides) || !slides.length) {
      throw new HttpsError('invalid-argument', 'slides array is required');
    }

    let deckRef;
    if (deckId) {
      deckRef = db.collection('decks').doc(deckId);
      const snap = await deckRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
      if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');
    } else {
      const email = request.auth.token.email || '';
      const author = request.auth.token.name || email.split('@')[0] || 'Unknown';
      const titleSource = String(config.inputText || config.parsedFileText || 'Untitled deck').trim();

      deckRef = db.collection('decks').doc();
      await deckRef.set({
        userId: request.auth.uid,
        author,
        title: titleSource.split(/\s+/).slice(0, 8).join(' ') || 'Untitled deck',
        inputText: String(config.inputText || '').slice(0, MAX_INPUT_CHARS),
        parsedFileText: String(config.parsedFileText || '').slice(0, MAX_SOURCE_CHARS),
        templateStyle: config.templateStyle || 'Professional',
        templatePresetId: templatePresetIdFromStyle(config.templateStyle),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'processing',
        stage: 'created',
      });
    }

    const batch = db.batch();
    batch.set(deckRef, {
      status: 'ready',
      stage: 'ready',
      templatePresetId: templatePresetIdFromStyle(config.templateStyle),
      slideCount: slides.length,
      slides,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    slides.forEach((slide, index) => {
      const slideRef = deckRef.collection('slides').doc(slideDocumentId(index));
      batch.set(slideRef, sanitizeSlideForFirestore(slide, index));
    });

    await batch.commit();
    logger.info('finalizeDeck', { deckId: deckRef.id, uid: request.auth.uid, slides: slides.length });
    return { deckId: deckRef.id, ok: true };
  }
);

// ── attachSourceFile ───────────────────────────────────────────
exports.attachSourceFile = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, uploadedFileUrl, uploadedFileName } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');
    if (!uploadedFileUrl) throw new HttpsError('invalid-argument', 'uploadedFileUrl is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      uploadedFileUrl: String(uploadedFileUrl),
      uploadedFileName: String(uploadedFileName || ''),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

// ── markDeckError ──────────────────────────────────────────────
exports.markDeckError = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, error, stage } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      status: 'error',
      error: String(error || 'Unknown error').slice(0, 500),
      stage: String(stage || 'client-error'),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

// ── saveBrand ─────────────────────────────────────────────────
exports.saveBrand = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const email = (request.auth.token.email || '').toLowerCase();
    if (!ADMIN_EMAILS_BE.includes(email)) throw new HttpsError('permission-denied', 'Admin only');

    const { brand } = request.data;
    if (!brand || typeof brand !== 'object') throw new HttpsError('invalid-argument', 'brand object required');

    const allowedBrandKeys = ['colorRows', 'colors', 'voice', 'displayFont', 'bodyFont', 'voiceDocs'];
    const safe = {};
    allowedBrandKeys.forEach((key) => {
      if (key in brand) safe[key] = brand[key];
    });
    if (!Object.keys(safe).length) throw new HttpsError('invalid-argument', 'No valid brand fields provided');

    await db.collection('config').doc('brand').set(safe, { merge: true });
    return { ok: true };
  }
);

// ── getBrand ──────────────────────────────────────────────────
exports.getBrand = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const snap = await db.collection('config').doc('brand').get();
    return { brand: snap.exists ? snap.data() : null };
  }
);

// ── listDecks ─────────────────────────────────────────────────
exports.listDecks = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const snap = await db.collection('decks')
      .where('userId', '==', request.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const decks = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || 'Untitled',
        author: d.author || '',
        template: d.templateStyle || 'Professional',
        slideCount: d.slideCount || 0,
        status: d.status || 'ready',
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return { decks };
  }
);

// ── deleteDeck ────────────────────────────────────────────────
exports.deleteDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    const slideSnap = await deckRef.collection('slides').get();
    const batch = db.batch();
    slideSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(deckRef);
    await batch.commit();

    logger.info('deleteDeck', { deckId, uid: request.auth.uid });
    return { ok: true };
  }
);
