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
    'brandAssetId',
    'brandAssetName',
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

const generationMaxTokens = (count) => Math.min(8000, Math.max(3200, count * 550));

module.exports = {
  extractJsonArray,
  extractJsonArrayText,
  generationMaxTokens,
  parseJsonArrayText,
  repairJsonArrayText,
};
