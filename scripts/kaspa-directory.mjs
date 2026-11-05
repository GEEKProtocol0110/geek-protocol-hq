import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const page = 'public/kaspa/directory/index.html';
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10) === value;
export function validateCatalog(data) {
  assert.equal(data.schema, 1);
  assert.ok(date(data.reviewedAt));
  const categories = new Set(), ids = new Set(), urls = new Set();
  for (const category of data.categories) {
    assert.match(category.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(category.name.trim() && !categories.has(category.id));
    categories.add(category.id);
  }
  for (const entry of data.entries) {
    assert.match(entry.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!ids.has(entry.id), `Duplicate ID: ${entry.id}`); ids.add(entry.id);
    assert.ok(categories.has(entry.category), entry.id);
    assert.ok(entry.name.trim() && entry.description.trim(), entry.id);
    assert.ok(['listed', 'legacy'].includes(entry.status), entry.id);
    assert.ok(date(entry.reviewedAt) && entry.reviewedAt <= data.reviewedAt, entry.id);
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
        <header class="directory-heading"><h2 id="heading-${category.id}">${esc(category.name)}</h2><span>${entries.length} ${entries.length === 1 ? 'resource' : 'resources'}</span></header>
        <div class="directory-grid">${entries.map(entry => `<article class="directory-card" id="resource-${entry.id}" data-directory-card data-category="${entry.category}" data-search="${esc([entry.name,category.name,entry.description,entry.url,entry.status].join(' '))}">
          <span class="directory-kind">${entry.status === 'legacy' ? 'Legacy · service closed' : esc(category.name)}</span>
          <h3>${link(entry.url, `${esc(entry.name)} <span aria-hidden="true">↗</span>`)}</h3>
          <p>${esc(entry.description)}</p><span class="directory-domain">${esc(new URL(entry.url).hostname)}</span>
          <div class="directory-source">${link(entry.source, 'Source <span aria-hidden="true">↗</span>')}<span>Reviewed <time datetime="${entry.reviewedAt}">${entry.reviewedAt}</time></span></div>
        </article>`).join('\n')}</div>
      </section>`;
  }).join('\n');
  const schema = { '@context':'https://schema.org', '@graph':[
    { '@type':'CollectionPage', '@id':'https://www.geekprotocol.xyz/kaspa/directory/#page', url:'https://www.geekprotocol.xyz/kaspa/directory/', name:'Kaspa Directory — Geek Protocol', dateModified:data.reviewedAt, isPartOf:{ '@id':'https://www.geekprotocol.xyz/#website' }, mainEntity:{ '@id':'https://www.geekprotocol.xyz/kaspa/directory/#resources' } },
    { '@type':'ItemList', '@id':'https://www.geekprotocol.xyz/kaspa/directory/#resources', numberOfItems:data.entries.length, itemListOrder:'https://schema.org/ItemListUnordered', itemListElement:data.categories.flatMap(c => data.entries.filter(e=>e.category===c.id)).map((entry,index)=>({ '@type':'ListItem', position:index+1, item:{ '@type':'WebPage', name:entry.name, url:entry.url, description:entry.description } })) },
    { '@type':'BreadcrumbList', itemListElement:[['Home','/'],['Kaspa','/kaspa/'],['Directory','/kaspa/directory/']].map(([name,path],index)=>({ '@type':'ListItem',position:index+1,name,item:`https://www.geekprotocol.xyz${path}` })) }
  ] };
  return {
    catalog:categories,
    schema:`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`,
    navigation:data.categories.map(c=>`<a href="#${c.id}">${esc(c.name)}</a>`).join(''),
    options:'<option value="all">All categories</option>'+data.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(''),
    count:`${data.entries.length} resources · ${data.categories.length} categories`,
    reviewed:`<time datetime="${data.reviewedAt}">${data.reviewedAt}</time>`
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
