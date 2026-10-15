import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture,json } from './helpers/client-fixture.js';
const source=readFileSync(new URL('../public/contribute/assets/cce.js',import.meta.url),'utf8');
for(const failed of [false,true])test(`Contribute starts with a read-only readiness check and keeps intake closed${failed?' on service failure':''}`,async()=>{
  const requests=[];const ui=clientFixture(async(path,options)=>{requests.push({path,options});if(failed)throw Error('Service unavailable');return json({ok:true,readiness:{submissionsEnabled:false}});},{localStorage:{getItem:()=>null}});
  const form=ui.node('[data-question-form]');form.elements={displayName:{value:''}};form.reportValidity=()=>{throw Error('Held forms must not reach validation or submit');};
  ui.node('[data-submission-fields]').disabled=true;
  ui.run(source);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests.map(r=>r.path),['/api/content/?view=readiness']);assert.ok(requests.every(r=>!r.options.method||r.options.method==='GET'));
  assert.equal(ui.node('[data-submission-fields]').disabled,true);
  await form.emit('submit');assert.equal(requests.length,1);assert.match(ui.node('[data-form-message]').textContent,/hold|prepared/i);
});
