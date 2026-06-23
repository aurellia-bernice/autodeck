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

module.exports = {
  cleanSourceMaterial,
  compactText,
  isNoisySourceUnit,
  sourceUnitKey,
  wordCount,
};
