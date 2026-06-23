// ============================================================
// Source Review Heuristics
// Shared between the browser app and Cloud Functions.
// Keep this file in sync with functions/shared/source-review.js.
// ============================================================

(function attachSourceReview(global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.AutoDeckSourceReview = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function sourceReviewFactory() {
  const SOURCE_REVIEW_STOP_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'will', 'your', 'about', 'into', 'their', 'there', 'where',
    'when', 'what', 'were', 'been', 'being', 'they', 'them', 'than', 'then', 'also', 'should', 'could',
    'would', 'these', 'those', 'because', 'through', 'between', 'within', 'without', 'document', 'presentation',
    'slide', 'slides', 'deck', 'cover', 'make', 'create', 'generate', 'build', 'please', 'need', 'want',
  ]);

  const compactText = (value, limit = Number.MAX_SAFE_INTEGER) => String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, limit);

  const sourceReviewKeywords = (value) => {
    const words = String(value || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    return [...new Set(words.filter((word) => !SOURCE_REVIEW_STOP_WORDS.has(word)))].slice(0, 40);
  };

  const keywordOverlap = (brief, source) => {
    const sourceKeywords = sourceReviewKeywords(source);
    return sourceReviewKeywords(brief).filter((keyword) =>
      sourceKeywords.some((sourceKeyword) => sourceKeyword.includes(keyword) || keyword.includes(sourceKeyword))
    );
  };

  const hasSourceConflict = (brief, source) => {
    if (!brief || !source) return false;
    const briefKeywords = sourceReviewKeywords(brief);
    if (briefKeywords.length < 3) return false;
    const overlap = keywordOverlap(brief, source);
    return overlap.length < Math.min(3, Math.max(1, Math.floor(briefKeywords.length * 0.25)));
  };

  const hasTangibleSourceInfo = (value, kind = 'brief') => {
    const text = compactText(value).replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const words = text.split(/\s+/).filter(Boolean);
    const keywords = sourceReviewKeywords(text);
    const hasSpecificAnchor = /(\d{2,}|%|\$|\u20a6|Q[1-4]|FY\d{2,4}|20\d{2}|@[a-z0-9.-]+)/i.test(text);

    if (kind === 'source') return words.length >= 10 && keywords.length >= 4;
    return (words.length >= 10 && keywords.length >= 4) || (hasSpecificAnchor && keywords.length >= 3);
  };

  const sourceFitGuide = (brief, source) => {
    if (!brief || !source) return 'No source-fit warning.';
    const briefKeywords = sourceReviewKeywords(brief);
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

  return {
    SOURCE_REVIEW_STOP_WORDS,
    compactText,
    sourceReviewKeywords,
    keywordsFrom: sourceReviewKeywords,
    keywordOverlap,
    hasSourceConflict,
    hasTangibleSourceInfo,
    sourceFitGuide,
  };
});
