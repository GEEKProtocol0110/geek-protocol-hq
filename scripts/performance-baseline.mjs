// Local synthetic measurements only. No deployment/database URL is accepted.
import { performance } from 'node:perf_hooks';
import { fork } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyCatalog } from '../server/study-curriculum.js';
import { studyProgress } from '../server/study-progress.js';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { cceReadiness } from '../server/question-bank-readiness.js';

const percentile = (times, p) => times.length ? times.slice().sort((a,b) => a-b)[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)] : null;
const summary = times => ({ samples: times.length, p50Ms: percentile(times,.5), p95Ms: percentile(times,.95), maxMs: times.length ? Math.max(...times) : null });
const measure = (fn, n = 200) => {
  const started = performance.now(); fn(); const coldMs = performance.now() - started, times = [];
  for (let i = 0; i < n; i++) { const t = performance.now(); fn(); times.push(performance.now() - t); }
  return { coldMs, ...summary(times) };
};

const runChild = args => new Promise((resolve, reject) => {
  const child = fork(fileURLToPath(import.meta.url), args, { stdio: ['ignore','ignore','pipe','ipc'] });
  let value, errors = ''; child.on('message', message => { value = message; }); child.stderr.on('data', data => { errors += data; });
  child.on('error', reject); child.on('exit', code => code === 0 && value ? resolve(value) : reject(new Error(errors || `Growth worker failed (${code})`)));
});
if (['--growth-worker', '--growth-reader'].includes(process.argv[2])) {
  const count = Number(process.argv[3]);
  if (![10000,100000].includes(count)) throw new Error('Unsupported synthetic size');
  if (process.argv[2] === '--growth-worker') {
    const seed = loadQuestionBank('kaspa').questions;
    const directory = mkdtempSync(join(tmpdir(), 'geek-growth-'));
    try {
      mkdirSync(join(directory, 'server/questions'), { recursive: true });
      const questions = Array.from({ length: count }, (_, i) => ({ ...seed[i % seed.length], id: `synthetic-${i}`, conceptId: `synthetic-${i}`, prompt: `Synthetic capacity item ${i}`, difficulty: ['easy','medium','hard'][i % 3] }));
      const encoded = JSON.stringify({ questions });
      categoryFiles.kaspa.forEach((file, i) => writeFileSync(join(directory, 'server/questions', file), i ? '{"questions":[]}' : encoded));
      writeFileSync(join(directory, 'server/questions/kaspa-retired.json'), '{"questions":[]}');
      // Measure in another fresh process: fixture construction must not inflate runtime RSS.
      const result = await runChild(['--growth-reader', String(count), directory]);
      process.send({ ...result, bytes: Buffer.byteLength(encoded) });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } else {
    cceReadiness();
    process.chdir(process.argv[4]);
    const fresh = await import(`../server/questions.js?synthetic=${count}`);
    const t = performance.now(); fresh.loadQuestionBank('kaspa'); const loadMs = performance.now() - t, times = [];
    for (let i = 0; i < 20; i++) { const t = performance.now(); const ids = await fresh.selectRoundQuestionIds('kaspa', i % 10 + 1); if (ids.length !== 10 || new Set(ids).size !== 10) throw new Error('Selection failed'); times.push(performance.now() - t); }
    process.send({ questions: count, coldLoadMs: loadMs, selection: summary(times), rssBytes: process.memoryUsage().rss, synthetic: true, excludesFixtureConstruction: true });
  }
} else {
  if (process.argv.slice(2).some(arg => arg !== '--redis')) throw new Error('Only --redis is supported. This command never targets a remote database.');
  const runGrowth = count => runChild(['--growth-worker', String(count)]);
  const result = { schema: 1, checkedAt: new Date().toISOString(), node: process.version, kind: 'local-synthetic', note: 'CPU/loopback Redis measurements; not phone, internet, serverless, production saturation or a capacity guarantee.', study: { catalog: measure(studyCatalog), progressEmpty: measure(() => studyProgress({})) }, rssBytes: process.memoryUsage().rss, growth: [] };
  for (const count of [10000,100000]) result.growth.push(await runGrowth(count));
  if (process.argv.includes('--redis')) {
    const { redisFixture } = await import('../tests/helpers/redis-fixture.js');
    const { default: session } = await import('../api/session.js'), { default: ranked } = await import('../api/ranked.js'), { default: lobbies } = await import('../api/lobbies.js');
    const fixture = await redisFixture(), savedFetch = globalThis.fetch;
    const names = ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','AUDIT_LOG_SECRET'];
    const savedEnv = Object.fromEntries(names.map(name => [name,process.env[name]]));
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.capacity.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic'; process.env.AUDIT_LOG_SECRET = 'synthetic-capacity-audit-key-32-characters';
    let redisCommands = 0; const samples = {}, failures = [];
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith('https://redis.capacity.test')) throw new Error('Remote access is disabled in this benchmark');
      const c = JSON.parse(options.body), multi = String(url).endsWith('/multi-exec'), pipeline = String(url).endsWith('/pipeline');
      redisCommands += multi || pipeline ? c.length : 1;
      return Response.json(multi ? (await fixture.commands([['MULTI'],...c,['EXEC']])).at(-1).map(result => ({result})) : pipeline ? (await fixture.commands(c)).map(result => ({result})) : {result:await fixture.command(...c)});
    };
    const call = async (name, handler, { cookie = '', body = {}, query = {}, method = 'POST', index = 0 } = {}) => {
      const res = { headers:{}, statusCode:0, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;}, end(){} };
      const t = performance.now();
      await handler({ method, body, query, headers:{cookie,host:'www.geekprotocol.xyz',origin:'https://www.geekprotocol.xyz','content-type':'application/json','x-forwarded-for':`192.0.2.${index+1}`,'user-agent':`synthetic-capacity-${index}`} },res);
      (samples[name] ||= []).push(performance.now()-t);
      if (res.statusCode >= 400) { failures.push({ scenario:name,status:res.statusCode,code:res.body?.code || 'unavailable' }); const error = new Error(`Synthetic ${name} failed`); error.recordedFailure = true; throw error; }
      return res;
    };
    try {
      const players = await Promise.all(Array.from({length:24}, async (_,index) => { const r = await call('session',session,{index,body:{displayName:'Capacity fixture'}}); return {index,cookie:r.headers['Set-Cookie'].split(';')[0]}; }));
      const studyOne = async p => {
        const start = (await call('study-start',ranked,{...p,query:{service:'study'},body:{action:'start',topic:'origins',level:'foundations'}})).body;
        await call('study-answer',ranked,{...p,query:{service:'study'},body:{action:'answer',runId:start.run.id,questionToken:start.question.token,selectedIndex:0}});
        await call('study-progress',ranked,{...p,query:{service:'study'},body:{action:'progress'}});
      };
      const dailyOne = async p => {
        let game = (await call('daily-start',ranked,{...p,body:{action:'start',category:'kaspa',mode:'daily'}})).body;
        const runId = game.run.id;
        for (let i=0;i<5;i++) {
          const q = loadQuestionBank('kaspa').questions.find(q=>q.prompt===game.question.prompt);
          await call('daily-answer',ranked,{...p,body:{action:'answer',runId,questionToken:game.question.token,selectedIndex:game.question.options.indexOf(q.options[q.correctIndex])}});
          if(i<4)game=(await call('daily-next',ranked,{...p,body:{action:'next',runId}})).body;
        }
        await call('daily-finish',ranked,{...p,body:{action:'finish',runId}});
      };
      const royaleGroup = async group => {
        const callRoyale=(p,action,fields={})=>call(`royale-${action}`,lobbies,{...p,query:{service:'royale',...(action==='view'?{code:fields.code}:{})},method:action==='view'?'GET':'POST',body:{action,...fields}});
        const r=(await callRoyale(group[0],'create',{category:'kaspa'})).body.royale, fields={code:r.code,eventId:r.id};
        await Promise.all(group.slice(1).map(p=>callRoyale(p,'join',fields)));
        await Promise.all(group.map(p=>callRoyale(p,'ready',{...fields,ready:true})));
        await callRoyale(group[0],'start',fields);
        await Promise.all(group.map(p=>callRoyale(p,'view',fields)));
      };
      const started = performance.now();
      const outcomes = await Promise.allSettled([
        ...players.slice(0,8).map(studyOne), ...players.slice(8,16).map(dailyOne), royaleGroup(players.slice(16,20)), royaleGroup(players.slice(20,24))
      ]);
      for (const outcome of outcomes) if (outcome.status === 'rejected' && !outcome.reason?.recordedFailure) failures.push({scenario:'workload',status:0,code:'unexpected-local-failure'});
      const info = await fixture.command('INFO','memory');
      result.mixed = { players:24, workload:'8 Study practices, 8 completed Daily rounds, 2 four-player Royale lobbies readied/started/viewed concurrently; Royale timed questions not advanced', elapsedMs:performance.now()-started, operations:Object.fromEntries(Object.entries(samples).map(([name,times])=>[name,summary(times)])), requests:Object.values(samples).reduce((n,times)=>n+times.length,0), errors:failures.length, failures, redisCommands, redisUsedBytes:Number(info.match(/\r?\nused_memory:(\d+)/)?.[1]), rssBytes:process.memoryUsage().rss };
      if(failures.length)process.exitCode=1;
    } finally { globalThis.fetch=savedFetch; for(const name of names){if(savedEnv[name]===undefined)delete process.env[name];else process.env[name]=savedEnv[name];} await fixture.close(); }
  }
  console.log(JSON.stringify(result,null,2));
}
