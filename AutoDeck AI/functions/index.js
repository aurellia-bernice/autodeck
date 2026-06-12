const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin    = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth  = require('mammoth');
const JSZip    = require('jszip');

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

const extractJsonArray = (raw) => {
  const text = String(raw || '').trim();
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']') + 1;
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Model did not return a JSON array');
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd));
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
      let layout = normalizeLayout(slide?.layout);
      if (layout === 'stat' && !hasUsableMetric([title, ...bullets].join(' '))) {
        layout = 'standard';
      }
      return {
        title,
        bullets,
        layout,
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

  return uniqueSlides
    .map(({ index, ...slide }) => slide)
    .slice(0, count);
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
- Every slide must include a layout from the template preset's allowedLayouts list.
- Use "stat" only when there is a real number or metric in the source.
- Never create placeholder/default metrics.
- Use "image" only when you can provide a concrete imagePrompt.
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
    "layout": "standard|split|bigTitle|stat|quote|image|minimal|centered",
    "contentType": "opening|context|problem|evidence|plan|risk|decision|next steps",
    "kicker": "Short section label",
    "bullets": [
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication"
    ],
    "speakerNotes": "Optional short presenter guidance grounded in the source",
    "imagePrompt": "Optional concrete visual prompt if layout is image"
  }
]

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
        max_tokens: Math.min(4000, Math.max(2400, count * 300)),
        temperature: 0.35,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = msg.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      slides = normalizeSlides(extractJsonArray(raw), count);
      logger.info('generateDeck anthropic response parsed', {
        deckId,
        rawChars: raw.length,
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
