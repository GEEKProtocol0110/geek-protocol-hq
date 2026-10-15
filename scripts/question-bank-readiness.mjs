import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { questionBankReadiness } from '../server/question-bank-readiness.js';

const write = process.argv.includes('--write');
const report = questionBankReadiness();
const rows = report.categories.map(c => `<tr><th scope="row">${c.name}</th><td>${c.active.toLocaleString('en-US')}</td><td>${c.reviewed.toLocaleString('en-US')}</td><td>${c.remaining.toLocaleString('en-US')}</td></tr>`).join('');
const markup = `<div class="bank-table-wrap" tabindex="0" role="region" aria-label="Reviewed questions by category"><table class="bank-table"><caption>Target: 1,000 source-reviewed questions in every category</caption><thead><tr><th scope="col">Category</th><th scope="col">Active</th><th scope="col">Source-reviewed</th><th scope="col">Still needed</th></tr></thead><tbody>${rows}</tbody></table></div><p>${report.reviewed.toLocaleString('en-US')} currently meet the recorded review criteria; ${report.remaining.toLocaleString('en-US')} more reviewed questions are needed across the eight categories. Counts describe internal review records, not independent certification.</p>`;
const path = 'public/play/sources/index.html';
const source = readFileSync(path, 'utf8');
assert.ok(source.includes('<!-- bank-readiness:start -->') && source.includes('<!-- bank-readiness:end -->'));
const html = source.replace(/(?<=<!-- bank-readiness:start -->)[\s\S]*?(?=<!-- bank-readiness:end -->)/, markup);
for (const [file, content] of [[path, html], ['public/play/assets/bank-readiness.json', JSON.stringify(report, null, 2) + '\n']]) {
  if (write) writeFileSync(file, content);
  else assert.equal(readFileSync(file, 'utf8'), content, `${file}: run node scripts/question-bank-readiness.mjs --write`);
}
console.log(`Reviewed-bank target: ${report.reviewed} recorded / 8000 minimum; ${report.remaining} still needed. CCE remains held for bank and economy approval.`);
