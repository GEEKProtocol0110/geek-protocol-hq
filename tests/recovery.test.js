import test from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import { loadProfile, saveProfile } from '../server/profile.js';
import { recordAuditEvent, verifyAuditRecord } from '../server/audit.js';
import { decodeTotpSecret, hotpCode } from '../server/operations-mfa.js';
import sessionHandler from '../api/session.js';
import { resetRestoredSessions, recoveryTarget } from '../scripts/reset-restored-sessions.mjs';

test('isolated native Redis restore retains durable state and expiry while rotated owner access stays revoked', async () => {
  const source = await redisFixture(), savedFetch = globalThis.fetch; let restored, target = source;
  process.env.UPSTASH_REDIS_REST_URL='https://redis.recovery.test'; process.env.UPSTASH_REDIS_REST_TOKEN='synthetic';
  process.env.OPS_ACCESS_TOKEN='synthetic-recovery-owner-key-with-32-characters';
  process.env.AUDIT_LOG_SECRET='synthetic-recovery-audit-key-with-32-characters';
  process.env.OPS_TOTP_SECRET='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  globalThis.fetch=async(url,options)=>{
    assert.match(String(url),/^https:\/\/redis\.recovery\.test/); const commands=JSON.parse(options.body); let payload;
    if(String(url).endsWith('/pipeline'))payload=(await target.commands(commands)).map(result=>({result}));
    else if(String(url).endsWith('/multi-exec'))payload=(await target.commands([['MULTI'],...commands,['EXEC']])).at(-1).map(result=>({result}));
    else payload={result:await target.command(...commands)};
    return new Response(JSON.stringify(payload));
  };
  const request=async({action='status',method='GET',cookie='',body}={})=>{
    const res={statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(v){this.body=v;return this;}};
    await sessionHandler({method,query:{service:'operations',action},headers:{cookie,origin:'https://www.geekprotocol.xyz','content-type':'application/json','x-forwarded-for':'192.0.2.44'},body},res);return res;
  };
  try {
    const profile=await loadProfile('synthetic-recovery-player'); profile.xp=420; profile.balance=25; profile.totalRuns=3; await saveProfile('synthetic-recovery-player',profile);
    const samples={
      'geek:player-name:synthetic-recovery-player':'Restore Geek',
      'geek:production:identity:wallet:synthetic-wallet':'synthetic-recovery-player',
      'geek:production:appearance:v1':JSON.stringify({version:1,revision:2,mode:'manual',holiday:'christmas',updatedAt:Date.now()}),
      'geek:quest:synthetic-recovery-player':JSON.stringify({completed:true,badge:'synthetic-recovery-badge'}),
      'geek:vault:synthetic-recovery-player':JSON.stringify({seals:['synthetic-seal'],lastClaim:'2026-10-08'}),
      'geek:cce:submission:synthetic-review':JSON.stringify({status:'submitted',prompt:'Synthetic recovery check'})
    };
    for(const [key,value]of Object.entries(samples))await source.command('SET',key,value);
    await source.command('HSET','geek:study-progress:synthetic-recovery-player','synthetic-concept',JSON.stringify({attempts:2,lastCorrect:true}));
    await source.command('ZADD','geek:leaderboard:synthetic-recovery',9,'synthetic-recovery-player');
    await source.command('SET','geek:session:synthetic-expiring','synthetic','EX',60);
    await source.command('SET','geek:session:synthetic-expired','synthetic','PX',1);
    await new Promise(resolve=>setTimeout(resolve,10));
    const event=await recordAuditEvent({type:'recovery.drill.synthetic',actorType:'test',actorId:'synthetic',objectType:'recovery-fixture',objectId:'synthetic',outcome:'success',reason:'isolated-native-snapshot'});
    const [time]=await source.command('TIME'), code=hotpCode(decodeTotpSecret(process.env.OPS_TOTP_SECRET),Math.floor(Number(time)/30));
    const login=await request({action:'login',method:'POST',body:{key:process.env.OPS_ACCESS_TOKEN,code}}); assert.equal(login.statusCode,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    const baselineProfile=await loadProfile('synthetic-recovery-player'), oldTtl=await source.command('PTTL','geek:session:synthetic-expiring');
    const snapshot=await source.snapshot(); restored=await redisFixture({snapshot});
    await source.command('FLUSHDB'); assert.equal(await source.command('DBSIZE'),0); target=restored;
    assert.deepEqual(await loadProfile('synthetic-recovery-player'),baselineProfile);
    for(const [key,value]of Object.entries(samples))assert.equal(await restored.command('GET',key),value);
    assert.deepEqual(await restored.command('HGETALL','geek:study-progress:synthetic-recovery-player'),['synthetic-concept',JSON.stringify({attempts:2,lastCorrect:true})]);
    assert.deepEqual(await restored.command('ZRANGE','geek:leaderboard:synthetic-recovery',0,-1,'WITHSCORES'),['synthetic-recovery-player','9']);
    const restoredEvent=JSON.parse(await restored.command('GET','geek:audit:event:'+event.eventId)); assert.equal(verifyAuditRecord(restoredEvent),true);
    assert.ok((await restored.command('ZRANGE','geek:audit:index',0,-1)).includes(event.eventId));
    const newTtl=await restored.command('PTTL','geek:session:synthetic-expiring'); assert.ok(newTtl>0&&newTtl<=oldTtl); assert.equal(await restored.command('GET','geek:session:synthetic-expired'),null);
    assert.equal((await request({cookie})).statusCode,200);
    // Restoring a database alone does not revoke restored credentials: rotate before recovery cutover.
    process.env.OPS_ACCESS_TOKEN='rotated-synthetic-recovery-owner-key-with-32-characters';
    assert.equal((await request({cookie})).statusCode,401);
    assert.equal((await request({action:'login',method:'POST',body:{key:process.env.OPS_ACCESS_TOKEN,code}})).statusCode,403);
    assert.deepEqual(await loadProfile('synthetic-recovery-player'),baselineProfile);
  } finally {globalThis.fetch=savedFetch; if(restored)await restored.close(); await source.close();}
});

