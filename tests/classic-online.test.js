import test from 'node:test';
import assert from 'node:assert/strict';
import { newOnlineRoom, transitionOnline, onlineView } from '../server/classic-online.js';
const room=(game='chess')=>newOnlineRoom({code:'PLAY-0123456789AB',game,visibility:'private',player:{id:'host',name:'First Geek'}});
const active=(game='chess')=>{const r=transitionOnline(room(game),'guest','request',{name:'Second Geek'});return transitionOnline(r,'host','accept',{requestId:r.requests[0].id});};
const move=(r,id,from,to,extra={})=>transitionOnline(r,id,'move',{revision:r.revision,from,to,...extra});
test('requests need host acceptance and expose no identities',()=>{
 let r=room();r=transitionOnline(r,'guest','request',{name:'Second Geek'});assert.equal(r.state,'waiting');assert.equal(onlineView(r,'guest').requested,true);
 assert.equal(onlineView(r,'visitor').requests.length,0);assert.equal(JSON.stringify(onlineView(r,'host')).includes('playerId'),false);
 assert.throws(()=>transitionOnline(r,'guest','accept',{requestId:r.requests[0].id}),/ONLINE_FORBIDDEN/);
 const started=transitionOnline(r,'host','accept',{requestId:r.requests[0].id});assert.equal(started.state,'playing');assert.equal(started.guest.id,'guest');assert.equal(onlineView(started,'visitor').position,null);
 assert.throws(()=>transitionOnline(started,'other','request',{name:'Third'}),/ONLINE_CONFLICT/);
 assert.throws(()=>transitionOnline(started,'host','accept',{requestId:r.requests[0].id}),/ONLINE_CONFLICT/);
});
test('decline, withdraw, expiry and closed rooms cannot start',()=>{
 let r=transitionOnline(room(),'guest','request',{name:'Second'});r=transitionOnline(r,'guest','cancel-request');assert.equal(r.requests.length,0);
 assert.throws(()=>transitionOnline(r,'outsider','cancel-request'),/ONLINE_CONFLICT/);
 r=transitionOnline(r,'guest','request',{name:'Second'});r=transitionOnline(r,'host','decline',{requestId:r.requests[0].id});assert.equal(r.requests.length,0);
 r=transitionOnline(r,'host','cancel');assert.equal(r.state,'finished');assert.throws(()=>transitionOnline(r,'guest','request',{name:'Second'}),/ONLINE_CONFLICT/);
 assert.throws(()=>transitionOnline(room(),'guest','request',{name:'Second'},Date.now()+86400001),/ONLINE_NOT_FOUND/);
});
test('chess enforces sides, stale revisions and king safety; replayed moves cannot apply twice',()=>{
 let r=active();const original=structuredClone(r);
 assert.throws(()=>move(r,'guest','e7','e5'),/ONLINE_TURN/);assert.throws(()=>move(r,'visitor','e2','e4'),/ONLINE_FORBIDDEN/);assert.throws(()=>move(r,'host','e2','e5'),/ONLINE_ILLEGAL/);
 r=move(r,'host','e2','e4');assert.equal(r.history[0],'e4');assert.equal(original.history.length,0);assert.equal(original.ply,0);
 assert.throws(()=>transitionOnline(r,'guest','move',{from:'e7',to:'e5',revision:r.revision-1}),/ONLINE_STALE/);
 r=move(r,'guest','e7','e5');assert.equal(r.ply,2);assert.equal(onlineView(r,'host').role,'host');assert.equal(onlineView(r,'guest').history.length,2);
});
test('chess detects mate and blocks moves after completion',()=>{
 let r=active();for(const [id,from,to] of [['host','f2','f3'],['guest','e7','e5'],['host','g2','g4'],['guest','d8','h4']])r=move(r,id,from,to);
 assert.equal(r.state,'finished');assert.match(r.result,/Second Geek wins by checkmate/);assert.throws(()=>move(r,'host','a2','a3'),/ONLINE_CONFLICT/);
});
test('checkers enforces compulsory capture, chained jumps and turn ownership',()=>{
 let r=active('checkers');assert.throws(()=>move(r,'guest',17,24),/ONLINE_TURN/);
 r.position={board:Array(64).fill(null),turn:'gold',forced:null,winner:null};r.position.board[42]={side:'gold',king:false};r.position.board[33]={side:'cyan',king:false};r.position.board[17]={side:'cyan',king:false};r.position.board[1]={side:'cyan',king:false};
 assert.throws(()=>move(r,'host',42,35),/ONLINE_ILLEGAL/);r=move(r,'host',42,24);assert.equal(r.position.forced,24);assert.throws(()=>move(r,'guest',17,26),/ONLINE_TURN/);r=move(r,'host',24,10);assert.equal(r.position.turn,'cyan');
});
test('draws require opponent consent and resignations preserve a final board',()=>{
 let r=active();assert.throws(()=>transitionOnline(r,'visitor','resign'),/ONLINE_FORBIDDEN/);r=transitionOnline(r,'host','offer-draw');assert.throws(()=>transitionOnline(r,'host','accept-draw'),/ONLINE_CONFLICT/);
 let declined=transitionOnline(r,'guest','decline-draw');assert.equal(declined.drawOffer,null);assert.equal(declined.state,'playing');
 const agreed=transitionOnline(r,'guest','accept-draw');assert.equal(agreed.result,'Draw by agreement');
 const resigned=transitionOnline(active(),'guest','resign');assert.match(resigned.result,/First Geek wins/);assert.ok(resigned.position);
});
test('request bounds, input validation and 600-ply limit are enforced',()=>{
 let r=room('checkers');for(let i=0;i<12;i++)r=transitionOnline(r,'g'+i,'request',{name:'Geek'});assert.throws(()=>transitionOnline(r,'extra','request',{name:'Extra'}),/ONLINE_FULL/);
 assert.throws(()=>newOnlineRoom({game:'solitaire',visibility:'public',player:{id:'h',name:'Host'}}),/INVALID_REQUEST/);
 r=active();assert.throws(()=>move(r,'host','e2','e4',{promotion:'king'}),/INVALID_REQUEST/);
 r=active('checkers');r.ply=599;r=move(r,'host',40,33);assert.equal(r.state,'finished');assert.match(r.result,/600/);
});
