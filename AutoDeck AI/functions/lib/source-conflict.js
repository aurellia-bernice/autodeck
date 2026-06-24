const createSourceConflictHandler = ({
  AnthropicClient,
  HttpsError,
  SourceReview,
  compactText,
}) => {
  const {
    keywordsFrom,
    keywordOverlap,
    hasTangibleSourceInfo,
  } = SourceReview;

  return async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { inputText, parsedFileText, sourceDocumentName } = request.data;
    const briefHasInfo = hasTangibleSourceInfo(inputText, 'brief');
    const sourceHasInfo = hasTangibleSourceInfo(parsedFileText, 'source');

    if (sourceDocumentName && !sourceHasInfo) {
      return {
        hasConflict: true,
        issueType: 'unusable_source',
        title: 'Could not read usable source content',
        message: 'The selected document did not provide enough extractable text to support this deck.',
        sourceDocumentName: sourceDocumentName || 'uploaded file',
        docSummary: 'The uploaded file did not provide enough usable text for this request.',
        briefSummary: String(inputText || '').trim() || 'No concrete brief was provided.',
        missingItems: [
          'Extractable text from the uploaded file',
          'Source facts that support the requested deck',
          'Fallback pasted notes if the file is image-only or protected',
        ],
        recommendations: [
          'Upload a text-based PDF, DOCX, PPTX, or TXT file instead of an image-only scan.',
          'Or paste the key points from the document into the brief box and proceed with those notes.',
        ],
        uploadLabel: 'Upload replacement document',
      };
    }

    if (!briefHasInfo && !sourceHasInfo) {
      return {
        hasConflict: true,
        issueType: 'insufficient_context',
        title: 'Need more source material',
        message: 'AutoDeck needs a concrete brief, usable source document, or pasted notes before it can draft reliable slides.',
        sourceDocumentName: sourceDocumentName || 'No source document',
        docSummary: 'No source document or detailed pasted notes were provided.',
        briefSummary: String(inputText || '').trim() || 'No concrete brief was provided.',
        missingItems: [
          'A specific deck objective or audience',
          'Facts, metrics, decisions, examples, or source notes to support the slides',
          'A source document that contains the topic the deck should cover',
        ],
        recommendations: [
          'Upload a PDF, DOCX, PPTX, or TXT file with the facts and sections this deck should use.',
          'Or paste concrete notes: audience, goal, key points, metrics, dates, decisions, risks, and desired next steps.',
        ],
        uploadLabel: 'Upload source document',
      };
    }

    if (!inputText || !parsedFileText) return { hasConflict: false };

    const briefKeywords = keywordsFrom(inputText);
    if (briefKeywords.length < 3) return { hasConflict: false };

    const overlap = keywordOverlap(inputText, parsedFileText);
    const threshold = Math.min(3, Math.max(1, Math.floor(briefKeywords.length * 0.25)));
    if (overlap.length >= threshold) return { hasConflict: false };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        hasConflict: true,
        issueType: 'source_mismatch',
        title: 'Source mismatch detected',
        message: 'The uploaded document does not appear to support what your brief is asking for.',
        sourceDocumentName: sourceDocumentName || '',
        docSummary: 'The uploaded document does not appear to match the requested topic.',
        briefSummary: String(inputText).slice(0, 200),
        missingItems: [],
        recommendations: ['Upload a source document that covers the requested topic, audience, evidence, and desired direction.'],
        uploadLabel: 'Upload replacement document',
      };
    }

    const anthropic = new AnthropicClient({ apiKey });
    const docExcerpt = compactText(parsedFileText, 800);
    let parsed = {};
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 320,
        messages: [{
          role: 'user',
          content: `Brief: "${compactText(inputText, 280)}"
Document "${sourceDocumentName || 'uploaded file'}": "${docExcerpt}"

The brief and document don't match. Return only JSON:
{"docSummary":"one sentence: what this document actually is","briefSummary":"one sentence: what the brief needs to build","missingItems":["2-4 specific things the document lacks for this brief"],"recommendations":["1-2 document types or sources that would actually work"]}`,
        }],
      });
      const raw = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch (_) {}

    return {
      hasConflict: true,
      issueType: 'source_mismatch',
      title: 'Source mismatch detected',
      message: 'The uploaded document does not appear to support what your brief is asking for.',
      sourceDocumentName: sourceDocumentName || '',
      docSummary: String(parsed.docSummary || 'The document does not contain the requested content.'),
      briefSummary: String(parsed.briefSummary || compactText(inputText, 200)),
      missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems.slice(0, 4).map(String) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 2).map(String) : [],
      uploadLabel: 'Upload replacement document',
    };
  };
};

module.exports = {
  createSourceConflictHandler,
};
