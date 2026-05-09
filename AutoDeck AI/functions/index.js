const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin    = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth  = require('mammoth');

admin.initializeApp();
const db = admin.firestore();

const AnthropicClient = Anthropic.default || Anthropic;
const anthropic = new AnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_INPUT_CHARS = 8000;
const MAX_SOURCE_CHARS = 50000;

const compactText = (value, limit) => String(value || '')
  .replace(/\u0000/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim()
  .slice(0, limit);

const wordCount = (value) => compactText(value, Number.MAX_SAFE_INTEGER)
  .split(/\s+/)
  .filter(Boolean)
  .length;

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

const normalizeSlides = (slides, count) => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide) => {
      const title = trimWords(slide?.title, 12).replace(/[.!?]+$/, '');
      const bullets = Array.isArray(slide?.bullets)
        ? slide.bullets
            .map((bullet) => trimWords(bullet, 26).replace(/^[\s\-*]+/, '').trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];
      return { title, bullets };
    })
    .filter((slide) => slide.title && slide.bullets.length >= 2)
    .slice(0, count);
};

const buildDeckPrompt = ({ userInstruction, sourceMaterial, count, templateStyle, voiceGuide }) => `Create exactly ${count} presentation slides from the user's context.

This is for an internal Quidax deck. The output must feel like a thoughtful first draft from a senior presentation strategist, not a generic summary.

Deck requirements:
- Use the user's supplied context as the source of truth.
- Preserve specific names, products, metrics, dates, markets, phases, risks, asks, owners, and decisions when they appear in the context.
- Every bullet must be directly supported by the context. Do not invent facts, numbers, customers, locations, or timelines.
- If the context is thin, make the limitation visible with concrete "TBD" or "Needs confirmation" bullets instead of making things up.
- Turn raw notes into a coherent narrative: context, problem/opportunity, evidence, plan/sections, risks, decisions, next steps.
- Avoid generic filler like "improve efficiency", "drive growth", "leverage technology", or "enhance collaboration" unless the context says that specifically.
- Titles should be specific and useful, not labels like "Overview" or "Key Metrics" unless the source truly supports them.
- Bullets should state the point and the implication. Prefer concrete claims over vague phrases.

Voice: ${voiceGuide}
Template style: ${templateStyle || 'Professional'}

Return ONLY valid JSON. No markdown. No comments. No text before or after the JSON.
JSON shape:
[
  {
    "title": "Specific slide title",
    "bullets": [
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication",
      "Context-grounded point with a clear implication"
    ]
  }
]

Slide structure guidance:
1. Start with the most important takeaway from the context, not a generic agenda.
2. Group related details into logical slides; do not create one slide per paragraph mechanically.
3. Use 2-4 bullets per slide.
4. Keep each bullet under 26 words.
5. Make the final slide a concrete decision, recommendation, or next-step slide when the context supports it.

User instruction or pasted notes:
${userInstruction || '(none)'}

Parsed source material:
${sourceMaterial || userInstruction}`;

// ── generateDeck ──────────────────────────────────────────────
exports.generateDeck = onCall(
  { timeoutSeconds: 120, memory: '512MiB', region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, inputText, parsedFileText, slideCount, templateStyle, brandVoice } = request.data;
    const userInstruction = compactText(inputText, MAX_INPUT_CHARS);
    const sourceMaterial = compactText(parsedFileText, MAX_SOURCE_CHARS);
    const content = [userInstruction, sourceMaterial].filter(Boolean).join('\n\n');
    if (!content) throw new HttpsError('invalid-argument', 'No content was provided for deck generation.');
    const count = resolveSlideCount(slideCount, content);

    const voiceGuide = {
      professional: 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.',
      bold:         'Punchy and direct. Short sentences, strong verbs, no inflated claims.',
      approachable: 'Warm and conversational while still business-ready. Human-first and concrete.',
      data:         'Evidence-led. Put numbers, facts, trends, tradeoffs, and assumptions front and centre.',
    }[brandVoice] || 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.';

    const systemPrompt = `You are AutoDeck AI, an expert presentation strategist for Quidax.
You transform messy user context into accurate, useful slide content.
You must be faithful to the source. If a fact is not in the source, do not add it.`;

    const prompt = buildDeckPrompt({
      userInstruction,
      sourceMaterial,
      count,
      templateStyle,
      voiceGuide,
    });

    let slides = [];
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: Math.min(8192, Math.max(4096, count * 520)),
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
      if (slides.length < Math.min(count, 3)) {
        throw new Error('Model returned too few usable slides');
      }
    } catch (e) {
      throw new HttpsError('internal', 'Generation failed: ' + e.message);
    }

    const batch = db.batch();
    slides.forEach((s, i) => {
      const ref = db.collection('decks').doc(deckId).collection('slides').doc();
      batch.set(ref, { index: i, title: s.title || '', bullets: s.bullets || [] });
    });
    await batch.commit();
    await db.collection('decks').doc(deckId).update({ status: 'ready', slideCount: slides.length });

    return { slides };
  }
);

// ── agentEdit ─────────────────────────────────────────────────
exports.agentEdit = onCall(
  { timeoutSeconds: 60, memory: '256MiB', region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

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
  { timeoutSeconds: 30, memory: '256MiB', region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const { base64 } = request.data;
    const buf = Buffer.from(base64, 'base64');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value };
  }
);
