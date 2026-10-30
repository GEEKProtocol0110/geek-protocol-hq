import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';

const home=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const welcome=readFileSync(new URL('../public/assets/welcome.js',import.meta.url),'utf8');
const decode=value=>value.replaceAll('&amp;','&');
const hero=home.slice(home.indexOf('<section class="hero"'),home.indexOf('<section class="home-first-steps"'));
const actions=[...hero.matchAll(/<a class="button ([^"]+)" href="([^"]+)"/g)];

test('the first actions go directly to Daily Signal and the beginner Kaspa lesson without a setup detour',()=>{
 assert.equal(actions.length,2);assert.equal(actions.filter(a=>a[1]==='button-primary').length,1);
 const play=new URL(decode(actions[0][2]),'https://www.geekprotocol.xyz');
 assert.equal(play.pathname,'/play/');assert.equal(play.searchParams.get('mode'),'daily');assert.equal(play.searchParams.get('category'),'kaspa');assert.equal(play.hash,'#timed-games');
 const study=new URL(decode(actions[1][2]),play.origin);assert.equal(study.pathname,'/study/');assert.equal(study.searchParams.get('topic'),'origins');assert.equal(study.searchParams.get('level'),'foundations');
 assert.ok(hero.includes('No wallet needed'));assert.ok(hero.includes('5 timed quiz questions'));assert.ok(hero.includes('One quiz attempt per UTC day'));assert.ok(!hero.includes('href="./start/"'));
 for(const path of ['play','study','sign-in','start'])assert.ok(existsSync(new URL(`../public/${path}/index.html`,import.meta.url)));
});
test('sign-in is outside the collapsed navigation and explains saved-player recovery without a save requirement',()=>{
 const header=home.slice(home.indexOf('<header'),home.indexOf('</header>'));
 assert.match(header,/<div class="home-header-actions"><a class="home-sign-in" href="\/sign-in\/" data-nav-account>Sign in<\/a>/);
 assert.ok(header.indexOf('data-menu-toggle')<header.indexOf('<nav '),'Keyboard order reaches the opened menu after its toggle');
 assert.match(hero,/Recover a saved player/);assert.match(hero,/Guest progress follows this browser/);
});
test('extra games and ecosystem links remain reachable inside closed native details',()=>{
 for(const id of ['more-ways-to-play','community-and-tools','our-story','our-vision','live-status']){
  const tag=home.match(new RegExp(`<details[^>]*id="${id}"[^>]*>`))?.[0];assert.ok(tag,id);assert.ok(!/\sopen(?:\s|>|=)/.test(tag));
 }
 for(const href of ['/tools/kaspa-widget/','https://geek-mini.vercel.app/','https://geekjr.xyz/','/thanks/','/study/?topic=wallets&amp;level=foundations','https://wallet.geekprotocol.xyz/'])assert.ok(home.includes(`href="${href}"`),href);
 assert.ok(home.indexOf('class="hero-actions"')<home.indexOf('id="community-and-tools"'));
});

function deepLink(id,search=''){
 const ui=clientFixture(()=>{throw new Error('Navigation must not start a game or send requests');},{location:{origin:'https://www.geekprotocol.xyz',pathname:'/play/',search,hash:`#${id}`},requestAnimationFrame:fn=>fn()});
 class Details {}
 const parent=Object.setPrototypeOf(ui.make('details'),Details.prototype),target=ui.make('section'),summary=ui.make('summary');
 parent.open=false;parent.append(summary);parent.append(target);target.parentElement=parent;target.id=id;
 ui.document.getElementById=key=>key===id?target:key==='timed-games'?parent:null;
 ui.context.HTMLDetailsElement=Details;
 ui.run(welcome);return {...ui,parent,target};
}
test('the shipped deep-link handler opens nested content and focuses the target without starting a game',()=>{
 const ui=deepLink('free-tools');assert.equal(ui.parent.open,true);assert.equal(ui.document.activeElement,ui.target);assert.equal(ui.target.scrolled.block,'start');
});
test('the quiz link opens and focuses its existing timed setup while preserving explicit game start',()=>{
 const play=new URL(decode(actions[0][2]),'https://www.geekprotocol.xyz');
 const ui=deepLink('timed-games',play.search);assert.equal(ui.parent.open,true);assert.equal(ui.target.scrolled.block,'start');assert.equal(ui.document.activeElement,ui.target);
});
