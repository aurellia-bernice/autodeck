// Pure helper functions for the SlideGenerator agent panel.

const AutoDeckSlideEditorAgent = (() => {
  const layoutAliases = [
    { key: 'standard', patterns: [/standard/, /default/] },
    { key: 'split', patterns: [/split/, /two\s*column/, /side\s*by\s*side/] },
    { key: 'bigTitle', patterns: [/big\s*title/, /bold/, /hero\s*title/, /headline/] },
    { key: 'stat', patterns: [/\bstat\b/, /metric/, /number/] },
    { key: 'quote', patterns: [/quote/, /pull\s*quote/] },
    { key: 'image', patterns: [/image[-\s]?led/, /photo\s*\+\s*text/] },
    { key: 'table_matrix', patterns: [/table/, /matrix/, /pricing/, /rows?/, /columns?/] },
    { key: 'process_flow', patterns: [/process/, /\bflow\b/, /steps?/] },
    { key: 'comparison', patterns: [/comparison/, /compare/, /\bvs\b/, /versus/] },
    { key: 'timeline', patterns: [/timeline/, /chronolog/] },
    { key: 'roadmap', patterns: [/roadmap/, /phase/, /milestone/] },
    { key: 'problem_solution', patterns: [/problem\s*solution/, /problem.*solution/] },
    { key: 'summary', patterns: [/summary/, /takeaways?/, /recap/] },
    { key: 'image_focus', patterns: [/image\s*focus/, /full\s*bleed/, /visual/] },
  ];

  const ordinalSlideWords = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    seventh: 6,
    eighth: 7,
    ninth: 8,
    tenth: 9,
  };

  const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[_/-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizeAgentLayout = (value, layouts = []) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const layoutKeys = layouts.map((layout) => layout.key);
    if (layoutKeys.includes(raw)) return raw;
    const lower = normalizeText(raw);
    const direct = layouts.find((layout) => (
      normalizeText(layout.key) === lower || normalizeText(layout.name) === lower
    ));
    return direct?.key || layoutAliases.find((entry) => (
      entry.patterns.some((pattern) => pattern.test(lower))
    ))?.key || null;
  };

  const layoutFromAgentText = (value) => {
    const lower = normalizeText(value);
    if (!/(layout|slide|make|change|convert|switch|turn|use|as|into|table|matrix)/.test(lower)) return null;
    return layoutAliases.find((entry) => entry.patterns.some((pattern) => pattern.test(lower)))?.key || null;
  };

  const agentTargetSlideIndex = (value, { fallback = 0, total = 1 } = {}) => {
    const text = String(value || '').toLowerCase();
    const numbered = text.match(/\b(?:slide|page)\s*(\d{1,2})\b/) || text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+(?:slide|page)\b/);
    if (numbered) return Math.max(0, Math.min(total - 1, parseInt(numbered[1], 10) - 1));
    const word = Object.entries(ordinalSlideWords).find(([label]) => new RegExp(`\\b${label}\\s+(?:slide|page)\\b`).test(text));
    if (word) return Math.max(0, Math.min(total - 1, word[1]));
    return Math.max(0, Math.min(total - 1, fallback));
  };

  const quotedAgentValue = (value) => String(value || '').match(/["']([^"']{3,})["']/)?.[1]?.trim() || '';

  const titleFromAgentText = (value, currentTitle = '') => {
    const text = String(value || '').trim();
    if (!/(title|heading|headline|rename)/i.test(text)) return '';
    const quoted = quotedAgentValue(text);
    if (quoted) return quoted;
    if (/(shorter|shorten|concise|tighter)/i.test(text) && currentTitle) return currentTitle.split(/\s+/).slice(0, 6).join(' ');
    return text.match(/(?:rename|change|set|make|update).{0,24}(?:title|heading|headline)?\s*(?:to|as|:)\s*(.+)$/i)?.[1]?.trim() || '';
  };

  const bulletFromAgentText = (value) => {
    const text = String(value || '').trim();
    const quoted = quotedAgentValue(text);
    if (quoted && /bullet|point/i.test(text)) return quoted;
    return text.match(/add\s+(?:a\s+)?(?:bullet|point)\s*(?:about|on|for|that|:)?\s*(.+)$/i)?.[1]?.replace(/\b(?:to|on|for)?\s*(?:slide|page)\s*\d{1,2}\b/ig, '').trim() || '';
  };

  const sentenceCase = (value) => {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  };

  const localAgentPatch = (userText, targetSlide = {}) => {
    const patch = {};
    const layoutKey = layoutFromAgentText(userText);
    const title = titleFromAgentText(userText, targetSlide.title);
    const bullet = bulletFromAgentText(userText);
    if (layoutKey) patch.updatedLayout = layoutKey;
    if (title) patch.updatedTitle = sentenceCase(title);
    if (bullet) patch.addBullets = [sentenceCase(bullet)];
    if (/(remove|delete).*(bullet|point|last)/i.test(userText)) patch.removeLastBullet = true;
    if (/(concise|shorter|shorten|tighten|fewer)/i.test(userText)) {
      const bullets = targetSlide.bullets || [];
      patch.updatedBullets = bullets.slice(0, Math.max(1, Math.ceil(bullets.length / 2)));
    }
    if (/(expand|longer|more detail|more context|more info|talk more|elaborate|explain more)/i.test(userText)) {
      const facts = [...(targetSlide.bullets || []), targetSlide.title].filter(Boolean);
      patch.updatedBullets = [
        `What this means: ${facts[0] || 'Clarify the core idea'}`,
        `Why it matters: ${facts[1] || 'Connect it to the audience decision'}`,
        `What to show next: ${facts[2] || 'Add a concrete supporting detail'}`,
      ];
    }
    if (!Object.keys(patch).length) patch.needsClarification = true;
    return patch;
  };

  const agentIntroMessage = (idx, title, fresh = false) => ({
    role: 'assistant',
    text: `${fresh ? 'New chat started. ' : ''}I am looking at slide ${idx + 1} - "${title || 'Untitled slide'}". Ask me to rewrite text, add detail, target another slide, or switch layout. What should I change?`,
  });

  return {
    agentIntroMessage,
    agentTargetSlideIndex,
    bulletFromAgentText,
    layoutFromAgentText,
    localAgentPatch,
    normalizeAgentLayout,
    titleFromAgentText,
  };
})();

window.AutoDeckSlideEditorAgent = AutoDeckSlideEditorAgent;
