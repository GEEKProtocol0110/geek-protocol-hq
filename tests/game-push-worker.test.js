import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync('public/games/online/turn-alerts-sw.js','utf8');
function worker(response){const events={},notices=[],opened=[];const context={URL,Number,encodeURIComponent,AbortSignal,fetch:async()=>response,self:{location:{origin:'https://www.geekprotocol.xyz'},addEventListener:(name,fn)=>events[name]=fn,registration:{showNotification:async(title,options)=>notices.push({title,options})},clients:{claim:async()=>{},matchAll:async()=>[{url:'https://www.geekprotocol.xyz/games/online/',navigate:async()=>{throw Error('uncontrolled')}}],openWindow:async url=>opened.push(url)}}};vm.runInNewContext(source,context);return {events,notices,opened,async push(data){let promise;events.push({data:{json:()=>data},waitUntil(p){promise=p;}});await promise;}};}
test('push worker shows a generic your-turn alert only for the current authenticated player/ply',async()=>{
 const code='PLAY-0123456789AB',f=worker(Response.json({myGames:[{code,yourTurn:true,turnToken:1}]}));await f.push({code,ply:1});assert.equal(f.notices.length,1);assert.match(f.notices[0].title,/Your turn/);assert.equal(f.notices[0].options.renotify,false);assert.equal(f.notices[0].options.data.code,code);
 let p;f.events.notificationclick({notification:{close(){},data:{code}},waitUntil(v){p=v;}});await p;assert.deepEqual(f.opened,[`https://www.geekprotocol.xyz/games/online/?room=${code}`]);
});
test('account switching, stale turns and invalid push payloads cannot reveal a game alert',async()=>{
 for(const response of [new Response('',{status:401}),Response.json({myGames:[]}),Response.json({myGames:[{code:'PLAY-0123456789AB',yourTurn:false,turnToken:2}]})]){const f=worker(response);await f.push({code:'PLAY-0123456789AB',ply:1});assert.equal(f.notices.length,0);}
 const f=worker(Response.json({}));await f.push({code:'https://evil.invalid',ply:1});assert.equal(f.notices.length,0);
});
