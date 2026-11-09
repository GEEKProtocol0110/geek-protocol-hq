import { createOnline, listOnline, loadOnline, onlineView, updateOnline } from './classic-online.js';
import { playerIdFor, requireSession } from './session.js';
import { rateLimit } from './redis.js';
import { clientAddressFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
const errors={ONLINE_NOT_FOUND:[404,'This game room expired or could not be found.'],ONLINE_FORBIDDEN:[403,'Only the players in this game can do that.'],ONLINE_TURN:[409,'Wait for your turn.'],ONLINE_ILLEGAL:[400,'That move is not legal.'],ONLINE_STALE:[409,'The board changed. Refresh it before moving again.'],ONLINE_CONFLICT:[409,'The game changed. Refresh to see the latest state.'],ONLINE_FULL:[409,'This lobby has reached its request limit.'],ONLINE_BLOCKED:[403,'The host is not accepting game requests from you in this lobby.'],ONLINE_NAME_NOT_ALLOWED:[400,'Choose a different player name. Links, domains and staff-like names cannot host or request online games.']};
export default async function handler(req,res){
 setApiHeaders(res);if(req.method==='OPTIONS')return res.status(204).end();if(!['GET','POST'].includes(req.method))return methodNotAllowed(res);
 try{
  const session=await requireSession(req),id=playerIdFor(session);await rateLimit('classic-online',id,80,60);
  if(req.method==='GET'){
   if(!req.query?.code)return sendJson(res,200,{ok:true,rooms:await listOnline()});
   return sendJson(res,200,{ok:true,room:onlineView(await loadOnline(String(req.query.code)),id)});
  }
  const b=parseBody(req);if(!b||typeof b!=='object'||Array.isArray(b))throw new Error('INVALID_REQUEST');
  // Network-only keys: rotating the User-Agent must not reset abuse limits.
  const ip=clientAddressFingerprint(req);let room;
  if(b.action==='create'){
   await rateLimit('classic-create',id,8,3600);await rateLimit('classic-create-addr',ip,30,3600);await rateLimit('classic-create-global','all',600,3600);
   room=await createOnline({id,name:session.name},b);
  }else{
   if(b.action==='request'){await rateLimit('classic-request',id,20,3600);await rateLimit(`classic-request-room:${/^PLAY-[A-F0-9]{12}$/.test(String(b.code))?b.code:'invalid'}`,ip,4,3600);}
   room=await updateOnline(String(b.code||''),id,b.action,{...b,name:session.name,ip});
  }
  return sendJson(res,b.action==='create'?201:200,{ok:true,room:onlineView(room,id)});
 }catch(e){const known=errors[e.message];if(known)return sendJson(res,known[0],{ok:false,code:e.message,error:known[1]});return handleApiError(res,e);}
}
