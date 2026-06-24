const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const SlideIntelligence = require('./slide-intelligence');
const SlideObjects = require('./slide-objects');
const SourceReview = require('./shared/source-review');
const { createBrandConfigHandlers } = require('./lib/brand-config');
const { createDeckStorage } = require('./lib/deck-storage');
const { createFileParsingHandlers } = require('./lib/file-parsing');
const { createGenerationHandlers } = require('./lib/generation-service');
const { createImageService } = require('./lib/image-search');
const { extractPptxText } = require('./lib/pptx-text');
const { createSourceConflictHandler } = require('./lib/source-conflict');
const {
  cleanSourceMaterial,
  compactText,
  isNoisySourceUnit,
  sourceUnitKey,
  wordCount,
} = require('./lib/source-cleaning');

admin.initializeApp();
const db = admin.firestore();

const AnthropicClient = Anthropic.default || Anthropic;

const MAX_INPUT_CHARS = 8000;
const MAX_SOURCE_CHARS = 20000;
const CALLABLE_CORS_ORIGINS = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  'https://autodeck-ai.web.app',
  'https://autodeck-ai.firebaseapp.com',
];

const callableOptions = (overrides = {}) => ({
  region: 'us-central1',
  cors: CALLABLE_CORS_ORIGINS,
  invoker: 'public',
  ...overrides,
});

const deckStorage = createDeckStorage({
  HttpsError,
  SlideObjects,
  admin,
  db,
  logger,
  maxInputChars: MAX_INPUT_CHARS,
  maxSourceChars: MAX_SOURCE_CHARS,
});

const imageService = createImageService({
  HttpsError,
  SlideObjects,
  compactText,
  logger,
});

const fileParsing = createFileParsingHandlers({
  HttpsError,
  getStorage,
  mammoth,
  pdfParse,
  extractPptxText,
  cleanSourceMaterial,
  wordCount,
  logger,
  maxSourceChars: MAX_SOURCE_CHARS,
});

const generationHandlers = createGenerationHandlers({
  AnthropicClient,
  HttpsError,
  SlideIntelligence,
  SlideObjects,
  SourceReview,
  admin,
  db,
  logger,
  cleanSourceMaterial,
  compactText,
  isNoisySourceUnit,
  sourceUnitKey,
  wordCount,
  hydrateGeneratedSlideImages: imageService.hydrateGeneratedSlideImages,
  persistGeneratedSlides: deckStorage.persistGeneratedSlides,
  maxInputChars: MAX_INPUT_CHARS,
  maxSourceChars: MAX_SOURCE_CHARS,
});

const handleCheckSourceConflict = createSourceConflictHandler({
  AnthropicClient,
  HttpsError,
  SourceReview,
  compactText,
});

const brandConfig = createBrandConfigHandlers({
  HttpsError,
  db,
});

exports.checkSourceConflict = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB', secrets: ['ANTHROPIC_API_KEY'] }),
  handleCheckSourceConflict
);

exports.generateDeck = onCall(
  callableOptions({ timeoutSeconds: 300, memory: '512MiB', secrets: ['ANTHROPIC_API_KEY'] }),
  generationHandlers.generateDeck
);

exports.agentEdit = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB', secrets: ['ANTHROPIC_API_KEY'] }),
  generationHandlers.agentEdit
);

exports.geminiGenerate = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB', secrets: ['GEMINI_API_KEY'] }),
  generationHandlers.geminiGenerate
);

exports.geminiGenerateImage = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '512MiB', secrets: ['GEMINI_API_KEY'] }),
  imageService.geminiGenerateImage
);

exports.searchImages = onCall(
  callableOptions({
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['UNSPLASH_ACCESS_KEY', 'GEMINI_API_KEY'],
  }),
  imageService.searchImages
);

exports.parseDocx = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  fileParsing.parseDocx
);

exports.parsePptx = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  fileParsing.parsePptx
);

exports.parseFile = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  fileParsing.parseFile
);

exports.createDeck = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  deckStorage.createDeck
);

exports.finalizeDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  deckStorage.finalizeDeck
);

exports.saveDeckEdits = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  deckStorage.saveDeckEdits
);

exports.attachSourceFile = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  deckStorage.attachSourceFile
);

exports.markDeckError = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  deckStorage.markDeckError
);

exports.saveBrand = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  brandConfig.saveBrand
);

exports.getBrand = onCall(
  callableOptions({ timeoutSeconds: 15, memory: '256MiB' }),
  brandConfig.getBrand
);

exports.listDecks = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  deckStorage.listDecks
);

exports.deleteDeck = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  deckStorage.deleteDeck
);
