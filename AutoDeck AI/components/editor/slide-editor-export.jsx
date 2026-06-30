// Pure export helpers for SlideGenerator.

const AutoDeckSlideEditorExport = (() => {
  const toHex = (value, fallback = 'FFFFFF') => {
    const longHex = String(value || '').match(/#([0-9a-f]{6})/i)?.[1];
    return (longHex || fallback).replace('#', '').toUpperCase();
  };

  const pptBox = (obj) => ({
    x: (obj.x / 100) * 13.333,
    y: (obj.y / 56.25) * 7.5,
    w: (obj.w / 100) * 13.333,
    h: (obj.h / 56.25) * 7.5,
  });

  const normalizeBrandAssetUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:/i.test(raw)) return raw;

    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      const driveId = parsed.searchParams.get('id')
        || raw.match(/\/file\/d\/([^/?#]+)/)?.[1]
        || raw.match(/\/presentation\/d\/([^/?#]+)/)?.[1]
        || raw.match(/\/document\/d\/([^/?#]+)/)?.[1];
      if (driveId && host.includes('drive.google.com')) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
      }
      return parsed.href;
    } catch (_) {
      return raw;
    }
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read image blob'));
    reader.readAsDataURL(blob);
  });

  const svgTextFromDataUrl = (dataUrl) => {
    const [meta, payload = ''] = String(dataUrl || '').split(',', 2);
    if (!/image\/svg\+xml/i.test(meta)) return '';
    try {
      return /;base64/i.test(meta) ? atob(payload) : decodeURIComponent(payload);
    } catch (_) {
      return '';
    }
  };

  const svgTextToPngDataUrl = (svgText) => new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Canvas is unavailable'));
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || 1024;
        canvas.height = image.naturalHeight || 576;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not rasterize SVG'));
    };
    image.src = objectUrl;
  });

  const withTimeout = (promise, ms = 3500) => new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Image fetch timed out')), ms);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(id));
  });

  const imageSrcForPptx = async (src) => {
    const normalized = normalizeBrandAssetUrl(src);
    if (!normalized) return null;
    if (/^data:image\/svg\+xml/i.test(normalized)) {
      const svgText = svgTextFromDataUrl(normalized);
      if (svgText) {
        try {
          return { data: await svgTextToPngDataUrl(svgText) };
        } catch (_) {}
      }
    }
    if (/^data:/i.test(normalized)) return { data: normalized };

    try {
      const response = await withTimeout(fetch(normalized, { mode: 'cors' }));
      if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
      const blob = await response.blob();
      if (!blob || !blob.size) throw new Error('Image response was empty');
      const data = /svg/i.test(blob.type || normalized)
        ? await svgTextToPngDataUrl(await blob.text())
        : await blobToDataUrl(blob);
      return { data };
    } catch (_) {
      return { path: normalized };
    }
  };

  return {
    imageSrcForPptx,
    normalizeBrandAssetUrl,
    pptBox,
    toHex,
  };
})();

window.AutoDeckSlideEditorExport = AutoDeckSlideEditorExport;
