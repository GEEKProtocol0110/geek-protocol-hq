// Adapt only the pinned wasm-bindgen loader for an asynchronous browser boot.
// Cryptography, derivation, mnemonic validation and address encoding stay in the SDK.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = 'node_modules/@dfns/kaspa-wasm/';
assert.equal(JSON.parse(readFileSync(base + 'package.json')).version, '0.14.1');
let source = readFileSync(base + 'kaspa.js', 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'), 'ef54144c9827a5705931c42bc923d3a7b778e0babd6d14ed1e7462bdd72ea309');
assert.equal(createHash('sha256').update(readFileSync(base + 'kaspa_bg.wasm')).digest('hex'), '976932dc84870ef789fbd2697428da0da5c1ac191dfed4b165eb305875b0fe71');
const boot = source.indexOf("const path = require('path').join(__dirname, 'kaspa_bg.wasm');");
assert.ok(boot > 0);
source = source.slice(0, boot);
assert.ok(source.includes('const { TextDecoder, TextEncoder, inspect } = require(`util`);'));
source = source.replace('const { TextDecoder, TextEncoder, inspect } = require(`util`);', 'const { TextDecoder, TextEncoder } = globalThis; const inspect = value => String(value);');
const output = `// Derived browser loader for @dfns/kaspa-wasm 0.14.1 (ISC). See SDK-LICENSE.txt.\nconst module = { exports: {} };\n${source}\nlet ready;\nexport async function initialize(bytes) {\n  if (!ready) ready = (async () => {\n    const binary = bytes || await (await fetch(new URL('./kaspa_bg.wasm', import.meta.url))).arrayBuffer();\n    const result = await WebAssembly.instantiate(binary, imports);\n    wasm = result.instance.exports; module.exports.__wasm = wasm;\n    return module.exports;\n  })();\n  return ready;\n}\n`;
mkdirSync('public/wallet-lab/assets', { recursive: true });
writeFileSync('public/wallet-lab/assets/kaspa-sdk.js', output);
copyFileSync(base + 'kaspa_bg.wasm', 'public/wallet-lab/assets/kaspa_bg.wasm');
copyFileSync(base + 'LICENSE', 'public/wallet-lab/assets/SDK-LICENSE.txt');
console.log('Pinned wallet SDK loader generated; wasm SHA-256:', createHash('sha256').update(readFileSync(base + 'kaspa_bg.wasm')).digest('hex'));
