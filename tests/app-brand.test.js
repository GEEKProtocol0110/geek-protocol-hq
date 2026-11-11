import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('installed app requests a black standalone launch with correctly sized local icons',()=>{
 const m=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));assert.equal(m.display,'standalone');assert.equal(m.start_url,'/');assert.equal(m.background_color,'#000000');assert.equal(m.theme_color,'#000000');assert.equal(m.scope,'/');
 for(const icon of m.icons){const data=readFileSync('public'+icon.src);assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);}
 assert.ok(m.icons.some(i=>i.purpose==='maskable'));const html=readFileSync('public/index.html','utf8');assert.match(html,/rel="manifest" href="\/manifest.webmanifest"/);assert.match(html,/geek-protocol-logo-v2.png/);assert.ok(!html.includes('geek-protocol-logo.png'));assert.deepEqual(readFileSync('public/assets/geek-protocol-logo.png'),readFileSync('public/assets/geek-protocol-logo-v2.png'));
});
