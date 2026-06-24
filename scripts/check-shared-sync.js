const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const pairs = [
  ['AutoDeck AI/components/editor/slide-intelligence.jsx', 'AutoDeck AI/functions/slide-intelligence.js'],
  ['AutoDeck AI/components/editor/slide-objects.jsx', 'AutoDeck AI/functions/slide-objects.js'],
  ['AutoDeck AI/shared/source-review.js', 'AutoDeck AI/functions/shared/source-review.js'],
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

let failed = false;

for (const [browserPath, functionsPath] of pairs) {
  const browserSource = read(browserPath);
  const functionsSource = read(functionsPath);

  if (browserSource !== functionsSource) {
    failed = true;
    console.error(`Shared file drift detected:\n  ${browserPath}\n  ${functionsPath}`);
  } else {
    console.log(`Shared file in sync: ${browserPath}`);
  }
}

if (failed) {
  console.error('\nUpdate both runtime copies before committing shared logic changes.');
  process.exit(1);
}
