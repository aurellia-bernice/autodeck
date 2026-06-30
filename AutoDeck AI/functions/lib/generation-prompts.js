const { trimWords } = require('./generation-normalize');

const DEFAULT_AGENT_LAYOUTS = 'standard, split, bigTitle, stat, quote, image, minimal, centered, process_flow, comparison, table_matrix, timeline, statistics, hierarchy, image_focus, roadmap, problem_solution, feature_breakdown, summary';
const DEFAULT_VOICE_GUIDE = 'Clear, confident, executive-ready. Plain language, strong prioritisation, no jargon.';

const getVoiceGuide = ({ brandVoice, templatePreset }) => ({
  professional: DEFAULT_VOICE_GUIDE,
  minimal: 'Concise and restrained. Use fewer words, simple structure, and no decorative filler.',
  bold: 'Punchy and direct. Short sentences, strong verbs, no inflated claims.',
  fun: 'Warm, human, and upbeat while staying concrete. Avoid jokes that weaken clarity.',
  approachable: 'Warm and conversational while still business-ready. Human-first and concrete.',
  data: 'Evidence-led. Put numbers, facts, trends, tradeoffs, and assumptions front and centre.',
}[brandVoice] || templatePreset?.tone || DEFAULT_VOICE_GUIDE);

const summarizeBrandAssets = (assets = []) => {
  if (!Array.isArray(assets) || !assets.length) return '(none configured)';
  const compact = (value, max = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const safeAssets = assets
    .filter((asset) => asset && typeof asset === 'object' && (asset.url || asset.sourceUrl))
    .slice(0, 24)
    .map((asset) => ({
      id: compact(asset.id, 80),
      name: compact(asset.name || asset.fileName || 'Brand asset', 100),
      kind: compact(asset.kind || 'image', 40),
      usage: compact(asset.usage || '', 180),
      sourceType: compact(asset.sourceType || 'url', 40),
    }))
    .filter((asset) => asset.id && asset.name);

  return safeAssets.length ? JSON.stringify(safeAssets, null, 2) : '(none configured)';
};

const buildDeckSystemPrompt = () => `You are AutoDeck AI, an expert presentation strategist for Quidax.
You transform messy user context into accurate, useful slide content.
You must be faithful to the source. If a fact is not in the source, do not add it.`;

const buildDeckPrompt = ({ userInstruction, sourceMaterial, sourceDocumentName, sourceFit, count, templateStyle, voiceGuide, templatePreset, inputMode, brandAssets }) => {
  const isContentMode = inputMode === 'content';
  const hasSourceMaterial = Boolean(String(sourceMaterial || '').trim());
  const brandAssetGuide = summarizeBrandAssets(brandAssets);

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
- Available Quidax brand assets are visual/design material, not factual evidence. Use them only to improve brand fit.
- If a provided brand asset is the right visual for a slide, set brandAssetId to the exact asset id. Do not invent asset ids.
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
    "imagePrompt": "Optional concrete visual prompt if slideType is image_focus",
    "brandAssetId": "Optional exact id from Available Quidax brand assets when that asset should be used"
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

Available Quidax brand assets:
${brandAssetGuide}

Brief/source fit guidance:
${sourceFit || 'No source-fit warning.'}

User instruction or pasted notes:
${userInstruction || '(none)'}

Parsed source material:
${sourceMaterial || '(none provided)'}`;
};

const buildAgentEditSystemPrompt = ({
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
}) => {
  const layoutList = Array.isArray(availableLayouts) && availableLayouts.length
    ? availableLayouts.map((l) => `${l.key}: ${l.name || l.key} - ${l.desc || ''}`).join('\n')
    : DEFAULT_AGENT_LAYOUTS;
  const historyText = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
        .slice(-20)
        .map((m) => `${m.role}: ${trimWords(m.text, 80)}`)
        .join('\n')
    : '';

  return `You are an expert presentation editor for Quidax, a crypto exchange.
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
};

const buildGeminiSystemInstruction = (count) => `You are an expert presentation strategist. Generate exactly ${count} professional presentation slides.

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

module.exports = {
  buildAgentEditSystemPrompt,
  buildDeckPrompt,
  buildDeckSystemPrompt,
  buildGeminiSystemInstruction,
  getVoiceGuide,
};
