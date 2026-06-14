/* ═══════════════════════════════════════
   BUILD — assemble index.html from partials
   Run: node build.js
   Called automatically by server.js on startup + when partials change
   ═══════════════════════════════════════ */
const fs   = require('fs');
const path = require('path');

const PARTIALS = [
  'head', 'notif-bar', 'header', 'mobile-nav',
  'hero', 'home-sections', 'shop-pages',
  'footer', 'overlays', 'scripts',
];

function buildIndex() {
  return PARTIALS
    .map(name => fs.readFileSync(path.join(__dirname, 'partials', `${name}.html`), 'utf8'))
    .join('\n');
}

/* Write to disk when run directly (node build.js), not when require()'d */
if (require.main === module) {
  const html = buildIndex();
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  console.log(`✓ index.html built from ${PARTIALS.length} partials`);
}

module.exports = { buildIndex, PARTIALS };
