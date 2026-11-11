import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
const source=readFileSync('public/assets/cosmic-glitch.js','utf8').replace('export const','const');
function setup(path='/'){
 const f=clientFixture(()=>{throw Error('No requests');},{location:{pathname:path}}),listeners={};let reduced=false,forced=false,playing=false;
 f.document.body=f.make('body');f.document.body.classList={contains:()=>playing};f.document.addEventListener=(name,fn)=>listeners[name]=fn;f.window.matchMedia=q=>({get matches(){return q.includes('reduced')?reduced:forced;}});
 f.run(source);return {...f,click:target=>listeners.click?.({target:{closest:()=>target},button:0}),listeners,reduced:v=>reduced=v,forced:v=>forced=v,playing:v=>playing=v};
}
test('cosmic feedback skips game/account routes and installs once',()=>{
 for(const path of ['/games/chess/','/play/','/ops/','/sign-in/','/study/','/store/'])assert.equal(setup(path).listeners.click,undefined);
 const f=setup();const original=f.listeners.click;f.run(source.replaceAll('initCosmicGlitch','initCosmicGlitchAgain'));assert.equal(f.listeners.click,original);
});
test('edge feedback is bounded, respects reduced motion and never activates disabled or active-game controls',()=>{
 const f=setup(),target=f.make('button');let active=false;target.classList={add:()=>active=true,remove:()=>active=false};
 f.reduced(true);f.click(target);assert.equal(active,false);f.reduced(false);f.forced(true);f.click(target);assert.equal(active,false);f.forced(false);f.playing(true);f.click(target);assert.equal(active,false);f.playing(false);target.disabled=true;f.click(target);assert.equal(active,false);target.disabled=false;
 f.click(target);assert.equal(active,true);assert.equal(f.timers.size,1);f.click(target);assert.equal(f.timers.size,1);f.expire(360);assert.equal(active,false);f.click(target);assert.equal(active,true);
});
