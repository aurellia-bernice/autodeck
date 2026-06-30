const {
  extractJsonArray,
  extractJsonArrayText,
  generationMaxTokens,
} = require('./generation-json');
const {
  createSlideNormalizer,
  normalizeBoolean,
  normalizeLayout,
  resolveSlideCount,
} = require('./generation-normalize');
const {
  buildAgentEditSystemPrompt,
  buildDeckPrompt,
  buildDeckSystemPrompt,
  buildGeminiSystemInstruction,
  getVoiceGuide,
} = require('./generation-prompts');

const createGenerationHandlers = ({
  AnthropicClient,
  HttpsError,
  SlideIntelligence,
  SlideObjects,
  SourceReview,
  admin,
  db,
  logger,
  cleanSourceMaterial,
  compactText,
  isNoisySourceUnit,
  sourceUnitKey,
  wordCount,
  hydrateGeneratedSlideImages,
  persistGeneratedSlides,
  maxInputChars,
  maxSourceChars,
}) => {
  const { sourceFitGuide } = SourceReview;
  const normalizeSlides = createSlideNormalizer({
    SlideIntelligence,
    SlideObjects,
    isNoisySourceUnit,
    sourceUnitKey,
  });

  const normalizeBrandAssetsForGeneration = (assets = []) => {
    if (!Array.isArray(assets)) return [];
    return assets
      .filter((asset) => asset && typeof asset === 'object')
      .slice(0, 30)
      .map((asset, index) => ({
        id: String(asset.id || `asset-${index + 1}`).trim().slice(0, 120),
        name: compactText(asset.name || asset.fileName || `Brand asset ${index + 1}`, 160),
        kind: compactText(asset.kind || 'image', 40).toLowerCase(),
        url: String(asset.url || asset.sourceUrl || '').trim().slice(0, 2000),
        sourceUrl: String(asset.sourceUrl || asset.url || '').trim().slice(0, 2000),
        sourceType: compactText(asset.sourceType || 'url', 40).toLowerCase(),
        usage: compactText(asset.usage || '', 260),
      }))
      .filter((asset) => asset.id && asset.name && asset.url);
  };

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

  const generateDeck = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error('generateDeck: ANTHROPIC_API_KEY is not set in the function environment');
      throw new HttpsError('internal', 'Anthropic API key is not configured. Generation cannot proceed.');
    }
    const anthropic = new AnthropicClient({ apiKey });

    const { deckId, inputText, parsedFileText, sourceDocumentName, slideCount, templateStyle, brandVoice, templatePreset, inputMode, brandAssets } = request.data;
    const userInstruction = compactText(inputText, maxInputChars);
    const sourceMaterial = cleanSourceMaterial(parsedFileText, maxSourceChars);
    const safeBrandAssets = normalizeBrandAssetsForGeneration(brandAssets);
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

    const count = resolveSlideCount(slideCount, content, wordCount);

    logger.info('generateDeck started', {
      deckId,
      uid: request.auth.uid,
      requestedSlides: count,
      templateStyle: templateStyle || 'Professional',
      inputChars: userInstruction.length,
      sourceChars: sourceMaterial.length,
      contentChars: content.length,
      brandAssetCount: safeBrandAssets.length,
    });

    const voiceGuide = getVoiceGuide({ brandVoice, templatePreset });
    const systemPrompt = buildDeckSystemPrompt();
    const prompt = buildDeckPrompt({
      userInstruction,
      sourceMaterial,
      sourceDocumentName: compactText(sourceDocumentName, 300),
      sourceFit: sourceFitGuide(userInstruction, sourceMaterial),
      count,
      templateStyle,
      voiceGuide,
      templatePreset,
      inputMode: inputMode || 'brief',
      brandAssets: safeBrandAssets,
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
      slides = await hydrateGeneratedSlideImages(parsed.slides, safeBrandAssets);
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
  };

  const agentEdit = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Anthropic API key is not configured.');
    const anthropic = new AnthropicClient({ apiKey });

    const {
      slideIndex = 0,
      slideCount = 1,
      slideTitle,
      bullets,
      slideContent = '',
      components = [],
      currentLayout = 'standard',
      availableLayouts = [],
      deckTitles = [],
      deckSlides = [],
      sourceContext = {},
      userMessage,
      history = [],
    } = request.data;
    const safeSlideIndex = Math.max(0, Math.min(Math.max(0, Number(slideCount) - 1), Number(slideIndex) || 0));

    const systemPrompt = buildAgentEditSystemPrompt({
      safeSlideIndex,
      availableLayouts,
      slideTitle,
      bullets,
      slideContent,
      components,
      currentLayout,
      deckTitles,
      deckSlides,
      sourceContext,
      history,
    });

    const messages = [
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
      const raw = msg.content[0].text.trim();
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}') + 1;
      result = JSON.parse(raw.slice(jsonStart, jsonEnd));
    } catch (e) {
      throw new HttpsError('internal', 'Edit failed: ' + e.message);
    }

    const targetSlideIndex = Math.max(0, Math.min(Math.max(0, Number(slideCount) - 1), Number(result.targetSlideIndex) || safeSlideIndex));
    const updatedLayout = result.updatedLayout ? normalizeLayout(result.updatedLayout, '') : undefined;
    return {
      targetSlideIndex,
      updatedTitle: result.updatedTitle ? String(result.updatedTitle).trim() : undefined,
      updatedBullets: Array.isArray(result.updatedBullets)
        ? result.updatedBullets.map((b) => String(b || '').trim()).filter(Boolean).slice(0, 6)
        : undefined,
      updatedLayout: updatedLayout || undefined,
      needsClarification: normalizeBoolean(result.needsClarification, false),
      assistantReply: result.assistantReply ? String(result.assistantReply).trim() : undefined,
    };
  };

  const geminiGenerate = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { prompt, slideCount = 8 } = request.data;
    if (!prompt || !String(prompt).trim()) throw new HttpsError('invalid-argument', 'Prompt is required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Gemini API key not configured. Set GEMINI_API_KEY secret: firebase functions:secrets:set GEMINI_API_KEY');

    const count = Math.max(3, Math.min(20, parseInt(slideCount, 10) || 8));
    const systemInstruction = buildGeminiSystemInstruction(count);

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
  };

  return {
    agentEdit,
    generateDeck,
    geminiGenerate,
  };
};

module.exports = {
  createGenerationHandlers,
};
