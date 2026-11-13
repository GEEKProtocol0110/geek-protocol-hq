import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('notification retry uses the directly routed canonical URL rather than a redirect',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8')),cron=config.crons.find(c=>c.path.startsWith('/api/game-notifications'));
 assert.ok(cron);assert.equal(cron.schedule,'*/5 * * * *');assert.equal(config.trailingSlash,true);assert.equal(cron.path,'/api/game-notifications/');
 const route=config.rewrites.find(r=>r.source===cron.path);assert.equal(route.destination,'/api/lobbies?service=classic&pushCron=1');
});
