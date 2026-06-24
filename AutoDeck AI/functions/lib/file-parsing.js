const createFileParsingHandlers = ({
  HttpsError,
  getStorage,
  mammoth,
  pdfParse,
  extractPptxText,
  cleanSourceMaterial,
  wordCount,
  logger,
  maxSourceChars,
}) => {
  const parseDocx = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const { base64 } = request.data;
    const buf = Buffer.from(base64, 'base64');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value };
  };

  const parsePptx = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const { base64 } = request.data;
    const buf = Buffer.from(base64, 'base64');
    const text = await extractPptxText(buf);
    return { text };
  };

  const parseFile = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const storagePath = String(request.data?.storagePath || '');
    const fileName = String(request.data?.fileName || storagePath);
    if (!storagePath) throw new HttpsError('invalid-argument', 'storagePath is required');

    const expectedPrefix = `uploads/temp/${request.auth.uid}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      throw new HttpsError('permission-denied', 'storagePath must be under your own uploads/temp prefix');
    }

    const ext = fileName.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'txt'].includes(ext)) {
      throw new HttpsError('invalid-argument', `Unsupported file type: .${ext}`);
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError('not-found', 'File not found in storage');

    const [buffer] = await file.download();
    let text = '';
    try {
      if (ext === 'pdf') {
        const result = await pdfParse(buffer);
        text = result.text || '';
      } else if (ext === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } else if (ext === 'pptx') {
        text = await extractPptxText(buffer);
      } else {
        text = buffer.toString('utf8');
      }
    } finally {
      await file.delete({ ignoreNotFound: true }).catch((err) => {
        logger.warn('parseFile temp cleanup failed', { storagePath, message: err?.message });
      });
    }

    const cleaned = cleanSourceMaterial(text, maxSourceChars);
    return {
      text: cleaned,
      wordCount: wordCount(cleaned),
    };
  };

  return {
    parseDocx,
    parseFile,
    parsePptx,
  };
};

module.exports = {
  createFileParsingHandlers,
};
