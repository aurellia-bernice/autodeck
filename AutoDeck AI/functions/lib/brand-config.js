const ADMIN_EMAILS_BE = ['admin@quidax.com'];

const compactBrandValue = (value, max = 500) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const sanitizeBrandAssets = (assets) => {
  if (!Array.isArray(assets)) return [];
  const allowedKinds = new Set(['logo', 'icon', 'image', 'pattern', 'illustration', 'source', 'other']);
  const allowedSources = new Set(['upload', 'google', 'url']);

  return assets
    .filter((asset) => asset && typeof asset === 'object')
    .slice(0, 60)
    .map((asset, index) => {
      const kind = compactBrandValue(asset.kind || 'image', 40).toLowerCase();
      const sourceType = compactBrandValue(asset.sourceType || 'url', 40).toLowerCase();
      const url = compactBrandValue(asset.url || asset.sourceUrl || '', 2000);
      const sourceUrl = compactBrandValue(asset.sourceUrl || asset.url || '', 2000);
      return {
        id: compactBrandValue(asset.id || `asset-${index + 1}`, 120),
        name: compactBrandValue(asset.name || asset.fileName || `Brand asset ${index + 1}`, 160),
        kind: allowedKinds.has(kind) ? kind : 'other',
        url,
        sourceUrl,
        sourceType: allowedSources.has(sourceType) ? sourceType : 'url',
        usage: compactBrandValue(asset.usage || asset.notes || '', 260),
        fileName: compactBrandValue(asset.fileName || '', 180),
        storagePath: compactBrandValue(asset.storagePath || '', 500),
        addedAt: compactBrandValue(asset.addedAt || '', 80),
      };
    })
    .filter((asset) => asset.name && (asset.url || asset.sourceUrl));
};

const createBrandConfigHandlers = ({
  HttpsError,
  db,
}) => {
  const saveBrand = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const email = (request.auth.token.email || '').toLowerCase();
    if (!ADMIN_EMAILS_BE.includes(email)) throw new HttpsError('permission-denied', 'Admin only');

    const { brand } = request.data;
    if (!brand || typeof brand !== 'object') throw new HttpsError('invalid-argument', 'brand object required');

    const allowedBrandKeys = ['colorRows', 'colors', 'voice', 'displayFont', 'bodyFont', 'voiceDocs', 'brandAssets'];
    const safe = {};
    allowedBrandKeys.forEach((key) => {
      if (!(key in brand)) return;
      safe[key] = key === 'brandAssets' ? sanitizeBrandAssets(brand[key]) : brand[key];
    });
    if (!Object.keys(safe).length) throw new HttpsError('invalid-argument', 'No valid brand fields provided');

    await db.collection('config').doc('brand').set(safe, { merge: true });
    return { ok: true };
  };

  const getBrand = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const snap = await db.collection('config').doc('brand').get();
    return { brand: snap.exists ? snap.data() : null };
  };

  return {
    getBrand,
    saveBrand,
  };
};

module.exports = {
  createBrandConfigHandlers,
};
