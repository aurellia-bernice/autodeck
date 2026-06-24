// Browser-global services used by the app root.

const AutoDeckAppServices = (() => {
  const ADMIN_EMAILS = ['admin@quidax.com'];
  const GENERATION_DELAY_NOTICE_MS = 45000;
  const GENERATION_FUNCTION_TIMEOUT_MS = 290000;
  const GENERATION_CLIENT_DEADLINE_MS = 300000;
  const GENERATION_STORE_READ_TIMEOUT_MS = 10000;
  const AUTODECK_BUILD_ID = 'gen-auth-2026-06-12';
  const SOURCE_UPLOAD_STORAGE_KEY = 'autodeck:sourceUploads';
  const SourceReview = window.AutoDeckSourceReview;

  const isSourceFileUploadEnabled = () => {
    if (typeof window === 'undefined') return false;
    return window.AutoDeckSourceUploadsEnabled === true
      || window.localStorage?.getItem(SOURCE_UPLOAD_STORAGE_KEY) === 'enabled';
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, {
      AutoDeckBuild: {
        id: AUTODECK_BUILD_ID,
        sourceUploadStorageKey: SOURCE_UPLOAD_STORAGE_KEY,
        sourceUploadsEnabled: isSourceFileUploadEnabled(),
      },
    });
  }

  const isAdminUser = (user) => {
    const email = user?.email?.toLowerCase();
    return ADMIN_EMAILS.includes(email);
  };

  const normalizeDeckSlides = (slides, templateStyle = 'Professional') => {
    if (!Array.isArray(slides)) return [];
    return slides
      .map((slide, index) => {
        const title = String(slide?.title || '').trim();
        const bullets = Array.isArray(slide?.bullets)
          ? slide.bullets.map((b) => String(b || '').trim()).filter(Boolean)
          : [];
        const normalized = {
          ...slide,
          title,
          bullets: bullets.slice(0, 4),
          contentType: String(slide?.contentType || slide?.kicker || 'section').trim(),
          speakerNotes: String(slide?.speakerNotes || '').trim(),
          imagePrompt: String(slide?.imagePrompt || '').trim(),
        };
        const enhanced = window.AutoDeckTemplatePresets?.enhanceSlide
          ? window.AutoDeckTemplatePresets.enhanceSlide(normalized, index, slide?.templateStyle || templateStyle)
          : normalized;
        return window.AutoDeckSlideObjects?.ensureSlideObjects
          ? window.AutoDeckSlideObjects.ensureSlideObjects(enhanced, index, slides.length)
          : enhanced;
      })
      .filter((slide) => slide.title || slide.bullets.length);
  };

  const withDeadline = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(id));
  });

  const callFn = (name, payload = {}, timeoutMs = 30000) => {
    const fn = firebase.app().functions('us-central1').httpsCallable(name, { timeout: timeoutMs });
    return fn(payload).then((result) => result.data);
  };

  const uploadSourceFile = async (deckId, config) => {
    if (!window.firebaseStorage || !deckId || !config?.uploadedFile) return;
    if (!isSourceFileUploadEnabled()) {
      if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = false;
      return;
    }
    if (window.AutoDeckBuild) window.AutoDeckBuild.sourceUploadsEnabled = true;
    const file = config.uploadedFile;
    const uid = window.firebaseAuth?.currentUser?.uid || '';
    if (!uid) return;
    const path = `uploads/${uid}/${deckId}/${file.name}`;
    const snap = await window.firebaseStorage.ref(path).put(file);
    const url = await snap.ref.getDownloadURL();
    await callFn('attachSourceFile', { deckId, uploadedFileUrl: url, uploadedFileName: file.name });
  };

  const readGeneratedSlides = async (deckRef, templateStyle = 'Professional') => {
    if (!deckRef) return [];
    const deckSnap = await deckRef.get();
    const deckSlides = normalizeDeckSlides(deckSnap.data()?.slides, templateStyle);
    if (deckSlides.length) return deckSlides;

    const slideSnap = await deckRef.collection('slides').orderBy('index').get();
    return normalizeDeckSlides(slideSnap.docs.map((doc) => doc.data()), templateStyle);
  };

  const buildSourceReviewData = ({ issueType, config, docSummary, briefSummary, missingItems, recommendations }) => {
    const uploadedName = config?.uploadedFile?.name || '';
    const hasUpload = Boolean(uploadedName);
    const titleByIssue = {
      insufficient_context: 'Need more source material',
      unusable_source: 'Could not read usable source content',
      source_mismatch: 'Source mismatch detected',
    };
    const messageByIssue = {
      insufficient_context: 'AutoDeck needs a concrete brief, usable source document, or pasted notes before it can draft reliable slides.',
      unusable_source: 'The selected document did not provide enough extractable text to support this deck.',
      source_mismatch: 'The uploaded document does not appear to support what your brief is asking for.',
    };

    return {
      hasConflict: true,
      issueType,
      title: titleByIssue[issueType] || titleByIssue.source_mismatch,
      message: messageByIssue[issueType] || messageByIssue.source_mismatch,
      sourceDocumentName: uploadedName || 'No source document',
      docSummary: docSummary || (hasUpload
        ? 'The uploaded file did not provide enough usable content for this request.'
        : 'No source document or detailed pasted notes were provided.'),
      briefSummary: briefSummary || (String(config?.inputText || '').trim() || 'No concrete brief was provided.'),
      missingItems: missingItems || [
        'A specific deck objective or audience',
        'Facts, metrics, decisions, examples, or source notes to support the slides',
        'A source document that contains the topic the deck should cover',
      ],
      recommendations: recommendations || [
        'Upload a PDF, DOCX, PPTX, or TXT file with the facts and sections this deck should use.',
        'Or paste concrete notes: audience, goal, key points, metrics, dates, decisions, risks, and desired next steps.',
      ],
      uploadLabel: hasUpload ? 'Upload replacement document' : 'Upload source document',
    };
  };

  const getSourceReviewIssue = (config = {}) => {
    const brief = String(config.inputText || '').trim();
    const source = String(config.parsedFileText || '').trim();
    const hasUpload = Boolean(config.uploadedFile);
    const briefHasInfo = SourceReview.hasTangibleSourceInfo(brief, 'brief');
    const sourceHasInfo = SourceReview.hasTangibleSourceInfo(source, 'source');

    if (hasUpload && !sourceHasInfo) {
      return buildSourceReviewData({
        issueType: 'unusable_source',
        config,
        missingItems: [
          'Extractable text from the uploaded file',
          'Source facts that support the requested deck',
          'Fallback pasted notes if the file is image-only or protected',
        ],
        recommendations: [
          'Upload a text-based PDF, DOCX, PPTX, or TXT file instead of an image-only scan.',
          'Or paste the key points from the document into the brief box and proceed with those notes.',
        ],
      });
    }

    if (!briefHasInfo && !sourceHasInfo) {
      return buildSourceReviewData({ issueType: 'insufficient_context', config });
    }

    if (briefHasInfo && sourceHasInfo && SourceReview.hasSourceConflict(brief, source)) {
      return buildSourceReviewData({ issueType: 'source_mismatch', config });
    }

    return null;
  };

  const parseReplacementFile = async (file) => {
    const uid = window.firebaseAuth?.currentUser?.uid;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!uid || !window.firebaseStorage || !window.firebase?.app || !['pdf', 'docx', 'pptx', 'txt'].includes(ext)) return '';
    const storagePath = `uploads/temp/${uid}/${Date.now()}_${String(file.name).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file'}`;
    const ref = window.firebaseStorage.ref(storagePath);
    try {
      await ref.put(file);
      const parseFn = window.firebase.app().functions('us-central1').httpsCallable('parseFile', { timeout: 120000 });
      const { data } = await parseFn({ storagePath, fileName: file.name });
      return data?.text || '';
    } catch (err) {
      console.warn('[AutoDeck] parseReplacementFile failed:', err);
      return '';
    } finally {
      ref.delete().catch((delErr) => {
        if (delErr) console.warn('[AutoDeck] temp file delete failed:', delErr);
      });
    }
  };

  return {
    AUTODECK_BUILD_ID,
    GENERATION_CLIENT_DEADLINE_MS,
    GENERATION_DELAY_NOTICE_MS,
    GENERATION_FUNCTION_TIMEOUT_MS,
    GENERATION_STORE_READ_TIMEOUT_MS,
    buildSourceReviewData,
    callFn,
    getSourceReviewIssue,
    isAdminUser,
    isSourceFileUploadEnabled,
    normalizeDeckSlides,
    parseReplacementFile,
    readGeneratedSlides,
    uploadSourceFile,
    withDeadline,
  };
})();

window.AutoDeckAppServices = AutoDeckAppServices;
