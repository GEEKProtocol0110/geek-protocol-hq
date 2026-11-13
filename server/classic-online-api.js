import {pushSettings,pushOriginAllowed,cronAllowed,savePushSubscription,hasPushSubscription,removePushSubscription,deliverRoomPush,drainTurnPush} from './classic-push.js';
import { createOnline, listMyGames, listOnline, loadOnline, onlineView, updateOnline } from './classic-online.js';
import { playerIdFor, requireSession } from './session.js';
import { rateLimit } from './redis.js';
import { clientAddressFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
const errors={PUSH_INVALID:[400,'This device notification subscription was not accepted.'],PUSH_ORIGIN:[403,'Open Geek on its official website to change notifications.'],PUSH_UNAVAILABLE:[503,'Device notifications are temporarily unavailable. Your turn badges still work.'],PUSH_OWNED:[409,'Turn off this device subscription before switching Geek players.'],PUSH_LIMIT:[409,'Notification device capacity is full. Remove an old device before adding another.'],ONLINE_CAPACITY:[503,'Saved games are temporarily at capacity. Existing games are safe; please try again later.'],ONLINE_LIMIT:[409,'You or your opponent already have 10 active games. Finish or close one first.'],ONLINE_NOT_FOUND:[404,'This game room expired or could not be found.'],ONLINE_FORBIDDEN:[403,'Only the players in this game can do that.'],ONLINE_TURN:[409,'Wait for your turn.'],ONLINE_ILLEGAL:[400,'That move is not legal.'],ONLINE_STALE:[409,'The board changed. Refresh it before moving again.'],ONLINE_CONFLICT:[409,'The game changed. Refresh to see the latest state.'],ONLINE_FULL:[409,'This lobby has reached its request limit.'],ONLINE_BLOCKED:[403,'The host is not accepting game requests from you in this lobby.'],ONLINE_NAME_NOT_ALLOWED:[400,'Choose a different player name. Links, domains and staff-like names cannot host or request online games.']};
export default async function handler(req,res){
 setApiHeaders(res);if(req.method==='OPTIONS')return res.status(204).end();if(!['GET','POST'].includes(req.method))return methodNotAllowed(res);
 try{
  if(req.query?.pushCron==='1'){if(req.method!=='GET'||!cronAllowed(req))return sendJson(res,401,{ok:false,error:'Not authorized.'});return sendJson(res,200,{ok:true,...await drainTurnPush()});}
  const session=await requireSession(req),id=playerIdFor(session);await rateLimit('classic-online',id,80,60);
  if(req.method==='GET'){
   if(req.query?.pushSettings==='1')return sendJson(res,200,{ok:true,...pushSettings()});
   if(!req.query?.code)return sendJson(res,200,{ok:true,rooms:await listOnline(),myGames:await listMyGames(id)});
   return sendJson(res,200,{ok:true,room:onlineView(await loadOnline(String(req.query.code)),id),myGames:await listMyGames(id)});
  }
  const b=parseBody(req);if(!b||typeof b!=='object'||Array.isArray(b))throw new Error('INVALID_REQUEST');
  if(['push-subscribe','push-unsubscribe','push-status'].includes(b.action)){
   if(!pushOriginAllowed(req))throw Error('PUSH_ORIGIN');if(b.action!=='push-status')await rateLimit('classic-push-settings',id,12,3600);
   const data=b.action==='push-subscribe'?await savePushSubscription(id,b.subscription):b.action==='push-unsubscribe'?await removePushSubscription(id,b.subscriptionId):{enabled:await hasPushSubscription(id,b.subscriptionId)};return sendJson(res,200,{ok:true,...data});
  }
  // Network-only keys: rotating the User-Agent must not reset abuse limits.
  const ip=clientAddressFingerprint(req);let room;
  if(b.action==='create'){
   await rateLimit('classic-create',id,8,3600);await rateLimit('classic-create-addr',ip,30,3600);await rateLimit('classic-create-global','all',600,3600);
   room=await createOnline({id,name:session.name},b);
  }else{
   if(b.action==='request'){await rateLimit('classic-request',id,20,3600);await rateLimit(`classic-request-room:${/^PLAY-[A-F0-9]{12}$/.test(String(b.code))?b.code:'invalid'}`,ip,4,3600);}
   room=await updateOnline(String(b.code||''),id,b.action,{...b,name:session.name,ip});
  }
  if(b.action==='move')try{await deliverRoomPush(room.code);}catch{console.error('Geek push delivery unavailable');}
  return sendJson(res,b.action==='create'?201:200,{ok:true,room:onlineView(room,id)});
 }catch(e){const known=errors[e.message];if(known)return sendJson(res,known[0],{ok:false,code:e.message,error:known[1]});return handleApiError(res,e);}
}
