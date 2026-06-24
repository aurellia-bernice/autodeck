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

    const enhanced = SlideIntelligence.enhanceSlides(uniqueSlides
      .map(({ index, ...slide }) => slide)
      .slice(0, count));
    return SlideObjects.ensureSlidesObjects(enhanced);
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

  const buildDeckPrompt = ({ userInstruction, sourceMaterial, sourceDocumentName, sourceFit, count, templateStyle, voiceGuide, templatePreset, inputMode }) => {
    const isContentMode = inputMode === 'content';
    const hasSourceMaterial = Boolean(String(sourceMaterial || '').trim());

    const modeRequirements = isContentMode ? `
Mode: STRUCTURE AND STYLE (the user has supplied the complete slide content)
- The user has pasted their finished content. Your job is to segment it into slides, assign visual treatments, and apply the Quidax brand — NOT to generate or invent new content.
- Preserve the user's phrasing and points as closely as possible. Do not paraphrase or rewrite unless a bullet exceeds 26 words.
- Segment the pasted text into logical slides based on topic breaks, blank lines, headers, or section shifts.
- Do not add facts, metrics, examples, or arguments that are not present in the user's text.
- If a section header appears in the user's text, use it (adapted) as the slide title.
- You may reorder content only when a different sequence makes the narrative significantly clearer.
- "Parsed source material" is unused in this mode — ignore it.` : `
Mode: ${hasSourceMaterial ? 'GENERATE FROM BRIEF + SOURCE' : 'GENERATE FROM DIRECTION ONLY'}
- Treat "User instruction or pasted notes" as the brief: audience, goal, emphasis, missing context, and what story the user wants told.
${hasSourceMaterial ? `- Treat "Parsed source material" as the evidence: the facts, details, sections, and language to synthesize into the deck.
- Factual content comes from the parsed source material first. The brief can frame the deck, but it cannot create facts that the document does not contain.
- Merge the brief and the source material into one coherent story. Do not make separate "prompt" and "document" sections.
- Do not mirror the original document/page/slide breaks mechanically; reorganize around the best narrative arc.
- Ignore cover-page boilerplate, table of contents, repeated headers/footers, page numbers, "prepared for" metadata, and lists of section titles. Use them only to infer structure; do not turn them into slide content.
- If the brief asks for a different story than the source supports, make that mismatch explicit with "Needs source confirmation" or reframe the deck around the actual source topic.` : `- No source document was provided. Build a useful first-draft deck from the direction alone.
- Do not invent company-specific metrics, dates, customers, funding details, policies, or decisions.
- Where the direction implies needed facts that are not present, use concrete "Needs confirmation" or "TBD" bullets instead of filler.
- Make the deck structure actionable: audience, objective, likely sections, assumptions, information gaps, and next steps.
- Keep the output tied to the requested topic. Do not drift into a generic deck about presentations or Quidax.`}`;

    return `Create exactly ${count} presentation slides from the user's context.

This is for an internal Quidax deck. The output must feel like a thoughtful first draft from a senior presentation strategist, not a generic summary.
${modeRequirements}

Universal requirements:
- Do not copy phrases like "Requested focus" or "Source document" into slide bullets.
- Use the user's supplied context as the source of truth.
- Preserve specific names, products, metrics, dates, markets, phases, risks, asks, owners, and decisions when they appear in the context.
- Every bullet must be directly supported by the context. Do not invent facts, numbers, customers, locations, or timelines.
- If the context is thin, make the limitation visible with concrete "TBD" or "Needs confirmation" bullets instead of making things up.
- Avoid generic filler like "improve efficiency", "drive growth", "leverage technology", or "enhance collaboration" unless the context says that specifically.
- Titles should be specific and useful, not labels like "Overview" or "Key Metrics" unless the source truly supports them.
- Every slide title must be distinct. Do not reuse the document title, lecture title, event title, or a previous slide title with minor suffixes.
- Bullets should state the point and the implication. Prefer concrete claims over vague phrases.
- Every slide must include Slide Intelligence fields: slideType, layout, visualization, needsIcons, needsChart, needsImage, components, and storytellingNote.
- The slideType must be one of: title_slide, section_break, process_flow, comparison, table_matrix, timeline, statistics, hierarchy, image_focus, roadmap, problem_solution, feature_breakdown, summary.
- Choose the visual treatment that best tells the story. Prefer transforming content into flows, timelines, comparisons, editable tables, KPI cards, roadmaps, hierarchies, problem/solution splits, feature cards, or summary cards when the content supports it.
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
    "slideType": "title_slide|section_break|process_flow|comparison|table_matrix|timeline|statistics|hierarchy|image_focus|roadmap|problem_solution|feature_breakdown|summary",
    "layout": "hero_title|section_divider|horizontal_step_flow|two_column_comparison|editable_table_matrix|chronological_timeline|kpi_card_grid|layered_hierarchy|full_bleed_image_with_caption|phased_roadmap|problem_vs_solution_split|icon_card_grid|key_takeaway_cards",
    "visualization": "flowchart|comparison_table|table_matrix|timeline|kpi_cards|hierarchy_diagram|image_story|roadmap|split_story|feature_cards|takeaway_cards|title_hero|section_marker",
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
- table_matrix -> editable_table_matrix -> table_matrix. Use for pricing, tiers, feature matrices, row/column data, or dense comparisons that should be editable as a table.
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
${sourceMaterial || '(none provided)'}`;
  };

  const generateDeck = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error('generateDeck: ANTHROPIC_API_KEY is not set in the function environment');
      throw new HttpsError('internal', 'Anthropic API key is not configured. Generation cannot proceed.');
    }
    const anthropic = new AnthropicClient({ apiKey });

    const { deckId, inputText, parsedFileText, sourceDocumentName, slideCount, templateStyle, brandVoice, templatePreset, inputMode } = request.data;
    const userInstruction = compactText(inputText, maxInputChars);
    const sourceMaterial = cleanSourceMaterial(parsedFileText, maxSourceChars);
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
      minimal: 'Concise and restrained. Use fewer words, simple structure, and no decorative filler.',
      bold: 'Punchy and direct. Short sentences, strong verbs, no inflated claims.',
      fun: 'Warm, human, and upbeat while staying concrete. Avoid jokes that weaken clarity.',
      approachable: 'Warm and conversational while still business-ready. Human-first and concrete.',
      data: 'Evidence-led. Put numbers, facts, trends, tradeoffs, and assumptions front and centre.',
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
      inputMode: inputMode || 'brief',
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
      slides = await hydrateGeneratedSlideImages(parsed.slides);
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
    const layoutList = Array.isArray(availableLayouts) && availableLayouts.length
      ? availableLayouts.map((l) => `${l.key}: ${l.name || l.key} - ${l.desc || ''}`).join('\n')
      : 'standard, split, bigTitle, stat, quote, image, minimal, centered, process_flow, comparison, table_matrix, timeline, statistics, hierarchy, image_focus, roadmap, problem_solution, feature_breakdown, summary';
    const historyText = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
          .slice(-20)
          .map((m) => `${m.role}: ${trimWords(m.text, 80)}`)
          .join('\n')
      : '';

    const systemPrompt = `You are an expert presentation editor for Quidax, a crypto exchange.
The user is editing a slide deck. Apply the request to the intended slide. Respond with a JSON object:
{
  "targetSlideIndex": 0,
  "updatedTitle": "...",
  "updatedBullets": ["...", "..."],
  "updatedLayout": "standard|split|bigTitle|stat|quote|image|minimal|centered|process_flow|comparison|table_matrix|timeline|statistics|hierarchy|image_focus|roadmap|problem_solution|feature_breakdown|summary|null",
  "needsClarification": false,
  "assistantReply": "One sentence confirming the change."
}
Only output valid JSON — no markdown, no explanation.
Rules:
- targetSlideIndex is zero-based. If the user says "slide 2", return 1.
- If the user does not specify a slide, use ${safeSlideIndex}.
- Preserve existing content unless the user asked to change it.
- Return updatedLayout only when the user asks to change layout or visual treatment.
- If the user asks for split view, two columns, quote, summary, table, timeline, roadmap, problem/solution, comparison, image focus, or any listed layout, return the matching updatedLayout. Do not tell the user to change layout manually.
- For requests like "add more info", "talk more about this", "expand", or "more detail", use the current slide content, slide components, deck outline, source prompt, and chat history to return updatedBullets with richer visible content.
- Return updatedBullets whenever the visible wording should change. Keep each bullet under 22 words.
- If you cannot make a concrete edit because the user gave no actionable request or there is no relevant content, set needsClarification true and do not claim you changed anything.
- Do not say you changed the slide unless updatedTitle, updatedBullets, or updatedLayout is present.
- Use only one of the allowed layout keys below.

Allowed layouts:
${layoutList}

Current slide index: ${safeSlideIndex}
Current slide: title="${slideTitle}", layout="${currentLayout}", bullets=${JSON.stringify(bullets)}
Current slide body: ${JSON.stringify(slideContent)}
Current slide components: ${JSON.stringify(components)}
Deck slide titles: ${JSON.stringify(deckTitles)}
Deck outline: ${JSON.stringify(deckSlides)}
Source context: ${JSON.stringify(sourceContext)}
Previous conversation:
${historyText || 'None'}`;

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
