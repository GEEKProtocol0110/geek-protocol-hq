import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture,json} from './helpers/client-fixture.js';
const source=readFileSync(new URL('../public/ops-login/assets/login.js',import.meta.url),'utf8');
const login=async search=>{
  const destinations=[],requests=[];
  const ui=clientFixture(async(url,options)=>{requests.push({url,options});return json({ok:true});});
  ui.window.location={search,replace:value=>destinations.push(value)};
  const form=ui.node('[data-ops-login]');form.elements={key:ui.make('input'),code:ui.make('input')};form.append(ui.make('button'));
  form.elements.key.value='synthetic-owner-access-not-a-real-key';form.elements.code.value='123456';
  ui.run(source);await form.emit('submit');return{...ui,form,destinations,requests};
};
test('successful owner login preserves the fixed GEEKT desk destination and clears entered credentials',async()=>{
  const ui=await login('?next=testnet');assert.deepEqual(ui.destinations,['/ops/testnet/']);
  assert.match(ui.node('[data-login-destination]').textContent,/GEEKT test payout/);
  assert.equal(ui.form.elements.key.value,'');assert.equal(ui.form.elements.code.value,'');
  assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].url,'/api/session/?service=operations&action=login');
  assert.equal(ui.requests[0].options.credentials,'same-origin');
});
test('login cannot redirect to external, arbitrary, duplicate or malformed destinations',async()=>{
  for(const query of ['', '?next=https://evil.invalid','?next=//evil.invalid','?next=/ops/testnet/','?next=other','?next=testnet&next=testnet','?next=testnet&next=https://evil.invalid','?next=%00testnet']){
    assert.deepEqual((await login(query)).destinations,['/ops/'],query);
  }
});
