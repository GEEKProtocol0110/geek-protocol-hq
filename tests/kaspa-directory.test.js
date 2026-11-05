import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture } from './helpers/client-fixture.js';
import { checkDirectory, renderCatalog, validateCatalog } from '../scripts/kaspa-directory.mjs';

const catalog = JSON.parse(readFileSync('docs/kaspa-directory.json','utf8'));

test('directory stays crawlable and structured data matches its visible resource links', () => {
  checkDirectory();
  const rendered = renderCatalog(catalog);
  const list = JSON.parse(rendered.schema.match(/<script[^>]*>(.*)<\/script>/)[1])['@graph'][1];
  assert.equal(list.numberOfItems,catalog.entries.length);
  const visible = [...rendered.catalog.matchAll(/<h3><a href="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(visible,list.itemListElement.map(row=>row.item.url));
  assert.ok(catalog.entries.find(row=>row.id==='kasfyi' && row.status==='legacy'));
});

test('catalog rejects unsafe links, duplicate resources, unknown categories and invalid dates', () => {
  for (const change of [
    data=>{data.entries[0].url='javascript:alert(1)';},
    data=>{data.entries[0].source='https://user:password@example.com';},
    data=>{data.entries[1].url=data.entries[0].url;},
    data=>{data.entries[1].id=data.entries[0].id;},
    data=>{data.entries[0].category='unknown';},
    data=>{data.entries[0].reviewedAt='2026-02-31';}
  ]) {
    const copy = structuredClone(catalog); change(copy); assert.throws(()=>validateCatalog(copy));
  }
  const copy=structuredClone(catalog); copy.entries[0].name='</script><img src=x onerror=alert(1)>';
  const rendered=renderCatalog(copy);
  assert.ok(!rendered.catalog.includes('<img src=x'));
  assert.ok(!rendered.schema.includes('</script><img'));
});

test('shipped filters combine words and category, handle no matches and reset accessibly', async () => {
  const fixture=clientFixture(()=>{throw new Error('Directory must not fetch third-party data');});
  const controls=fixture.node('[data-directory-controls]'); controls.hidden=true;
  const search=fixture.node('[data-directory-search]','input');
  const category=fixture.node('[data-directory-category]','select'); category.value='all';
  const reset=fixture.node('[data-directory-reset]','button');
  const status=fixture.node('[data-directory-status]');
  const empty=fixture.node('[data-directory-empty]');
  const jump=fixture.node('[data-directory-jump]');
  const walletSection=fixture.make('section');walletSection.dataset.directorySection='';
  const researchSection=fixture.make('section');researchSection.dataset.directorySection='';
  function card(section,category,text) {const card=fixture.make('article');Object.assign(card.dataset,{directoryCard:'',category,search:text});section.append(card);return card;}
  const wallet=card(walletSection,'wallets','Kaspium mobile wallet Android iOS');
  const tools=card(walletSection,'wallets','KasWare browser wallet');
  const research=card(researchSection,'research','Réseau consensus research');
  fixture.run(readFileSync('public/kaspa/directory/assets/directory.js','utf8'));
  assert.equal(controls.hidden,false);assert.equal(jump.hidden,true);assert.equal(reset.disabled,true);
  search.value='  WALLET android ';await search.emit('input');
  assert.equal(wallet.hidden,false);assert.equal(tools.hidden,true);assert.equal(researchSection.hidden,true);
  assert.equal(status.textContent,'1 of 3 resources shown.');
  category.value='research';await category.emit('change');assert.equal(empty.hidden,false);assert.equal(walletSection.hidden,true);
  search.value='reseau';await search.emit('input');assert.equal(research.hidden,false);assert.equal(empty.hidden,true);
  search.value='<script>';await search.emit('input');assert.equal(empty.hidden,false);
  await reset.emit('click');
  assert.equal(category.value,'all');assert.equal(search.value,'');assert.equal(status.textContent,'3 of 3 resources shown.');
  assert.equal(walletSection.hidden,false);assert.equal(researchSection.hidden,false);assert.equal(fixture.document.activeElement,search);
  assert.equal(reset.disabled,true);
  await controls.emit('submit');
});
