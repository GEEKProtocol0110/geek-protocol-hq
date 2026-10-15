import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultGeek,personalGeek,normalizeGeek,geekSvg,geekDescription } from '../public/assets/geek-avatar.js';
import { storeGroups,storeItems,tryStoreItem } from '../public/store/assets/catalog.js';
import { saveStorePreview,takeStorePreview,storePreviewKey } from '../public/store/assets/preview.js';
import { clientFixture } from './helpers/client-fixture.js';

const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('every store part uses the server-validated cosmetic vocabulary and keeps payment and reward authority closed',()=>{
  assert.equal(new Set(storeItems.map(i=>i.id)).size,storeItems.length);
  for(const item of storeItems){assert.equal(item.purchasesEnabled,false);assert.equal(item.grantsRewards,false);if(item.availability!=='free')assert.equal(item.priceRaw,null);
    if(!item.part)continue;
    for(const base of [personalGeek,defaultGeek]){
      if(!item.modes.includes(base.kind)||(base.kind==='human'&&item.value==='antenna'))continue;
      const design=tryStoreItem(base,item.id);assert.deepEqual(normalizeGeek(design,true),design);assert.match(geekSvg(design),/^<svg /);assert.equal(design[item.part],item.value);
    }
  }
  for(const id of ['outfit-labcoat','outfit-fieldcoat','head-goggles','back-fieldkit','arms-scanner'])assert.ok(storeItems.some(i=>i.id===id&&i.availability==='free'),id);
  assert.throws(()=>tryStoreItem(personalGeek,'arms-scanner'),/STORE_ITEM_UNAVAILABLE/);assert.throws(()=>tryStoreItem(personalGeek,'unknown'),/STORE_ITEM_UNAVAILABLE/);
  assert.equal(storeItems.filter(i=>i.practiceUrl).length,2);assert.ok(storeItems.filter(i=>i.practiceUrl).every(i=>i.practiceUrl==='/practice/'));
});
test('store handoff expires, rejects malformed or arbitrary traits and consumes a valid preview only once',()=>{
  const storage=memory();saveStorePreview(storage,personalGeek,100000);assert.deepEqual(takeStorePreview(storage,100001),personalGeek);assert.equal(takeStorePreview(storage,100002),null);
  for(const value of ['{',JSON.stringify({version:1,createdAt:100000,design:{...personalGeek,fx:'<script>'}}),JSON.stringify({version:1,createdAt:100000,design:personalGeek,owned:true})]){storage.setItem(storePreviewKey,value);assert.equal(takeStorePreview(storage,100001),null);assert.equal(storage.map.size,0);}
  saveStorePreview(storage,personalGeek,100000);assert.equal(takeStorePreview(storage,2000000),null);
  saveStorePreview(storage,personalGeek,100000);assert.equal(takeStorePreview(storage,0),null);
  assert.equal(takeStorePreview({getItem(){throw Error('Blocked');}}),null);
});
test('the shipped store filters and previews items without API writes; only explicit review creates a studio handoff',async()=>{
  const storage=memory();let destination='',requests=0;
  const ui=clientFixture(()=>{requests++;throw Error('Store must not issue API requests');},{defaultGeek,personalGeek,normalizeGeek,geekSvg,geekDescription,storeGroups,storeItems,tryStoreItem,saveStorePreview});
  const make=ui.document.createElement;ui.document.createElement=tag=>{const el=make(tag);el.prepend=(...items)=>{for(const child of items)child.parent=el;el.children.unshift(...items);};return el;};
  ui.window.sessionStorage=storage;ui.window.location={assign:path=>{destination=path;}};
  for(const side of ['front','back'])ui.node(`[data-store-view="${side}"]`,'button');
  const source=readFileSync(new URL('../public/store/assets/store.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');ui.run(source);
  await ui.node('[data-store-item="outfit-labcoat"]').emit('click');assert.match(ui.node('[data-store-look]').textContent,/Lab coat/);assert.equal(ui.node('[data-store-fitting]').open,true);assert.equal(storage.map.size,0);assert.equal(requests,0);
  await ui.node('[data-store-group="lifelines"]').emit('click');assert.equal(ui.node('[data-store-items]').children.length,6);
  ui.node('[data-store-search]').value='no matching item';await ui.node('[data-store-search]').emit('input');assert.equal(ui.node('[data-store-count]').textContent,'0 items shown');
  await ui.node('[data-store-review]').emit('click');assert.equal(destination,'/profile/?store=preview#geek-builder');assert.equal(takeStorePreview(storage).outfit,'labcoat');assert.equal(requests,0);
});
