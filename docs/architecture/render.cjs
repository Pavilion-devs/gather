// Optional export tool, isolated from the application dependency tree.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('../../.local/architecture-tools/node_modules/@resvg/resvg-js');
const source = fs.readFileSync(path.join(__dirname, 'gather-architecture.svg'));
const rendered = new Resvg(source, { font: { loadSystemFonts: true } }).render();
fs.writeFileSync(path.join(__dirname, 'gather-architecture.png'), rendered.asPng());
console.log(`Exported ${rendered.width} × ${rendered.height} PNG`);
