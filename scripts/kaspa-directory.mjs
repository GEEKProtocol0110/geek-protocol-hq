import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const page = 'public/kaspa/directory/index.html';
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10) === value;
const https = value => { const url = new URL(value); assert.ok(url.protocol === 'https:' && !url.username && !url.password); return url; };
const instant = value => { assert.match(value, /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/); assert.ok(date(value.slice(0,10))); const time = Date.parse(value); assert.ok(Number.isFinite(time)); return time; };
const localDate = value => new Intl.DateTimeFormat('en-US',{ timeZone:'America/Detroit',year:'numeric',month:'short',day:'numeric' }).format(new Date(value));
const time = value => `<time datetime="${esc(value)}">${esc(localDate(value))}</time>`;
function projectEvidence(entry, policy) {
  const token = entry.krc20;
  assert.ok(token && policy, `KRC-20 evidence required: ${entry.id}`);
  assert.match(token.ticker, /^[A-Z][A-Z0-9]{3,5}$/);
  assert.equal(token.standard, 'KRC-20'); assert.equal(token.network,'Kaspa Mainnet');
  assert.equal(token.recordUrl,`https://api.kasplex.org/v1/krc20/token/${token.ticker}`);
  assert.equal(token.activity.url,`https://api.kasplex.org/v1/krc20/oplist?tick=${token.ticker}`);
  assert.equal(token.activity.txAccept,'1'); assert.equal(token.activity.opAccept,'1');
  assert.match(token.activity.hash,/^[a-f0-9]{64}$/);
  assert.ok(['mint','transfer','send','list','burn','deploy','issue'].includes(token.activity.operation));
  const age = instant(token.activity.checkedAt)-instant(token.activity.occurredAt);
  assert.ok(age >= 0 && age <= policy.windowDays*86400000, `Activity outside snapshot window: ${entry.id}`);
  instant(token.linkCheck.checkedAt);
  assert.equal(token.linkCheck.status,200);
  assert.equal(token.linkCheck.identity,'Project-specific content inspected');
  assert.ok(['website','hub','social'].includes(token.linkCheck.kind));
  const changedHost = https(token.linkCheck.finalUrl).hostname.replace(/^www\./,'') !== https(entry.url).hostname.replace(/^www\./,'');
  if (changedHost) {
    assert.equal(token.linkCheck.redirectReviewed,true,`Unreviewed redirect: ${entry.id}`);
    assert.ok(typeof token.linkCheck.redirectReason === 'string' && token.linkCheck.redirectReason.trim().length >= 30);
  }
}
function renderEvidence(entry) {
  if (!entry.krc20) return '';
  const token = entry.krc20;
  return `<div class="directory-evidence"><span class="directory-activity">KRC-20 activity observed</span><dl>
            <div><dt>Project link checked</dt><dd>${time(token.linkCheck.checkedAt)} · ${esc({website:'website',hub:'community hub',social:'public profile'}[token.linkCheck.kind])}</dd></div>
            <div><dt>Accepted ${esc(token.activity.operation)}</dt><dd>${time(token.activity.occurredAt)}</dd></div>
          </dl><div class="directory-evidence-links">${link(token.recordUrl,'KRC-20 record ↗')}${link(token.activity.url,'Activity source ↗')}</div></div>`;
}
export function validateCatalog(data) {
  assert.equal(data.schema, 1);
  assert.ok(date(data.reviewedAt));
  if (data.updatedAt) instant(data.updatedAt);
  if (data.krc20Review) {
    assert.equal(data.krc20Review.windowDays,90);
    assert.ok(Number.isInteger(data.krc20Review.candidateCount) && data.krc20Review.candidateCount > 0);
    assert.ok(date(data.krc20Review.reviewedOn)); assert.equal(data.krc20Review.timeZone,'America/Detroit');
  }
  const categories = new Set(), ids = new Set(), urls = new Set(), tickers = new Set();
  for (const category of data.categories) {
    assert.match(category.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(category.name.trim() && !categories.has(category.id));
    if (category.links) for (const item of category.links) { https(item.url); assert.ok(item.label.trim()); }
    categories.add(category.id);
  }
  for (const entry of data.entries) {
    assert.match(entry.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!ids.has(entry.id), `Duplicate ID: ${entry.id}`); ids.add(entry.id);
    assert.ok(categories.has(entry.category), entry.id);
    assert.ok(entry.name.trim() && entry.description.trim(), entry.id);
    assert.ok(['listed', 'legacy'].includes(entry.status), entry.id);
    assert.ok(date(entry.reviewedAt) && entry.reviewedAt <= data.reviewedAt, entry.id);
    if (entry.category === 'krc20') {
      assert.equal(entry.status,'listed'); projectEvidence(entry,data.krc20Review);
      assert.ok(!tickers.has(entry.krc20.ticker),`Duplicate KRC-20 ticker: ${entry.krc20.ticker}`); tickers.add(entry.krc20.ticker);
    } else assert.ok(!entry.krc20,'KRC-20 project evidence belongs in its dedicated category');
    for (const field of ['url','source']) {
      const url = new URL(entry[field]);
      assert.ok(url.protocol === 'https:' && !url.username && !url.password, entry.id);
    }
    const key = entry.url.replace(/\/$/, '');
    assert.ok(!urls.has(key), `Duplicate URL: ${entry.url}`); urls.add(key);
  }
  for (const category of categories) assert.ok(data.entries.some(entry => entry.category === category), `Empty category: ${category}`);
  return data;
}
export function renderCatalog(data) {
  validateCatalog(data);
  const categories = data.categories.map(category => {
    const entries = data.entries.filter(entry => entry.category === category.id);
    return `<section class="directory-section" id="${category.id}" data-directory-section aria-labelledby="heading-${category.id}">
        <header class="directory-heading"><h2 id="heading-${category.id}">${esc(category.name)}</h2><span>${entries.length} ${entries.length === 1 ? 'resource' : 'resources'}</span></header>${category.description ? `
        <p class="directory-category-note">${esc(category.description)}</p>` : ''}${category.links ? `
        <div class="directory-category-links">${category.links.map(item=>link(item.url,esc(item.label)+' ↗')).join('')}</div>` : ''}
        <div class="directory-grid">${entries.map(entry => `<article class="directory-card" id="resource-${entry.id}" data-directory-card data-category="${entry.category}" data-search="${esc([entry.name,category.name,entry.description,entry.url,entry.status].join(' '))}">
          <span class="directory-kind">${entry.status === 'legacy' ? 'Legacy · service closed' : esc(category.name)}</span>
          <h3>${link(entry.url, `${esc(entry.name)} <span aria-hidden="true">↗</span>`)}</h3>
          <p>${esc(entry.description)}</p><span class="directory-domain">${esc(new URL(entry.url).hostname)}</span>${entry.krc20 ? '\n          '+renderEvidence(entry) : ''}
          <div class="directory-source">${link(entry.source, 'Source <span aria-hidden="true">↗</span>')}<span>Reviewed <time datetime="${entry.reviewedAt}">${entry.reviewedAt}</time></span></div>
        </article>`).join('\n')}</div>
      </section>`;
  }).join('\n');
  const schema = { '@context':'https://schema.org', '@graph':[
    { '@type':'CollectionPage', '@id':'https://www.geekprotocol.xyz/kaspa/directory/#page', url:'https://www.geekprotocol.xyz/kaspa/directory/', name:'Kaspa Directory — Geek Protocol', dateModified:data.updatedAt || data.reviewedAt, isPartOf:{ '@id':'https://www.geekprotocol.xyz/#website' }, mainEntity:{ '@id':'https://www.geekprotocol.xyz/kaspa/directory/#resources' } },
    { '@type':'ItemList', '@id':'https://www.geekprotocol.xyz/kaspa/directory/#resources', numberOfItems:data.entries.length, itemListOrder:'https://schema.org/ItemListUnordered', itemListElement:data.categories.flatMap(c => data.entries.filter(e=>e.category===c.id)).map((entry,index)=>({ '@type':'ListItem', position:index+1, item:{ '@type':'WebPage', name:entry.name, url:entry.url, description:entry.description } })) },
    { '@type':'BreadcrumbList', itemListElement:[['Home','/'],['Kaspa','/kaspa/'],['Directory','/kaspa/directory/']].map(([name,path],index)=>({ '@type':'ListItem',position:index+1,name,item:`https://www.geekprotocol.xyz${path}` })) }
  ] };
  return {
    catalog:categories,
    schema:`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`,
    navigation:data.categories.map(c=>`<a href="#${c.id}">${esc(c.name)}</a>`).join(''),
    options:'<option value="all">All categories</option>'+data.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(''),
    count:`${data.entries.length} resources · ${data.categories.length} categories`,
    reviewed:data.updatedAt ? time(data.updatedAt) : `<time datetime="${data.reviewedAt}">${data.reviewedAt}</time>`
  };
}
export function checkDirectory({ write = false } = {}) {
  const data = JSON.parse(readFileSync('docs/kaspa-directory.json','utf8'));
  const rendered = renderCatalog(data), input = readFileSync(page,'utf8');
  let output = input;
  for (const [key,value] of Object.entries(rendered)) {
    const pattern = new RegExp(`<!-- directory:${key}:start -->[\\s\\S]*?<!-- directory:${key}:end -->`);
    assert.match(input, pattern, `Missing generated slot: ${key}`);
    output = output.replace(pattern, () => `<!-- directory:${key}:start -->${value}<!-- directory:${key}:end -->`);
  }
  if (write) writeFileSync(page,output);
  else assert.equal(input,output,'Stale directory: run npm run directory:write');
  return { resources:data.entries.length,categories:data.categories.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(checkDirectory({write:process.argv.includes('--write')})));
