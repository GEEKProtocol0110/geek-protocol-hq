import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
import {Chess} from '../public/games/chess/vendor/chess.js';
import {newCheckers,legalCheckers,moveCheckers} from '../public/games/classics/checkers-engine.js';
import {newSolitaire,drawSolitaire,moveSolitaire,solitaireWon} from '../public/games/classics/solitaire-engine.js';
import {setup,question,grade,advance,MODES,LEVELS} from '../public/games/brain/engine.js';

// Model the browser's focus-driven scroll separately from explicit session entry.
function ui(file,game,extra={}){
 const f=clientFixture(undefined,{structuredClone,Chess,newCheckers,legalCheckers,moveCheckers,newSolitaire,drawSolitaire,moveSolitaire,solitaireWon,setup,question,grade,advance,MODES,LEVELS,localStorage:{getItem:()=>null},...extra});
 let jumps=0,focusCalls=0;
 const watch=el=>{el.classList.add=()=>{};el.classList.remove=()=>{};if(!el.watched){el.watched=true;const original=el.focus;el.focus=options=>{focusCalls++;if(!options?.preventScroll)jumps++;original.call(el);};}return el;};
 f.document.createElement=tag=>watch(f.make(tag));f.document.getElementById=id=>watch(f.node('#'+id));
 const query=f.document.querySelector;f.document.querySelector=selector=>selector==='dialog[open]'?null:watch(query(selector));
 f.document.body=f.make('body');f.document.body.dataset.game=game;f.document.body.classList.add=()=>{};f.document.body.classList.remove=()=>{};
 f.context.createChessPiece=()=>f.make('span');
 f.node('#mode').value='sequence';f.node('#level').value='easy';
 f.run(readFileSync(file,'utf8').replace(/^import .*\n/gm,''));
 return {...f,jumps:()=>jumps,focusCalls:()=>focusCalls};
}
test('chess selection, legal move and undo retain focus without a scroll request',async()=>{
 const f=ui('public/games/chess/chess.js','chess');await f.node('#start').emit('click');
 const before=f.jumps();const square=name=>f.node('#board').children.find(b=>b.dataset.square===name);
 await square('e2').emit('click');assert.match(square('e4').getAttribute('aria-label'),/legal destination/);
 await square('e4').emit('click');assert.match(f.node('#status').textContent,/Black to move/);
 await f.node('#undo').emit('click');assert.match(f.node('#status').textContent,/White to move/);
 assert.ok(f.focusCalls()>=4,'Keyboard focus must still be restored');assert.equal(f.jumps(),before);
});
test('checkers selection and move do not pull the viewport back to the status',async()=>{
 const f=ui('public/games/classics/classics.js','checkers');await f.node('#start').emit('click');const before=f.jumps();
 await f.node('#board').children[40].emit('click');await f.node('#board').children[33].emit('click');
 assert.match(f.node('#status').textContent,/cyan to move/);assert.equal(f.jumps(),before);
 await f.node('#undo').emit('click');assert.equal(f.jumps(),before);
});
test('Solitaire card selection, drawing and undo keep the existing viewport',async()=>{
 const f=ui('public/games/classics/classics.js','solitaire');await f.node('#start').emit('click');const before=f.jumps();
 await f.node('#tableau').children[0].children[1].emit('click');assert.match(f.node('#status').textContent,/selected/);
 await f.node('#stock').emit('click');await f.node('#waste').children[0].emit('click');
 await f.node('#undo').emit('click');assert.match(f.node('#stock').textContent,/24/);assert.equal(f.jumps(),before);
});
test('Brain Lab memorizing, answering, feedback and next question retain focus without scrolling',async()=>{
 const f=ui('public/games/brain/brain.js');await f.node('#start').emit('click');const before=f.jumps();
 f.node('#answer').value=f.node('#prompt').textContent;await f.node('#memorized').emit('click');
 await f.node('#number-form').emit('submit');assert.match(f.node('#feedback').textContent,/Correct/);
 await f.node('#next').emit('click');assert.match(f.node('#progress').textContent,/Round 2/);
 assert.ok(f.focusCalls()>=4);assert.equal(f.jumps(),before);
});
