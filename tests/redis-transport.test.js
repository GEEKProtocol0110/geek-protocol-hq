import test from 'node:test';
import assert from 'node:assert/strict';
import { redis, pipeline } from '../server/redis.js';
import { handleApiError } from '../server/http.js';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.transport.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-only-token';
const stalled = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Connection lost')), { once: true }));
for (const phase of ['headers', 'body']) test(`database ${phase} stalls stop at the deadline without retrying a possibly saved write`, async t => {
  const logs = []; t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0, signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++; signal = options.signal;
    assert.equal(JSON.parse(options.body)[0], 'SET');
    if (phase === 'headers') return stalled(signal);
    return { ok: true, json: () => stalled(signal) };
  });
  const result = redis('SET', 'synthetic:key', 'value');
  await Promise.resolve(); await Promise.resolve();
  const rejection = assert.rejects(result, /^Error: REDIS_TIMEOUT$/);
  t.mock.timers.tick(7999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await rejection;
  assert.equal(signal.aborted, true); assert.equal(requests, 1);
  assert.equal(logs.length, 1);
  const diagnostic = JSON.parse(logs[0][1]);
  assert.deepEqual(diagnostic, {failure:'timeout',stage:phase,operation:'command',status:null,elapsedMs:diagnostic.elapsedMs});
  assert.ok(Number.isInteger(diagnostic.elapsedMs) && diagnostic.elapsedMs >= 0 && diagnostic.elapsedMs <= 8000);
});

test('completed database requests clear their deadline and unavailable services expose no provider details', async t => {
  const logs = []; t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { signal = options.signal; return new Response('{"result":"OK"}'); });
  assert.equal(await redis('SET', 'synthetic:key', 'value'), 'OK');
  assert.equal(logs.length, 0);
  t.mock.timers.tick(8000); assert.equal(signal.aborted, false);
  globalThis.fetch = async () => new Response('{"error":"private-provider-detail"}', {status:503});
  let failure; try { await redis('GET','synthetic:key'); } catch (error) { failure=error; }
  const res = { status(code) { this.statusCode=code; return this; }, setHeader() {}, json(body) { this.body=body; } };
  handleApiError(res,failure);
  assert.equal(res.statusCode,503); assert.equal(res.body.code,'SERVICE_UNAVAILABLE');
  assert.match(res.body.error,/check your saved state/);
  assert.doesNotMatch(JSON.stringify(res.body),/private-provider-detail|synthetic-only-token/);
});

const privateDetail = 'synthetic-private-player-token-key-https://private.test';
for (const example of [
  {name:'network', fetch:async () => { throw new Error(privateDetail); }, failure:'network',stage:'headers',status:null},
  {name:'body connection loss', fetch:async () => ({ok:true,status:200,json:async () => { throw new TypeError(privateDetail); }}), failure:'network',stage:'body',status:200},
  {name:'HTTP with JSON',body:{error:privateDetail},status:429,failure:'http',stage:'body'},
  {name:'HTTP with non-JSON',raw:privateDetail,status:503,failure:'http',stage:'body'},
  {name:'provider',body:{error:privateDetail},status:200,failure:'provider',stage:'response'},
  {name:'invalid JSON',raw:privateDetail,status:200,failure:'invalid_json',stage:'body'},
  {name:'null envelope',body:null,status:200,failure:'invalid_response',stage:'response'},
  {name:'pipeline error',body:[{error:privateDetail}],status:200,failure:'provider',stage:'response',pipeline:true},
  {name:'pipeline shape',body:[null],status:200,failure:'invalid_response',stage:'response',pipeline:true,code:'REDIS_INVALID_RESPONSE'},
  {name:'pipeline length',body:[],status:200,failure:'invalid_response',stage:'response',pipeline:true,code:'REDIS_INVALID_RESPONSE'},
  {name:'transaction error',body:[{error:privateDetail}],status:200,failure:'provider',stage:'response',pipeline:true,atomic:true}
]) test(`database ${example.name} has a bounded private diagnostic and a generic client failure`, async t => {
  const logs = []; let requests = 0;
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async (...args) => {
    requests++;
    return example.fetch ? example.fetch(...args) : new Response(example.raw ?? JSON.stringify(example.body),{status:example.status});
  });
  let error;
  try {
    if (example.pipeline) await pipeline([['SET',privateDetail,privateDetail]],example.atomic);
    else await redis('SET',privateDetail,privateDetail);
  } catch (caught) { error = caught; }
  assert.equal(error?.message, example.code || 'REDIS_UNAVAILABLE');
  assert.equal(requests,1); assert.equal(logs.length,1);
  assert.equal(logs[0][0],'Geek Redis failure');
  const diagnostic = JSON.parse(logs[0][1]);
  assert.deepEqual(Object.keys(diagnostic).sort(),['elapsedMs','failure','operation','stage','status']);
  assert.equal(diagnostic.failure,example.failure); assert.equal(diagnostic.stage,example.stage);
  assert.equal(diagnostic.status,example.status); assert.equal(diagnostic.operation,example.atomic?'transaction':example.pipeline?'pipeline':'command');
  assert.ok(Number.isInteger(diagnostic.elapsedMs) && diagnostic.elapsedMs >= 0 && diagnostic.elapsedMs <= 8000);
  const res = {status(code){this.statusCode=code;return this;},json(body){this.body=body;}};
  handleApiError(res,error); assert.equal(res.statusCode,503); assert.equal(res.body.code,'SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify({logs,body:res.body}),/synthetic|private\.test|Bearer|SET/);
});

test('missing configuration logs only a fixed classification, and logging failure preserves the error', async t => {
  const previous = [process.env.UPSTASH_REDIS_REST_URL,process.env.KV_REST_API_URL];
  t.after(() => { for (const [index,key] of ['UPSTASH_REDIS_REST_URL','KV_REST_API_URL'].entries()) {
    if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
  } });
  process.env.UPSTASH_REDIS_REST_URL=''; process.env.KV_REST_API_URL='';
  let requests = 0; const logs = [];
  t.mock.method(globalThis,'fetch',async () => {requests++;});
  t.mock.method(console,'error',(...args)=>logs.push(args));
  await assert.rejects(redis('GET',privateDetail),/^Error: REDIS_NOT_CONFIGURED$/);
  assert.equal(requests,0); assert.equal(logs.length,1); assert.equal(JSON.parse(logs[0][1]).failure,'configuration');
  console.error = () => {throw new Error(privateDetail);};
  await assert.rejects(redis('GET',privateDetail),/^Error: REDIS_NOT_CONFIGURED$/);
});

test('valid null, empty and transaction results remain usable without diagnostics', async t => {
  const logs = []; t.mock.method(console,'error',(...args)=>logs.push(args));
  const responses = [{result:null},[],[{result:'OK'}]];
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(responses.shift())));
  assert.equal(await redis('GET','synthetic:key'),null);
  assert.deepEqual(await pipeline([]),[]);
  assert.deepEqual(await pipeline([['SET','synthetic:key','value']],true),['OK']);
  assert.deepEqual(logs,[]);
});

test('missing single result is diagnosed without converting malformed identity state into an absent record', async t => {
  const logs=[]; t.mock.method(console,'error',(...args)=>logs.push(args));
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({privateDetail})));
  assert.equal(await redis('GET',privateDetail),undefined);
  assert.equal(logs.length,1); assert.equal(JSON.parse(logs[0][1]).failure,'invalid_response');
  assert.doesNotMatch(JSON.stringify(logs),/synthetic|private\.test/);
});
