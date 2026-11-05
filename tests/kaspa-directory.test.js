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

test('KRC-20 listings require matching records, accepted recent activity and inspected destinations', () => {
  const index=catalog.entries.findIndex(entry=>entry.krc20);
  assert.ok(index>=0);
  const changes=[
    token=>{token.standard='ERC-20';}, token=>{token.network='Kasplex L2';},
    token=>{token.recordUrl='https://api.kasplex.org/v1/krc20/token/FAKE';},
    token=>{token.activity.opAccept='0';}, token=>{token.activity.txAccept='0';},
    token=>{token.activity.occurredAt='2020-01-01T00:00:00Z';},
    token=>{token.activity.occurredAt='2099-01-01T00:00:00Z';},
    token=>{token.activity.hash='not-a-hash';},
    token=>{token.activity.url='javascript:alert(1)';},
    token=>{token.linkCheck.status=503;},
    token=>{token.linkCheck.identity='HTTP 200 only';},
    token=>{token.linkCheck.finalUrl='https://forsale.example.invalid/';},
    token=>{token.linkCheck.checkedAt='2026-02-31T00:00:00Z';}
  ];
  for(const change of changes) {const copy=structuredClone(catalog);change(copy.entries[index].krc20);assert.throws(()=>validateCatalog(copy));}
  const rendered=renderCatalog(catalog).catalog;
  assert.match(rendered,/KRC-20 activity observed/);
  assert.match(rendered,/KRC-20 record/);
  assert.match(rendered,/Activity source/);
  const report=JSON.parse(readFileSync('docs/krc20-directory-review.json','utf8'));
  assert.deepEqual(catalog.entries.flatMap(e=>e.krc20 ? [e.krc20.ticker] : e.tokenReference ? [e.tokenReference.ticker] : []).sort(),report.includedTickers);
  assert.equal(report.includedCount+report.held.length,report.candidateCount);
  assert.ok(report.notExhaustive);
});

test('holder lookups preserve quiet tokens without asserting a current project website', () => {
  const index=catalog.entries.findIndex(e=>e.tokenReference);
  assert.ok(index>=0);
  const quiet=structuredClone(catalog);
  quiet.entries[index].tokenReference.lastObservedActivityAt='2020-01-01T00:00:00Z';
  validateCatalog(quiet);
  const output=renderCatalog(quiet).catalog;
  assert.match(output,/Token record available/);
  assert.match(output,/Earlier sampled operation/);
  for(const mutate of [
    token=>{token.recordStatus=404;}, token=>{token.deploymentHash='unknown';},
    token=>{token.recordUrl='https://example.invalid/';},
    token=>{token.ticker=catalog.entries.find(e=>e.krc20).krc20.ticker;}
  ]) {const copy=structuredClone(catalog);mutate(copy.entries[index].tokenReference);assert.throws(()=>validateCatalog(copy));}
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
  const shortcut=fixture.node('[data-directory-category-link="wallets"]','a');
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
  category.value='research';search.value='nothing';await category.emit('change');
  await shortcut.emit('click');
  assert.equal(category.value,'wallets');assert.equal(search.value,'');
  assert.equal(status.textContent,'2 of 3 resources shown.');assert.equal(walletSection.hidden,false);
  await controls.emit('submit');
});