test('restore cleanup defaults read-only, deletes only bearer sessions and one-time proofs, and preserves durable data', async () => {
  const fixture=await redisFixture();
  const ephemeral=['geek:session:old-player','geek:ops:session:old-owner','geek:production:identity:challenge:old-proof','geek:preview:identity:authorization:old-proof'];
  const durable=['geek:profile:player','geek:production:identity:player:player','geek:production:identity:wallet:wallet','geek:player-name:player','geek:ops:totp:replay','geek:study-progress:player'];
  try {
    for(const key of [...ephemeral,...durable])await fixture.command('SET',key,'synthetic');
    assert.deepEqual(await resetRestoredSessions({command:fixture.command}),{mode:'dry-run',matched:4,removed:0});
    for(const key of ephemeral)assert.equal(await fixture.command('GET',key),'synthetic');
    assert.deepEqual(await resetRestoredSessions({command:fixture.command,apply:true}),{mode:'applied',matched:4,removed:4});
    for(const key of durable)assert.equal(await fixture.command('GET',key),'synthetic');
    assert.deepEqual(await resetRestoredSessions({command:fixture.command,apply:true}),{mode:'applied',matched:0,removed:0});
    const env={RECOVERY_REDIS_REST_URL:'https://restore.example',RECOVERY_REDIS_REST_TOKEN:'synthetic'};
    assert.equal(recoveryTarget(env,'restore.example'),'https://restore.example');
    assert.throws(()=>recoveryTarget(env,'wrong.example')); assert.throws(()=>recoveryTarget({...env,UPSTASH_REDIS_REST_URL:'https://restore.example/'},'restore.example'));
    let wrote=false;
    await assert.rejects(resetRestoredSessions({apply:true,command:async name=>{if(name==='DEL')wrote=true;return ['0',['geek:profile:player']];}})); assert.equal(wrote,false);
  } finally {await fixture.close();}
});
