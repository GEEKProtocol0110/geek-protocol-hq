import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
test('game finish opens once, preserves board review and wires local and online replay',async()=>{
 const f=clientFixture(()=>{throw Error('No network');});let listener,replays=0,backs=0;
 f.document.body=f.make('body');f.document.getElementById=id=>({click(){if(id==='start')replays++;if(id==='back')backs++;}});
 f.document.addEventListener=(name,fn)=>{if(name==='geek-game-state')listener=fn;};
 const create=f.document.createElement;f.document.createElement=tag=>{const el=create(tag);el.remove=()=>{el.parent.children=el.parent.children.filter(x=>x!==el);};return el;};
 f.run(readFileSync('public/games/assets/finish.js','utf8'));
 const send=detail=>listener({detail});send({finished:false});assert.equal(f.document.body.children.length,0);
 send({finished:true,title:'Gold wins!',detail:'Five ships sunk'});let modal=f.document.body.children[0];assert.equal(modal.open,true);assert.equal(f.document.activeElement,modal.children[5].children[0]);assert.equal(modal.children[0].children.length,30);
 send({finished:true,title:'Gold wins!'});assert.equal(f.document.body.children.length,1);await modal.children[5].children[2].emit('click');assert.equal(modal.open,false);
 send({finished:true,title:'Gold wins!'});assert.equal(modal.open,false);await modal.children[5].children[0].emit('click');assert.equal(replays,1);
 send({finished:true,title:'Draw',online:true,key:'room-a'});modal=f.document.body.children[0];await modal.children[5].children[0].emit('click');assert.equal(backs,1);
 send({finished:false});send({finished:true,title:'No jumps left',celebrate:false});assert.equal(f.document.body.children[0].children[0].children.length,0);
});
