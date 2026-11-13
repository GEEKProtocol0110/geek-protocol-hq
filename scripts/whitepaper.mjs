import { readFileSync, writeFileSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';

// This document deliberately uses only headings, paragraphs, links and lists.
// Escape the source before rendering; no raw HTML or script execution is allowed.
const escape = value => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const inline = value => escape(value).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
const source = readFileSync('docs/WHITEPAPER.md', 'utf8');
const blocks = source.trim().split(/\n\s*\n/);
const headings = blocks.filter(b => b.startsWith('### ')).map((b, i) => ({ title:b.slice(4), id:`section-${i}` }));
let section = 0;
const content = blocks.slice(4).map(block => {
  const figure = block.match(/^!\[([^\]]+)\]\((\/whitepaper\/assets\/[a-z-]+\.svg)\)$/);
  if (figure) return `<figure class="whitepaper-figure"><img src="${figure[2]}" alt="${escape(figure[1])}" /><figcaption>${escape(figure[1])}</figcaption></figure>`;
  if (block.startsWith('| ')) {
    const rows = block.split('\n').map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
    return `<div class="whitepaper-table"><table><thead><tr>${rows[0].map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (block.startsWith('### ')) return `<h2 id="section-${section++}">${inline(block.slice(4))}</h2>`;
  if (block.startsWith('- ')) return `<ul>${block.split('\n').map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
  if (/^\[\d+\] /.test(block)) return `<ol class="whitepaper-references">${block.split('\n').map(line => `<li>${inline(line)}</li>`).join('')}</ol>`;
  assert.ok(!block.startsWith('#'), 'Unsupported heading in whitepaper body');
  return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
}).join('\n');
// The published PDF edition is linked from the web edition and must ship beside it.
const pdf = readFileSync('public/whitepaper/Geek-Protocol-Whitepaper.pdf');
assert.ok(statSync('public/whitepaper/Geek-Protocol-Whitepaper.pdf').size > 50000 && pdf.subarray(0, 5).toString() === '%PDF-', 'Run python3 scripts/build-whitepaper-pdf.py');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Whitepaper - Geek Protocol</title>
<link rel="stylesheet" href="/assets/atmosphere.css" />
<link rel="stylesheet" href="/assets/space.css" />
<link rel="stylesheet" href="/assets/styles.css" />
<link rel="stylesheet" href="/whitepaper/assets/whitepaper.css" />
<script type="module" src="/assets/kaspa-matrix.js"></script>
</head><body>
<a class="skip-link" href="#main">Skip to whitepaper</a>
<header class="whitepaper-nav"><a class="brand" href="/">GEEK<span class="brand-mark">//</span>PROTOCOL</a><nav aria-label="Project documents"><a href="/litepaper/">Litepaper</a><a href="/security/">Security</a><a href="/play/">Play</a></nav></header>
<main id="main" class="whitepaper-main">
<header class="whitepaper-cover"><p class="section-kicker">PUBLISHED · V1.0 · NOVEMBER 2, 2026</p><h1>GEEK<br /><em>PROTOCOL</em></h1><p class="whitepaper-subtitle">The Whitepaper</p><p>All Hope, No Hype.</p><p class="whitepaper-status">Version 1.0 is the published edition.</p><p class="whitepaper-download"><a class="button button-secondary" href="/whitepaper/Geek-Protocol-Whitepaper.pdf" type="application/pdf" download>Download PDF <span aria-hidden="true">↓</span></a></p></header>
<nav class="whitepaper-index" aria-label="Whitepaper sections">${headings.map(h => `<a href="#${h.id}">${escape(h.title)}</a>`).join('')}</nav>
<article class="whitepaper-body">${content}</article>
</main><footer class="whitepaper-footer"><a href="/litepaper/">Read the shorter litepaper</a><a href="/whitepaper/Geek-Protocol-Whitepaper.pdf" type="application/pdf" download>Download the PDF</a><a href="/">Return to HQ</a><span>Geek Protocol · Whitepaper v1.0 · Published</span></footer>
</body></html>
`;
// The site metadata generator owns only the head's managed metadata fields.
const { renderMetadata } = await import('./site-pages.mjs');
const config = JSON.parse(readFileSync('docs/site-pages.json', 'utf8'));
const output = renderMetadata(html, config.pages.find(p => p.path === '/whitepaper/'), config);
if (process.argv.includes('--write')) writeFileSync('public/whitepaper/index.html', output);
else assert.equal(readFileSync('public/whitepaper/index.html', 'utf8'), output, 'Run npm run whitepaper:write');
console.log('Whitepaper source and web edition match.');
