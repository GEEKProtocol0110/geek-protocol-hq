import test from 'node:test';
import assert from 'node:assert/strict';
import { DECIMALS, MAX_RAW, decimalToRaw, formatRaw, rawAmount, splitFee } from '../public/economy/assets/amounts.js';
import { economyPolicy, powerups, treasuryAccounts } from '../public/economy/assets/catalog.js';
import { GEEK_DEPLOYMENT } from '../server/mint.js';
import { appendPlannedTransaction, decodeLedger, emptyLedger, ledgerCasScript, ledgerKey, ledgerView, MAX_RECEIPTS, planTransaction, readLedger, transactionKinds } from '../server/economy-ledger.js';
import sessionHandler from '../api/session.js';
import { economyStatus } from '../server/economy.js';

const playerA='a'.repeat(32), playerB='b'.repeat(32), sessionA='c'.repeat(32), recoveredA='d'.repeat(32), sessionB='e'.repeat(32);
const input=(reference='purchase_00000001', feeRaw='10000000000')=>({reference,kind:'powerup-purchase',grossRaw:'10000000000',feeRaw});
const store=new Map();let forcedConflicts=0, loseCommittedResponse=false;
const savedFetch=globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL='https://economy-redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='economy-test-only';
const execute=command=>{
 const [op,...args]=command;
 if(op==='GET')return store.get(args[0])??null;
 if(op==='INCR'){const next=Number(store.get(args[0])||0)+1;store.set(args[0],String(next));return next;}
 if(op==='EXPIRE')return 1;
 if(op==='EVAL'){
  assert.equal(args[0],ledgerCasScript);assert.equal(args[1],1);
  const [, ,key,expected,next]=args;
  if(forcedConflicts>0){forcedConflicts--;return 0;}
  if((store.get(key)??'')!==expected)return 0;
  store.set(key,next);
  if(loseCommittedResponse){loseCommittedResponse=false;throw Error('Lost committed response');}
  return 1;
 }
 throw Error('Unexpected Redis operation '+op);
};
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).startsWith('https://economy-redis.test'));assert.equal(options.headers.Authorization,'Bearer economy-test-only');
 const commands=JSON.parse(options.body);
 const data=String(url).endsWith('/pipeline')?commands.map(command=>({result:execute(command)})):{result:execute(commands)};
 return {ok:true,json:async()=>data};
};
test.after(()=>{globalThis.fetch=savedFetch;});
const reset=()=>{store.clear();forcedConflicts=0;loseCommittedResponse=false;for(const [id,playerId] of [[sessionA,playerA],[recoveredA,playerA],[sessionB,playerB]])store.set('geek:session:'+id,JSON.stringify({id,playerId,identityVersion:0,name:'Economy tester'}));};
const call=async(method,body,cookie=sessionA)=>{
 const result={statusCode:200,headers:{}};
 const res={setHeader(k,v){result.headers[k]=v;},status(n){result.statusCode=n;return this;},json(data){result.body=data;return this;},end(){return this;}};
 await sessionHandler({method,query:{service:'economy'},headers:cookie?{cookie:'geek_session='+cookie}:{},body},res);return result;
};

