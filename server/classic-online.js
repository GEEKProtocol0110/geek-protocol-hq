import { isStrategy, newStrategy, moveStrategy, strategyView } from '../public/games/strategy/engine.js';
import { randomBytes, createHash } from 'node:crypto';
import { Chess } from '../public/games/chess/vendor/chess.js';
import { newCheckers, moveCheckers } from '../public/games/classics/checkers-engine.js';
import { redis, parseStoredJson, pipeline } from './redis.js';
export const ONLINE_TTL = 86400;
export const SLOW_TTL=30*86400;
const playerIndex=id=>`${prefix()}:player:${createHash("sha256").update(id).digest("hex")}`;
const prefix=()=>`geek:classic:${process.env.VERCEL_ENV==='production'?'production':createHash('sha256').update(`${process.env.VERCEL_ENV||'development'}:${process.env.VERCEL_URL||'local'}`).digest('hex').slice(0,16)}`;
export const onlineKey=code=>`${prefix()}:room:${code}`;
const indexKey=()=>`${prefix()}:index`;
const valid=code=>/^PLAY-[A-F0-9]{12}$/.test(code);
const capacityLua=`
for i=2,#KEYS do
 redis.call('ZREMRANGEBYSCORE',KEYS[i],'-inf',ARGV[5])
 if ARGV[6] ~= 'finished' and not redis.call('ZSCORE',KEYS[i],ARGV[4]) and redis.call('ZCARD',KEYS[i]) >= 10 then return -1 end
end
if ARGV[3] == '0' then redis.call('SET',KEYS[1],ARGV[2]) else redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) end
for i=2,#KEYS do
 if ARGV[6] == 'finished' then redis.call('ZREM',KEYS[i],ARGV[4]) else redis.call('ZADD',KEYS[i],ARGV[7],ARGV[4]);redis.call('PERSIST',KEYS[i]) end
end
return 1`;
export const ONLINE_CAS=`-- geek-classic-cas-v2
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
${capacityLua}`;
const ONLINE_CREATE=`if redis.call('EXISTS',KEYS[1]) == 1 then return 0 end
${capacityLua}`;
const fail=code=>{throw new Error(code);};
export function newOnlineRoom({code,game,visibility,player,dotsSize,pace,now=Date.now()}){
 if(!(['chess','checkers'].includes(game)||isStrategy(game))||!['public','private'].includes(visibility))fail('INVALID_REQUEST');
 return {code,game,visibility,pace:pace==='slow'?'slow':'live',options:{dotsSize:[4,5,6,8].includes(dotsSize)?dotsSize:6},host:{id:player.id,name:player.name},guest:null,requests:[],state:'waiting',revision:0,createdAt:now,expiresAt:now+(pace==='slow'?SLOW_TTL:ONLINE_TTL)*1000,updatedAt:now,ply:0,history:[],position:null,result:null,drawOffer:null};
}
const summary=r=>({code:r.code,game:r.game,options:r.options,hostName:r.host.name,state:r.state,createdAt:r.createdAt,expiresAt:r.expiresAt,pace:r.pace||'live'});
export function onlineView(r,id){
 const host=r.host.id===id,guest=r.guest?.id===id,member=host||guest;
 return {...summary(r),revision:r.revision,expiresAt:r.expiresAt,visibility:r.visibility,role:host?'host':guest?'guest':'visitor',guestName:r.guest?.name||null,requests:host?r.requests.map(({id,name})=>({id,name})):[],requested:r.requests.some(p=>p.playerId===id),position:member?(r.position&&isStrategy(r.game)?strategyView(r.position,host?0:1):r.position):null,history:member?r.history:[],ply:member?r.ply:0,result:member?r.result:null,drawOffer:member?r.drawOffer:null};
}
export function transitionOnline(room,id,action,body={},now=Date.now()){
 const r=structuredClone(room);if(r.expiresAt&&now>=r.expiresAt)fail('ONLINE_NOT_FOUND');
 const host=r.host.id===id,guest=r.guest?.id===id;
 if(action==='request'){
  if(r.state!=='waiting'||host)fail('ONLINE_CONFLICT');
  if(!r.requests.some(p=>p.playerId===id)){
   if(r.requests.length>=12)fail('ONLINE_FULL');
   r.requests.push({id:randomBytes(8).toString('hex'),playerId:id,name:body.name});
  }
 }else if(action==='cancel-request'){
  if(r.state!=='waiting'||!r.requests.some(p=>p.playerId===id))fail('ONLINE_CONFLICT');
  r.requests=r.requests.filter(p=>p.playerId!==id);
 }else if(action==='accept'||action==='decline'){
  if(!host)fail('ONLINE_FORBIDDEN');if(r.state!=='waiting')fail('ONLINE_CONFLICT');
  const request=r.requests.find(p=>p.id===body.requestId);if(!request)fail('ONLINE_CONFLICT');
  if(action==='decline')r.requests=r.requests.filter(p=>p.id!==request.id);
  else{r.guest={id:request.playerId,name:request.name};r.requests=[];r.state='playing';r.expiresAt=null;r.position=r.game==='chess'?new Chess().fen():r.game==='checkers'?newCheckers():newStrategy(r.game,r.options);}
 }else if(action==='cancel'){
  if(!host)fail('ONLINE_FORBIDDEN');if(r.state!=='waiting')fail('ONLINE_CONFLICT');r.state='finished';r.result='Lobby closed';r.requests=[];
 }else{
  if(!host&&!guest)fail('ONLINE_FORBIDDEN');if(r.state!=='playing')fail('ONLINE_CONFLICT');
  const side=host?'host':'guest';
  if(action==='resign'){r.state='finished';r.result=`${host?r.guest.name:r.host.name} wins by resignation`;}
  else if(action==='offer-draw'){if(r.drawOffer)fail('ONLINE_CONFLICT');r.drawOffer=side;}
  else if(action==='accept-draw'||action==='decline-draw'){
   if(!r.drawOffer||r.drawOffer===side)fail('ONLINE_CONFLICT');if(action==='accept-draw'){r.state='finished';r.result='Draw by agreement';}r.drawOffer=null;
  }else if(action==='move'){
   if(!Number.isInteger(body.revision)||body.revision!==r.revision)fail('ONLINE_STALE');
   if(r.game==='chess'){
    const c=new Chess();for(const m of r.history)c.move(m);
    if((c.turn()==='w')!==host)fail('ONLINE_TURN');
    if(typeof body.from!=='string'||typeof body.to!=='string'||!/^[a-h][1-8]$/.test(body.from)||!/^[a-h][1-8]$/.test(body.to)||body.promotion!==undefined&&!['q','r','b','n'].includes(body.promotion))fail('INVALID_REQUEST');
    let move;try{move=c.move({from:body.from,to:body.to,...(body.promotion?{promotion:body.promotion}:{})});}catch{fail('ONLINE_ILLEGAL');}
    r.history.push(move.san);r.position=c.fen();
    if(c.isCheckmate()){r.state='finished';r.result=`${host?r.host.name:r.guest.name} wins by checkmate`;}
    else if(c.isDraw()){r.state='finished';r.result=c.isStalemate()?'Draw by stalemate':'Draw by chess rules';}
   }else if(r.game==='checkers'){
    if((r.position.turn==='gold')!==host)fail('ONLINE_TURN');
    if(!Number.isInteger(body.from)||!Number.isInteger(body.to))fail('INVALID_REQUEST');
    const next=moveCheckers(r.position,body.from,body.to);if(!next)fail('ONLINE_ILLEGAL');
    r.position=next;r.history.push(`${body.from}-${body.to}`);
    if(next.winner){r.state='finished';r.result=`${next.winner==='gold'?r.host.name:r.guest.name} wins`;}
   }else if(isStrategy(r.game)){
    r.position=moveStrategy(r.position,host?0:1,body);
    const log=body.kind==='deploy'?'Fleet deployed':r.game==='battle-geek'?`Scan ${body.cell+1}: ${r.position.fleets[host?1:0].some(ship=>ship.includes(body.cell))?'hit':'miss'}`:`Move ${body.cell+1}`;
    r.history.push(log);
    if(r.position.winner!==null){r.state='finished';r.result=r.position.winner==='draw'?'Draw':`${r.position.winner===0?r.host.name:r.guest.name} wins`;}
   }else fail('INVALID_REQUEST');
   r.ply++;r.drawOffer=null;
   if(r.game!=='chess'&&r.ply>=600&&r.state==='playing'){r.state='finished';r.result='Draw at the 600-move practice limit';}
  }else fail('INVALID_REQUEST');
 }
 if(r.state==='finished'&&!r.expiresAt)r.expiresAt=now+SLOW_TTL*1000;r.revision++;r.updatedAt=now;return r;
}
export async function createOnline(player,body){
 for(let i=0;i<5;i++){
  const code=`PLAY-${randomBytes(6).toString('hex').toUpperCase()}`;
  const room=newOnlineRoom({code,player,game:body.game,visibility:body.visibility||'public',dotsSize:body.dotsSize,pace:body.pace});
  const result=await redis('EVAL',ONLINE_CREATE,2,onlineKey(code),playerIndex(player.id),'',JSON.stringify(room),Math.ceil((room.expiresAt-Date.now())/1000),code,Date.now(),room.state,room.expiresAt);if(result===-1)fail('ONLINE_LIMIT');if(result===1){
   if(room.visibility==='public')await pipeline([['ZADD',indexKey(),room.createdAt,code],['ZREMRANGEBYRANK',indexKey(),0,-101],['EXPIRE',indexKey(),SLOW_TTL]]);
   return room;
  }
 }fail('ONLINE_CONFLICT');
}
export async function loadOnline(code){
 if(!valid(code))fail('ONLINE_NOT_FOUND');const r=parseStoredJson(await redis('GET',onlineKey(code)));
 if(!r||(r.expiresAt&&Date.now()>=r.expiresAt))fail('ONLINE_NOT_FOUND');return r;
}
export async function listOnline(){
 const codes=await redis('ZREVRANGE',indexKey(),0,39);if(!Array.isArray(codes)||!codes.length)return [];
 const rooms=(await pipeline(codes.filter(valid).map(c=>['GET',onlineKey(c)]))).map(parseStoredJson);
 return rooms.filter(r=>r&&r.visibility==='public'&&r.state==='waiting'&&r.expiresAt>Date.now()).map(summary);
}
export async function updateOnline(code,id,action,body){
 for(let attempt=0;attempt<5;attempt++){
  if(!valid(code))fail('ONLINE_NOT_FOUND');const raw=await redis('GET',onlineKey(code));const r=parseStoredJson(raw);if(!r)fail('ONLINE_NOT_FOUND');
  const next=transitionOnline(r,id,action,body);const ttl=next.expiresAt?Math.max(1,Math.ceil((next.expiresAt-Date.now())/1000)):0;
  const keys=[onlineKey(code),playerIndex(next.host.id),...(next.guest?[playerIndex(next.guest.id)]:[])];const result=await redis('EVAL',ONLINE_CAS,keys.length,...keys,raw,JSON.stringify(next),ttl,code,Date.now(),next.state,next.expiresAt||'+inf');if(result===-1)fail('ONLINE_LIMIT');if(result===1)return next;
 }fail('ONLINE_STALE');
}

export function isPlayersTurn(r,id){
 if(r.state!=='playing'||!r.position)return false;
 const host=r.host.id===id;if(!host&&r.guest?.id!==id)return false;
 if(r.game==='chess')return (r.position.split(' ')[1]==='w')===host;
 if(r.game==='checkers')return (r.position.turn==='gold')===host;
 const side=host?0:1;return r.game==='battle-geek'&&r.position.phase==='deploy'?!r.position.ready[side]:r.position.turn===side;
}
export async function listMyGames(id){
 const key=playerIndex(id),now=Date.now();await redis('ZREMRANGEBYSCORE',key,'-inf',now);
 const codes=await redis('ZRANGE',key,0,9);if(!Array.isArray(codes)||!codes.length)return [];
 const rooms=(await pipeline(codes.filter(valid).map(c=>['GET',onlineKey(c)]))).map(parseStoredJson);
 return rooms.filter(r=>r&&(!r.expiresAt||r.expiresAt>now)&&r.state!=='finished'&&(r.host.id===id||r.guest?.id===id)).map(r=>({...summary(r),revision:r.revision,turnToken:r.ply,opponent:r.host.id===id?r.guest?.name||'Waiting for a player':r.host.name,yourTurn:isPlayersTurn(r,id)}));
}
