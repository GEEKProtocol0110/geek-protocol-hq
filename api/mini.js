import { setApiHeaders, sendJson, parseBody, clientFingerprint } from '../server/http.js';
import { rateLimit } from '../server/redis.js';
import { listMini, startMini, playMini, forgetMini } from '../server/mini/competition.js';

export default async function handler(req,res){
  setApiHeaders(res,'GET, POST, DELETE, OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST','DELETE'].includes(req.method))return sendJson(res,405,{ok:false,error:'Method not allowed.'});
  try{
    // This endpoint is independent of HQ accounts, wallet authority and ranked rewards.
    await rateLimit('mini-api',clientFingerprint(req),3000,60);
    if(req.method==='GET')return sendJson(res,200,await listMini(req.query?.mode,req.query?.focus));
    const token=String(req.headers?.authorization||'').replace(/^Bearer /,'');
    if(req.method==='DELETE')return sendJson(res,200,await forgetMini(token));
    const body=parseBody(req);
    if(body.action==='start')return sendJson(res,200,{ok:true,...await startMini(token,body.mode,body.focus)});
    return sendJson(res,200,{ok:true,state:await playMini(token,body.id,body.action,body.index,body.choice)});
  }catch(error){
    const code=error?.message||'';
    const known={MINI_ID_REQUIRED:[401,'Your Mini identity is unavailable. Start a new visit.'],MINI_DAILY_USED:[409,'Your public Daily attempt has already been used today. Practice is still free.'],MINI_ROUND_ACTIVE:[409,'Finish your current public round first.'],MINI_COOLDOWN:[409,'Wait 30 seconds before another public round.'],MINI_ROUND_INVALID:[409,'That round is unavailable.'],MINI_BANK_CHANGED:[409,'The question set changed. Start a new round.'],MINI_ANSWER_LOCKED:[409,'That answer is already locked.'],MINI_ANSWER_ORDER:[409,'Refresh the current question before answering.'],MINI_BUSY:[503,'The standings are busy. Try again.'],INVALID_REQUEST:[400,'The request was not valid.'],INVALID_BODY:[400,'The request was not valid.'],RATE_LIMITED:[429,'Please wait a moment before trying again.']};
    const [status,message]=known[code]||[503,'Public Mini standings are temporarily unavailable. Practice remains available.'];
    return sendJson(res,status,{ok:false,error:message});
  }
}