test('GEEK accounting uses pinned eight-decimal deployment and exact large integers',()=>{
 assert.equal(DECIMALS,GEEK_DEPLOYMENT.decimals);assert.equal(MAX_RAW.toString(),GEEK_DEPLOYMENT.maxRaw);
 assert.equal(decimalToRaw('144000000000.00000000'),MAX_RAW.toString());assert.equal(formatRaw(MAX_RAW.toString()),'144,000,000,000');
 assert.equal(decimalToRaw('0.00000001'),'1');assert.equal(formatRaw('100000001'),'1.00000001');
 for(const invalid of [1,1n,'01','-1','1e8','NaN','1.0',(MAX_RAW+1n).toString()])assert.throws(()=>rawAmount(invalid));
 for(const invalid of ['1e2','1,000','-1','01','0.000000001','144000000001',' '.repeat(100)])assert.throws(()=>decimalToRaw(invalid));
});
test('70/30 conserves every smallest unit and explicitly splits the platform fee',()=>{
 for(const value of ['0','1','2','9','10','101',MAX_RAW.toString()]){
  const split=splitFee(MAX_RAW.toString(),value);assert.equal(BigInt(split.recyclePendingRaw)+BigInt(split.burnPendingRaw),BigInt(value));assert.equal(BigInt(split.recyclePendingRaw),BigInt(value)*70n/100n);
 }
 assert.deepEqual(splitFee('10000000000','1000000000'),{grossRaw:'10000000000',feeRaw:'1000000000',recyclePendingRaw:'700000000',burnPendingRaw:'300000000'});
 assert.throws(()=>splitFee('0','0'));assert.throws(()=>splitFee('10','11'));
});
test('named items and treasury accounts cannot imply purchases, funded balances or enabled transfers',()=>{
 assert.deepEqual(powerups.map(x=>x.id),['fifty-fifty','ask-fandom','extra-time','skip-question','safety-net','double-geek']);
 assert.equal(treasuryAccounts.length,8);assert.ok(treasuryAccounts.every(x=>x.fundingVerified===false));
 assert.ok(powerups.every(x=>x.priceRaw===null&&!x.purchasesEnabled&&!x.usageEnabled));
 assert.ok(!economyPolicy.transfersEnabled&&!economyPolicy.burnsEnabled);
 const previous=process.env.GEEK_SETTLEMENT_ENABLED;process.env.GEEK_SETTLEMENT_ENABLED='true';
 try{assert.equal(economyStatus().payoutsEnabled,false);assert.equal(economyStatus().reserve.fundingVerified,false);}finally{if(previous===undefined)delete process.env.GEEK_SETTLEMENT_ENABLED;else process.env.GEEK_SETTLEMENT_ENABLED=previous;}
});
test('all supported transaction types get ordered receipts while fee-free payouts allocate no burn',()=>{
 let state=emptyLedger();for(const [i,kind] of transactionKinds.entries())state=planTransaction(state,{...input('reference_'+i.toString().padStart(8,'0')),kind,feeRaw:kind.endsWith('payout')?'0':'10000000000'},1000+i).state;
 const view=ledgerView(state);assert.equal(view.sequence,transactionKinds.length);assert.equal(view.receipts[0].sequence,transactionKinds.length);assert.equal(view.availableRaw,'0');assert.equal(view.burnsConfirmed,false);
 assert.equal(state.totals.feeRaw,'30000000000');assert.equal(state.totals.recyclePendingRaw,'21000000000');assert.equal(state.totals.burnPendingRaw,'9000000000');assert.ok(state.receipts.every(x=>x.state==='PLANNED'));
});
test('receipt references are idempotent and cannot be reused for another amount or kind',()=>{
 const planned=planTransaction(emptyLedger(),input(),1000);const again=planTransaction(planned.state,input(),2000);
 assert.equal(again.duplicate,true);assert.deepEqual(again.receipt,planned.receipt);assert.equal(again.state.sequence,1);
 assert.throws(()=>planTransaction(planned.state,{...input(),feeRaw:'1'}),/REFERENCE_CONFLICT/);
 assert.throws(()=>planTransaction(planned.state,{...input(),kind:'reward-payout'}),/REFERENCE_CONFLICT/);
 assert.throws(()=>planTransaction(planned.state,{...input(),kind:'fund-wallet'}),/TRANSACTION_INVALID/);
});
test('malformed, future, tampered or inconsistent journals fail closed instead of resetting',()=>{
 const state=planTransaction(emptyLedger(),input(),1000).state;
 for(const raw of ['', '{','null',JSON.stringify({...state,version:2}),JSON.stringify({...state,sequence:2}),JSON.stringify({...state,head:'0'.repeat(64)}),JSON.stringify({...state,totals:{...state.totals,burnPendingRaw:'0'}})])assert.throws(()=>decodeLedger(raw),/LEDGER_INVALID/);
 const tampered=structuredClone(state);tampered.receipts[0].feeRaw='1';assert.throws(()=>decodeLedger(JSON.stringify(tampered)),/LEDGER_INVALID/);
 const extra=structuredClone(state);extra.receipts[0].paid=true;assert.throws(()=>decodeLedger(JSON.stringify(extra)),/LEDGER_INVALID/);
});
test('journal capacity retains old idempotency records and requires an explicit archive design',()=>{
 let state=emptyLedger();for(let i=0;i<MAX_RECEIPTS;i++)state=planTransaction(state,input('capacity_'+String(i).padStart(8,'0')),1000+i).state;
 assert.equal(planTransaction(state,input('capacity_00000000')).duplicate,true);assert.throws(()=>planTransaction(state,input('capacity_overflow')),/LEDGER_FULL/);
 assert.equal(state.receipts.length,MAX_RECEIPTS);
});
test('durable concurrent appends conserve totals and commit each reference once',async()=>{
 reset();const results=await Promise.all([appendPlannedTransaction(playerA,input()),appendPlannedTransaction(playerA,input()),...Array.from({length:4},(_,i)=>appendPlannedTransaction(playerA,input('concurrent_'+i.toString().padStart(8,'0'))))]);
 const state=await readLedger(playerA);assert.equal(state.sequence,5);assert.equal(state.totals.feeRaw,'50000000000');assert.equal(results.filter(x=>x.duplicate).length,1);assert.equal(await readLedger(playerB).then(x=>x.sequence),0);
});
test('lost commit responses retry without a second allocation; repeated conflicts never overwrite state',async()=>{
 reset();loseCommittedResponse=true;await assert.rejects(appendPlannedTransaction(playerA,input()),/Lost committed response/);
 const retry=await appendPlannedTransaction(playerA,input());assert.equal(retry.duplicate,true);assert.equal((await readLedger(playerA)).sequence,1);
 const before=store.get(ledgerKey(playerA));forcedConflicts=8;await assert.rejects(appendPlannedTransaction(playerA,input('conflict_00000002')),/LEDGER_BUSY/);assert.equal(store.get(ledgerKey(playerA)),before);
});
test('economy catalog is public; private journal follows resolved player identity and ignores supplied player IDs',async()=>{
 reset();assert.equal((await call('GET',null,null)).statusCode,200);assert.equal((await call('POST',{action:'ledger'},null)).statusCode,401);
 await appendPlannedTransaction(playerA,input());
 assert.equal((await call('POST',{action:'ledger'},recoveredA)).body.ledger.sequence,1);
 assert.equal((await call('POST',{action:'ledger',playerId:playerA},sessionB)).body.ledger.sequence,0);
});
test('HTTP clients cannot record purchases, credits, payouts or burn confirmations',async()=>{
 reset();store.set('geek:profile:'+playerA,JSON.stringify({balance:73,xp:12,payoutAddress:'existing preference'}));const before=store.get('geek:profile:'+playerA);
 for(const action of ['purchase','payout','burn','record','credit','confirm-burn']){
  const result=await call('POST',{action,...input(),balance:999999,confirmed:true});assert.equal(result.statusCode,409);assert.equal(result.body.code,'ECONOMY_TRANSFERS_DISABLED');
 }
 assert.equal(store.has(ledgerKey(playerA)),false);assert.equal(store.get('geek:profile:'+playerA),before);
 assert.equal((await call('DELETE',{})).statusCode,405);assert.equal((await call('OPTIONS',{})).statusCode,204);
});
test('private reads report corruption without deleting the journal or changing profile state',async()=>{
 reset();store.set(ledgerKey(playerA),'bad state');const result=await call('POST',{action:'ledger'});assert.equal(result.statusCode,503);assert.equal(store.get(ledgerKey(playerA)),'bad state');
});
