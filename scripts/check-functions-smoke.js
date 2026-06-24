const path = require('path');

const root = path.resolve(__dirname, '..');
const functionsRoot = path.join(root, 'AutoDeck AI', 'functions');

const load = (relativePath) => require(path.join(functionsRoot, relativePath));

const modules = [
  'index.js',
  'lib/brand-config.js',
  'lib/deck-storage.js',
  'lib/file-parsing.js',
  'lib/generation-json.js',
  'lib/generation-normalize.js',
  'lib/generation-prompts.js',
  'lib/generation-service.js',
  'lib/image-search.js',
  'lib/pptx-text.js',
  'lib/source-cleaning.js',
  'lib/source-conflict.js',
  'shared/source-review.js',
  'slide-intelligence.js',
  'slide-objects.js',
];

for (const modulePath of modules) {
  load(modulePath);
}

console.log('Function modules load cleanly');
