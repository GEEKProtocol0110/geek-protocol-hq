import { isStrategy, newStrategy, moveStrategy, strategyView } from '../public/games/strategy/engine.js';
import { randomBytes, createHash } from 'node:crypto';
import { Chess } from '../public/games/chess/vendor/chess.js';
import { newCheckers, moveCheckers } from '../public/games/classics/checkers-engine.js';
import { redis, parseStoredJson, pipeline } from './redis.js';
export const ONLINE_TTL = 86400;
const prefix=()=>`geek:classic:${process.env.VERCEL_ENV==='production'?'production':createHash('sha256').update(`${process.env.VERCEL_ENV||'development'}:${process.env.VERCEL_URL||'local'}`).digest('hex').slice(0,16)}`;
export const onlineKey=code=>`${prefix()}:room:${code}`;
export const indexKey=()=>`${prefix()}:index`;
const valid=code=>/^PLAY-[A-F0-9]{12}$/.test(code);
export const ONLINE_CAS=`-- geek-classic-cas-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3])
return 1`;
const fail=code=>{throw new Error(code);};
// Public lobby names are a broadcast surface: block link-like and staff-like names.
const LEET={'0':'o','1':'i','!':'i','|':'i','3':'e','4':'a','@':'a','5':'s','$':'s','7':'t','+':'t','8':'b','9':'g'};
const STAFF=/official|admin(?!ton)|moderat|support/;
const RESERVED=['geek','gee','team'],FILLER=['the','real','protocol','onkas','kaspa','kas','on','staff','dev','bot','mod'];
const LINKLIKE=/https?:|www\.|t\.me|discord\.|[a-z0-9-]\.[a-z]{2,}\b|[a-z0-9-]\s*(\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}\b/i;
const reservedOnly=w=>{const words=[...RESERVED,...FILLER];const ok=Array(w.length+1).fill(false),hit=Array(w.length+1).fill(false);ok[0]=true;
 for(let i=0;i<w.length;i++)if(ok[i])for(const x of words)if(w.startsWith(x,i)){ok[i+x.length]=true;hit[i+x.length]||=hit[i]||RESERVED.includes(x);}
 return ok[w.length]&&hit[w.length];};
