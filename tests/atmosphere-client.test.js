import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
const source=readFileSync(new URL('../public/assets/atmosphere.js',import.meta.url),'utf8').replace(/^import .*;\n/m,'').replace('export const','const');
const mount=ready=>{
 let styled=ready;
 const f=clientFixture(()=>{throw new Error('Decoration must not fetch player data');},{holidayById:()=>null});
 f.document.documentElement=f.node('html','html');f.document.body=f.node('body','body');
 f.document.body.prepend=child=>{child.parent=f.document.body;f.document.body.children.unshift(child);};
 f.document.body.classList.add=()=>{};
 const select=f.document.querySelector;
 f.document.querySelector=selector=>selector==='[data-hq-cosmos]'?(f.document.querySelectorAll(selector)[0]||null):select(selector);
 f.node('main','main');f.node('h1','h1').classList.add=()=>{};
 f.window.getComputedStyle=()=>({getPropertyValue:()=>styled?'1':''});
 f.run(source);return {...f,setStyled:v=>{styled=v;}};
};

test('missing or failed atmosphere CSS never exposes decorative text above the header',()=>{
 const f=mount(false);
 assert.equal(f.document.querySelectorAll('[data-hq-cosmos]').length,0);
 assert.equal(f.document.body.children.length,0);
 f.window.dispatchEvent(new Event('load'));
 assert.equal(f.document.querySelectorAll('[data-hq-cosmos]').length,0);
});

test('loaded atmosphere CSS enables one aria-hidden background and repeated initialization stays unique',()=>{
 const f=mount(true),scene=f.node('[data-hq-cosmos]');
 assert.equal(f.document.querySelectorAll('[data-hq-cosmos]').length,1);
 assert.equal(scene.getAttribute('aria-hidden'),'true');assert.equal(scene.children.length,2);
 assert.match(scene.children[0].textContent,/01001011/);
 f.window.dispatchEvent(new Event('load'));
 assert.equal(f.document.querySelectorAll('[data-hq-cosmos]').length,1);
});

test('late styling enables decoration at load without inserting an unstyled intermediate block',()=>{
 const f=mount(false);assert.equal(f.document.body.children.length,0);
 f.setStyled(true);f.window.dispatchEvent(new Event('load'));
 assert.equal(f.document.querySelectorAll('[data-hq-cosmos]').length,1);
});
