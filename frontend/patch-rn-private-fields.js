const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, 'node_modules/react-native/src/private');

// 1. Patch private field (#field -> _field) across react-native/src/private
function patchDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patchDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('#')) {
        const updated = content.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, '_$1');
        if (updated !== content) {
          fs.writeFileSync(fullPath, updated, 'utf8');
          console.log(`[Patched Private Fields] ${path.relative(__dirname, fullPath)}`);
        }
      }
    }
  }
}

// 2. Patch setUpDOM.js to include DOMException polyfill
const setUpDomPath = path.resolve(__dirname, 'node_modules/react-native/src/private/setup/setUpDOM.js');
if (fs.existsSync(setUpDomPath)) {
  let content = fs.readFileSync(setUpDomPath, 'utf8');
  if (!content.includes("'DOMException'")) {
    content = content.replace(
      'initialized = true;',
      `initialized = true;

  polyfillGlobal(
    'DOMException',
    () => require('../webapis/errors/DOMException').default,
  );`
    );
    fs.writeFileSync(setUpDomPath, content, 'utf8');
    console.log('[Patched Polyfill] Added DOMException to setUpDOM.js');
  }
}

// 3. Patch setUpPerformance.js to include PerformanceEntry polyfills
const setUpPerfPath = path.resolve(__dirname, 'node_modules/react-native/Libraries/Core/setUpPerformance.js');
if (fs.existsSync(setUpPerfPath)) {
  let content = fs.readFileSync(setUpPerfPath, 'utf8');
  if (!content.includes('PerformanceEntry')) {
    content = `import {polyfillGlobal} from '../Utilities/PolyfillFunctions';
${content}

polyfillGlobal(
  'PerformanceEntry',
  () => require('../../src/private/webapis/performance/PerformanceEntry').PerformanceEntry,
);
polyfillGlobal(
  'PerformanceMark',
  () => require('../../src/private/webapis/performance/UserTiming').PerformanceMark,
);
polyfillGlobal(
  'PerformanceMeasure',
  () => require('../../src/private/webapis/performance/UserTiming').PerformanceMeasure,
);
`;
    fs.writeFileSync(setUpPerfPath, content, 'utf8');
    console.log('[Patched Polyfill] Added PerformanceEntry to setUpPerformance.js');
  }
}

console.log('Running patch on React Native modules...');
patchDirectory(targetDir);
console.log('Done patching.');