export function publicNameAllowed(name){
 const raw=String(name||'');if(!raw.trim()||LINKLIKE.test(raw))return false;
 const w=raw.toLowerCase().replace(/[0-9!|@$+]/g,c=>LEET[c]||c).replace(/[^a-z]/g,'');
 return !STAFF.test(w)&&!reservedOnly(w);
}
export function newOnlineRoom({code,game,visibility,player,dotsSize,now=Date.now()}){
 if(!(['chess','checkers'].includes(game)||isStrategy(game))||!['public','private'].includes(visibility))fail('INVALID_REQUEST');
 return {code,game,visibility,options:{dotsSize:[4,5,6,8].includes(dotsSize)?dotsSize:6},host:{id:player.id,name:player.name},guest:null,requests:[],state:'waiting',revision:0,createdAt:now,expiresAt:now+ONLINE_TTL*1000,updatedAt:now,ply:0,history:[],position:null,result:null,drawOffer:null};
}
const summary=r=>({code:r.code,game:r.game,options:r.options,hostName:r.host.name,state:r.state,createdAt:r.createdAt});
export function onlineView(r,id){
 const host=r.host.id===id,guest=r.guest?.id===id,member=host||guest;
 return {...summary(r),revision:r.revision,expiresAt:r.expiresAt,visibility:r.visibility,role:host?'host':guest?'guest':'visitor',guestName:r.guest?.name||null,requests:host?r.requests.map(({id,name})=>({id,name})):[],requested:r.requests.some(p=>p.playerId===id),position:member?(r.position&&isStrategy(r.game)?strategyView(r.position,host?0:1):r.position):null,history:member?r.history:[],ply:member?r.ply:0,result:member?r.result:null,drawOffer:member?r.drawOffer:null};
}
export function transitionOnline(room,id,action,body={},now=Date.now()){
 const r=structuredClone(room);if(now>=r.expiresAt)fail('ONLINE_NOT_FOUND');
 const host=r.host.id===id,guest=r.guest?.id===id;
 if(action==='request'){
  if(r.state!=='waiting'||host)fail('ONLINE_CONFLICT');
  if((r.blocked||[]).some(b=>b.playerId===id||body.ip&&b.ip===body.ip))fail('ONLINE_BLOCKED');
  if(!publicNameAllowed(body.name))fail('ONLINE_NAME_NOT_ALLOWED');
  if(!r.requests.some(p=>p.playerId===id)){
   if(r.requests.length>=12)fail('ONLINE_FULL');
   r.requests.push({id:randomBytes(8).toString('hex'),playerId:id,name:body.name,ip:typeof body.ip==='string'?body.ip:''});
  }
 }else if(action==='cancel-request'){
  if(r.state!=='waiting'||!r.requests.some(p=>p.playerId===id))fail('ONLINE_CONFLICT');
  r.requests=r.requests.filter(p=>p.playerId!==id);
 }else if(action==='accept'||action==='decline'||action==='block'){
  if(!host)fail('ONLINE_FORBIDDEN');if(r.state!=='waiting')fail('ONLINE_CONFLICT');
  const request=r.requests.find(p=>p.id===body.requestId);if(!request)fail('ONLINE_CONFLICT');
  if(action==='block'){r.blocked=[...(r.blocked||[]),{playerId:request.playerId,ip:request.ip||''}].slice(-24);r.requests=r.requests.filter(p=>p.playerId!==request.playerId&&!(request.ip&&p.ip===request.ip));}
  else if(action==='decline')r.requests=r.requests.filter(p=>p.id!==request.id);
  else{r.guest={id:request.playerId,name:request.name};r.requests=[];r.state='playing';r.position=r.game==='chess'?new Chess().fen():r.game==='checkers'?newCheckers():newStrategy(r.game,r.options);}
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
   if(r.ply>=600&&r.state==='playing'){r.state='finished';r.result='Draw at the 600-move practice limit';}
  }else fail('INVALID_REQUEST');
 }
 r.revision++;r.updatedAt=now;return r;
}
export async function createOnline(player,body){
 for(let i=0;i<5;i++){
  const code=`PLAY-${randomBytes(6).toString('hex').toUpperCase()}`;
  if(!publicNameAllowed(player.name))fail('ONLINE_NAME_NOT_ALLOWED');
  const room=newOnlineRoom({code,player,game:body.game,visibility:body.visibility||'public',dotsSize:body.dotsSize});
  if(await redis('SET',onlineKey(code),JSON.stringify(room),'EX',ONLINE_TTL,'NX')==='OK'){
   if(room.visibility==='public')await pipeline([['ZADD',indexKey(),room.createdAt,code],['ZREMRANGEBYRANK',indexKey(),0,-101],['EXPIRE',indexKey(),ONLINE_TTL]]);
   return room;
  }
 }fail('ONLINE_CONFLICT');
}
export async function loadOnline(code){
 if(!valid(code))fail('ONLINE_NOT_FOUND');const r=parseStoredJson(await redis('GET',onlineKey(code)));
 if(!r||Date.now()>=r.expiresAt)fail('ONLINE_NOT_FOUND');return r;
}
export async function listOnline(){
 const codes=await redis('ZREVRANGE',indexKey(),0,39);if(!Array.isArray(codes)||!codes.length)return [];
 const listed=codes.filter(valid),rooms=(await pipeline(listed.map(c=>['GET',onlineKey(c)]))).map(parseStoredJson);
 const open=r=>r&&r.visibility==='public'&&r.state==='waiting'&&r.expiresAt>Date.now();
 // Prune closed, started or expired rooms so they stop occupying listing slots.
 const stale=[...codes.filter(c=>!valid(c)),...listed.filter((c,i)=>!open(rooms[i]))];if(stale.length)await redis('ZREM',indexKey(),...stale);
 return rooms.filter(r=>open(r)&&publicNameAllowed(r.host.name)).map(summary);
}
export async function updateOnline(code,id,action,body){
 for(let attempt=0;attempt<5;attempt++){
  if(!valid(code))fail('ONLINE_NOT_FOUND');const raw=await redis('GET',onlineKey(code));const r=parseStoredJson(raw);if(!r)fail('ONLINE_NOT_FOUND');
  const next=transitionOnline(r,id,action,body);const ttl=Math.max(1,Math.ceil((next.expiresAt-Date.now())/1000));
  if(await redis('EVAL',ONLINE_CAS,1,onlineKey(code),raw,JSON.stringify(next),ttl)===1){
   if(r.visibility==='public'&&r.state==='waiting'&&next.state!=='waiting')await redis('ZREM',indexKey(),code);
   return next;
  }
 }fail('ONLINE_STALE');
}
