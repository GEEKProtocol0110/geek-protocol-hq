import { createOnline, listMyGames, listOnline, loadOnline, onlineView, updateOnline } from './classic-online.js';
import { playerIdFor, requireSession } from './session.js';
import { rateLimit } from './redis.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
const errors={ONLINE_LIMIT:[409,'You or your opponent already have 10 active games. Finish or close one first.'],ONLINE_NOT_FOUND:[404,'This game room expired or could not be found.'],ONLINE_FORBIDDEN:[403,'Only the players in this game can do that.'],ONLINE_TURN:[409,'Wait for your turn.'],ONLINE_ILLEGAL:[400,'That move is not legal.'],ONLINE_STALE:[409,'The board changed. Refresh it before moving again.'],ONLINE_CONFLICT:[409,'The game changed. Refresh to see the latest state.'],ONLINE_FULL:[409,'This lobby has reached its request limit.']};
export default async function handler(req,res){
 setApiHeaders(res);if(req.method==='OPTIONS')return res.status(204).end();if(!['GET','POST'].includes(req.method))return methodNotAllowed(res);
 try{
  const session=await requireSession(req),id=playerIdFor(session);await rateLimit('classic-online',id,80,60);
  if(req.method==='GET'){
   if(!req.query?.code)return sendJson(res,200,{ok:true,rooms:await listOnline(),myGames:await listMyGames(id)});
   return sendJson(res,200,{ok:true,room:onlineView(await loadOnline(String(req.query.code)),id),myGames:await listMyGames(id)});
  }
  const b=parseBody(req);let room;
  if(b.action==='create'){
   await rateLimit('classic-create',id,12,3600);await rateLimit('classic-create-ip',clientFingerprint(req),30,3600);
   room=await createOnline({id,name:session.name},b);
  }else{
   if(b.action==='request')await rateLimit('classic-request',id,20,3600);
   room=await updateOnline(String(b.code||''),id,b.action,{...b,name:session.name});
  }
  return sendJson(res,b.action==='create'?201:200,{ok:true,room:onlineView(room,id)});
 }catch(e){const known=errors[e.message];if(known)return sendJson(res,known[0],{ok:false,code:e.message,error:known[1]});return handleApiError(res,e);}
}
