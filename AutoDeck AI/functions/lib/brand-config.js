const ADMIN_EMAILS_BE = ['admin@quidax.com'];

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

    const allowedBrandKeys = ['colorRows', 'colors', 'voice', 'displayFont', 'bodyFont', 'voiceDocs'];
    const safe = {};
    allowedBrandKeys.forEach((key) => {
      if (key in brand) safe[key] = brand[key];
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
