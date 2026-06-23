const JSZip = require('jszip');

const decodeXmlEntities = (value) => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const slideNumberFromPath = (path) => {
  const match = String(path || '').match(/slide(\d+)\.xml$/);
  return match ? parseInt(match[1], 10) : 0;
};

const extractPptxText = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumberFromPath(a) - slideNumberFromPath(b));

  const slides = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path).async('text');
    const textRuns = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlEntities(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (textRuns.length) {
      slides.push(`Slide ${slideNumberFromPath(path)}\n${textRuns.join('\n')}`);
    }
  }
  return slides.join('\n\n');
};

module.exports = {
  extractPptxText,
};
