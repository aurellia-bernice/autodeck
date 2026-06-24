const assert = require('assert/strict');
const path = require('path');

const functionsRoot = path.resolve(__dirname, '..', 'AutoDeck AI', 'functions');
const load = (relativePath) => require(path.join(functionsRoot, relativePath));

const {
  extractJsonArray,
  extractJsonArrayText,
  generationMaxTokens,
  repairJsonArrayText,
} = load('lib/generation-json.js');
const {
  createSlideNormalizer,
  normalizeBoolean,
  normalizeLayout,
  resolveSlideCount,
  trimWords,
} = load('lib/generation-normalize.js');
const {
  buildAgentEditSystemPrompt,
  buildDeckPrompt,
  buildDeckSystemPrompt,
  buildGeminiSystemInstruction,
  getVoiceGuide,
} = load('lib/generation-prompts.js');

const wordCount = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const sourceUnitKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isNoisySourceUnit = (value) => /copyright|confidential/i.test(String(value || ''));

assert.equal(extractJsonArrayText('before [{"title":"One"}] after'), '[{"title":"One"}]');
assert.equal(generationMaxTokens(2), 3200);
assert.equal(generationMaxTokens(20), 8000);

const repaired = repairJsonArrayText('[{"title":"One" "bullets":["A","B"]}{"title":"Two","bullets":["C","D"],}]');
assert.deepEqual(JSON.parse(repaired), [
  { title: 'One', bullets: ['A', 'B'] },
  { title: 'Two', bullets: ['C', 'D'] },
]);
assert.deepEqual(
  extractJsonArray('prefix [{"title":"One" "bullets":["A","B"]}] suffix'),
  [{ title: 'One', bullets: ['A', 'B'] }]
);
assert.throws(() => extractJsonArray('no array here'), /Model did not return a JSON array/);

assert.equal(trimWords('  one   two three four ', 3), 'one two three');
assert.equal(resolveSlideCount('2', 'short content', wordCount), 3);
assert.equal(resolveSlideCount('50', 'short content', wordCount), 20);
assert.equal(resolveSlideCount(undefined, Array.from({ length: 900 }, (_, index) => `w${index}`).join(' '), wordCount), 10);
assert.equal(normalizeLayout('big title'), 'bigTitle');
assert.equal(normalizeLayout('problem vs solution'), 'problem_solution');
assert.equal(normalizeLayout('unknown layout', 'fallback'), 'fallback');
assert.equal(normalizeBoolean('YES'), true);
assert.equal(normalizeBoolean('0', true), false);
assert.equal(normalizeBoolean(undefined, true), true);

const normalizeSlides = createSlideNormalizer({
  SlideIntelligence: {
    enhanceSlides: (slides) => slides.map((slide) => ({ ...slide, enhanced: true })),
  },
  SlideObjects: {
    ensureSlidesObjects: (slides) => slides.map((slide) => ({ ...slide, objectReady: true })),
  },
  isNoisySourceUnit,
  sourceUnitKey,
});

const normalized = normalizeSlides([
  {
    title: 'Revenue story!',
    renderLayout: 'stat',
    needsIcons: 'yes',
    bullets: [
      'Customer adoption improved across three priority corridors',
      'Operations teams have clearer recovery ownership',
      'copyright footer text',
    ],
    components: [{
      type: 'KPI Card',
      label: 'Customer adoption across three important priority corridors',
      value: 'Up materially with better routing',
      detail: 'A long detail that should stay concise but remain useful for rendering checks',
      items: ['First item', 'Second item'],
      level: 9,
    }],
  },
  {
    title: 'Revenue story',
    bullets: [
      'Retention improves renewals',
      'Support teams resolve customer requests faster',
    ],
  },
  {
    title: 'Confidential appendix',
    bullets: ['This should be filtered', 'Because it is noisy'],
  },
], 5);

assert.equal(normalized.length, 2);
assert.equal(normalized[0].title, 'Revenue story');
assert.equal(normalized[0].renderLayout, 'standard');
assert.equal(normalized[0].needsIcons, true);
assert.equal(normalized[0].components[0].type, 'kpi_card');
assert.equal(normalized[0].components[0].level, 4);
assert.equal(normalized[0].enhanced, true);
assert.equal(normalized[0].objectReady, true);
assert.equal(normalized[1].title, 'Retention improves renewals');

assert.match(buildDeckSystemPrompt(), /You are AutoDeck AI/);
assert.match(getVoiceGuide({ brandVoice: 'data' }), /Evidence-led/);
assert.equal(getVoiceGuide({ brandVoice: 'unknown', templatePreset: { tone: 'Custom tone' } }), 'Custom tone');

const deckPrompt = buildDeckPrompt({
  userInstruction: 'Create a market update',
  sourceMaterial: 'Nigeria volume rose 18% in Q2.',
  sourceDocumentName: 'market.pdf',
  sourceFit: 'Source supports the brief.',
  count: 6,
  templateStyle: 'Professional',
  voiceGuide: 'Plain and factual.',
  templatePreset: { tone: 'Plain and factual.' },
  inputMode: 'brief',
});
assert.match(deckPrompt, /Create exactly 6 presentation slides/);
assert.match(deckPrompt, /Mode: GENERATE FROM BRIEF \+ SOURCE/);
assert.match(deckPrompt, /Nigeria volume rose 18% in Q2/);

const contentPrompt = buildDeckPrompt({
  userInstruction: 'Use this exact text',
  sourceMaterial: '',
  sourceDocumentName: '',
  sourceFit: '',
  count: 3,
  templateStyle: '',
  voiceGuide: 'Concise.',
  templatePreset: null,
  inputMode: 'content',
});
assert.match(contentPrompt, /Mode: STRUCTURE AND STYLE/);

const agentPrompt = buildAgentEditSystemPrompt({
  safeSlideIndex: 1,
  availableLayouts: [{ key: 'timeline', name: 'Timeline', desc: 'Chronological milestones' }],
  slideTitle: 'Launch plan',
  bullets: ['Define launch gate', 'Confirm owner'],
  slideContent: 'Launch gate details',
  components: [{ label: 'Phase one' }],
  currentLayout: 'standard',
  deckTitles: ['Intro', 'Launch plan'],
  deckSlides: [{ title: 'Intro' }, { title: 'Launch plan' }],
  sourceContext: { prompt: 'launch' },
  history: [{ role: 'user', text: 'Please expand this with more operational detail' }],
});
assert.match(agentPrompt, /timeline: Timeline - Chronological milestones/);
assert.match(agentPrompt, /Current slide index: 1/);
assert.match(agentPrompt, /user: Please expand this with more operational detail/);

assert.match(buildGeminiSystemInstruction(7), /Generate exactly 7 professional presentation slides/);

console.log('Generation helper checks passed');
