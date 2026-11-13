import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../public/games/chess/vendor/chess.js';
test('opening perft verifies legal move generation at depth three',()=>{function count(c,d){if(!d)return 1;let n=0;for(const m of c.moves()){c.move(m);n+=count(c,d-1);c.undo();}return n;}assert.equal(count(new Chess(),3),8902);});
test('checkmate and undo restore playable position',()=>{const c=new Chess();for(const m of ['f3','e5','g4','Qh4#'])c.move(m);assert.ok(c.isCheckmate());c.undo();assert.equal(c.isGameOver(),false);});
test('castling, en passant and underpromotion',()=>{const c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');c.move('O-O');assert.equal(c.get('f1').type,'r');const e=new Chess();for(const m of ['e4','a6','e5','d5','exd6'])e.move(m);assert.equal(e.get('d5'),undefined);const p=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');p.move({from:'a7',to:'a8',promotion:'n'});assert.equal(p.get('a8').type,'n');});
test('draw conditions and king safety',()=>{const c=new Chess();for(let i=0;i<2;i++)for(const m of ['Nf3','Nf6','Ng1','Ng8'])c.move(m);assert.ok(c.isThreefoldRepetition());assert.ok(new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1').isStalemate());const pinned=new Chess('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');assert.ok(!pinned.moves({square:'e2',verbose:true}).some(m=>m.to==='d2'));});
