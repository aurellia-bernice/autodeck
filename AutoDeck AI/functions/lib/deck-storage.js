const createDeckStorage = ({
  HttpsError,
  SlideObjects,
  admin,
  db,
  logger,
  maxInputChars,
  maxSourceChars,
}) => {
  const slideDocumentId = (index) => `slide-${String(index + 1).padStart(2, '0')}`;

  const templatePresetIdFromStyle = (style) => String(style || 'professional')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const sanitizeSlideForFirestore = (slide = {}, index = 0, total = 1) => {
    const editorSlide = SlideObjects.ensureSlideObjects(slide, index, total);
    const derived = SlideObjects.deriveLegacyFields(editorSlide);
    return {
      index,
      title: String(derived.title || '').trim(),
      bullets: Array.isArray(derived.bullets)
        ? derived.bullets.map((bullet) => String(bullet || '').trim()).filter(Boolean)
        : [],
      layout: slide.layout || slide.renderLayout || 'standard',
      visualLayout: slide.visualLayout || slide.layout || null,
      renderLayout: slide.renderLayout || null,
      theme: slide.theme || null,
      slideType: slide.slideType || null,
      visualization: slide.visualization || null,
      needsIcons: slide.needsIcons === true,
      needsChart: slide.needsChart === true,
      needsImage: slide.needsImage === true,
      components: Array.isArray(slide.components) ? slide.components : [],
      storytellingNote: String(slide.storytellingNote || ''),
      contentType: slide.contentType || null,
      kicker: slide.kicker || null,
      speakerNotes: String(slide.speakerNotes || ''),
      imagePrompt: String(slide.imagePrompt || ''),
      brandAssetId: String(slide.brandAssetId || ''),
      brandAssetName: String(slide.brandAssetName || ''),
      editorVersion: SlideObjects.EDITOR_VERSION,
      visualVersion: editorSlide.visualVersion || SlideObjects.OBJECT_VISUAL_VERSION || 2,
      objects: editorSlide.objects,
    };
  };

  const persistGeneratedSlides = async ({ deckId, uid, slides }) => {
    try {
      const safeSlides = slides.map((slide, index) => sanitizeSlideForFirestore(slide, index, slides.length));
      await db.collection('decks').doc(deckId).set({
        userId: uid,
        status: 'ready',
        stage: 'ready',
        slideCount: safeSlides.length,
        editorVersion: SlideObjects.EDITOR_VERSION,
        slides: safeSlides,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const batch = db.batch();
      safeSlides.forEach((s, i) => {
        const ref = db.collection('decks').doc(deckId).collection('slides').doc(slideDocumentId(i));
        batch.set(ref, s);
      });
      await batch.commit();

      logger.info('generateDeck completed', {
        deckId,
        slideCount: slides.length,
        persisted: true,
      });
      return true;
    } catch (e) {
      logger.error('generateDeck persistence failed', {
        deckId,
        message: e.message,
        name: e.name,
        code: e.code,
      });
      return false;
    }
  };

  const createDeck = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { inputText, parsedFileText, templateStyle, slideCount, uploadedFileName } = request.data;
    if (!inputText && !parsedFileText) throw new HttpsError('invalid-argument', 'No content provided');

    const titleSource = String(inputText || parsedFileText || uploadedFileName || 'Untitled deck').trim();
    const title = titleSource.split(/\s+/).slice(0, 8).join(' ');

    const email = request.auth.token.email || '';
    const author = request.auth.token.name || email.split('@')[0] || 'Unknown';

    const explicit = parseInt(slideCount, 10);
    const words = String(inputText || parsedFileText || '').trim().split(/\s+/).filter(Boolean).length;
    const resolvedSlideCount = Number.isFinite(explicit) && explicit > 0
      ? Math.max(3, Math.min(20, explicit))
      : Math.max(5, Math.min(12, Math.round(words / 80) || 8));

    const deckRef = db.collection('decks').doc();
    await deckRef.set({
      userId: request.auth.uid,
      author,
      title,
      inputText: String(inputText || '').slice(0, maxInputChars),
      parsedFileText: String(parsedFileText || '').slice(0, maxSourceChars),
      templateStyle: templateStyle || 'Professional',
      templatePresetId: templatePresetIdFromStyle(templateStyle),
      slideCount: resolvedSlideCount,
      uploadedFileName: String(uploadedFileName || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing',
      stage: 'created',
    });

    logger.info('createDeck', { deckId: deckRef.id, uid: request.auth.uid });
    return { deckId: deckRef.id };
  };

  const finalizeDeck = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, slides, config = {} } = request.data;
    if (!Array.isArray(slides) || !slides.length) {
      throw new HttpsError('invalid-argument', 'slides array is required');
    }

    let deckRef;
    if (deckId) {
      deckRef = db.collection('decks').doc(deckId);
      const snap = await deckRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
      if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');
    } else {
      const email = request.auth.token.email || '';
      const author = request.auth.token.name || email.split('@')[0] || 'Unknown';
      const titleSource = String(config.inputText || config.parsedFileText || 'Untitled deck').trim();

      deckRef = db.collection('decks').doc();
      await deckRef.set({
        userId: request.auth.uid,
        author,
        title: titleSource.split(/\s+/).slice(0, 8).join(' ') || 'Untitled deck',
        inputText: String(config.inputText || '').slice(0, maxInputChars),
        parsedFileText: String(config.parsedFileText || '').slice(0, maxSourceChars),
        templateStyle: config.templateStyle || 'Professional',
        templatePresetId: templatePresetIdFromStyle(config.templateStyle),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'processing',
        stage: 'created',
      });
    }

    const safeSlides = slides.map((slide, index) => sanitizeSlideForFirestore(slide, index, slides.length));
    const batch = db.batch();
    batch.set(deckRef, {
      status: 'ready',
      stage: 'ready',
      templatePresetId: templatePresetIdFromStyle(config.templateStyle),
      slideCount: safeSlides.length,
      editorVersion: SlideObjects.EDITOR_VERSION,
      slides: safeSlides,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    safeSlides.forEach((slide, index) => {
      const slideRef = deckRef.collection('slides').doc(slideDocumentId(index));
      batch.set(slideRef, slide);
    });

    await batch.commit();
    logger.info('finalizeDeck', { deckId: deckRef.id, uid: request.auth.uid, slides: safeSlides.length });
    return { deckId: deckRef.id, ok: true };
  };

  const saveDeckEdits = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, slides, editorVersion = SlideObjects.EDITOR_VERSION } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');
    if (!Array.isArray(slides) || !slides.length) throw new HttpsError('invalid-argument', 'slides array is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    const safeSlides = slides.map((slide, index) => sanitizeSlideForFirestore(slide, index, slides.length));
    const batch = db.batch();
    batch.set(deckRef, {
      status: 'ready',
      stage: 'ready',
      editorVersion: Number(editorVersion) || SlideObjects.EDITOR_VERSION,
      slideCount: safeSlides.length,
      slides: safeSlides,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const existing = await deckRef.collection('slides').get();
    existing.docs.forEach((doc) => {
      const match = doc.id.match(/^slide-(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      if (n > safeSlides.length) batch.delete(doc.ref);
    });

    safeSlides.forEach((slide, index) => {
      batch.set(deckRef.collection('slides').doc(slideDocumentId(index)), slide);
    });

    await batch.commit();
    logger.info('saveDeckEdits', { deckId, uid: request.auth.uid, slides: safeSlides.length });
    return { ok: true, deckId };
  };

  const attachSourceFile = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, uploadedFileUrl, uploadedFileName } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');
    if (!uploadedFileUrl) throw new HttpsError('invalid-argument', 'uploadedFileUrl is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      uploadedFileUrl: String(uploadedFileUrl),
      uploadedFileName: String(uploadedFileName || ''),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  };

  const markDeckError = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId, error, stage } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    await deckRef.update({
      status: 'error',
      error: String(error || 'Unknown error').slice(0, 500),
      stage: String(stage || 'client-error'),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  };

  const listDecks = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const snap = await db.collection('decks')
      .where('userId', '==', request.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const decks = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || 'Untitled',
        author: d.author || '',
        template: d.templateStyle || 'Professional',
        slideCount: d.slideCount || 0,
        status: d.status || 'ready',
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return { decks };
  };

  const deleteDeck = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { deckId } = request.data;
    if (!deckId) throw new HttpsError('invalid-argument', 'deckId is required');

    const deckRef = db.collection('decks').doc(deckId);
    const snap = await deckRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Deck not found');
    if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your deck');

    const slideSnap = await deckRef.collection('slides').get();
    const batch = db.batch();
    slideSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(deckRef);
    await batch.commit();

    logger.info('deleteDeck', { deckId, uid: request.auth.uid });
    return { ok: true };
  };

  return {
    attachSourceFile,
    createDeck,
    deleteDeck,
    finalizeDeck,
    listDecks,
    markDeckError,
    persistGeneratedSlides,
    saveDeckEdits,
    sanitizeSlideForFirestore,
    slideDocumentId,
    templatePresetIdFromStyle,
  };
};

module.exports = {
  createDeckStorage,
};
