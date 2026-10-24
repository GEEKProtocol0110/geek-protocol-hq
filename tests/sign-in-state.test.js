import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture,json} from './helpers/client-fixture.js';
const scripts=['sign-in.js','passkeys.js'].map(p=>readFileSync(new URL('../public/sign-in/assets/'+p,import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const mount=async (state, next='', userAgent='')=>{
  const calls=[],listeners=new Map(),redirects=[];
  const ui=clientFixture(async(path,options={})=>{calls.push(path);return json(path==='/api/session'?{ok:true}:state);});
  ui.window.isSecureContext=true;ui.window.PublicKeyCredential=undefined;
  ui.context.location.search=next;ui.context.location.assign=path=>redirects.push(path);
  ui.context.navigator.userAgent=userAgent;
  ui.node('[data-wallet-open-app]','a').hidden=true;
  ui.document.addEventListener=(type,fn)=>{const list=listeners.get(type)||[];listeners.set(type,[...list,fn]);};
  ui.document.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event);};
  for(const name of ['address','signature'])ui.node(`[data-${name}-form]`).append(ui.make('button'));
  const panel=ui.node('[data-passkeys]');
  for(const name of ['note','list','label','wallet-help','player','device','device-help','login-area','account','player-row','new-title'])panel.append(ui.node(`[data-passkey-${name}]`));
  for(const name of ['save','login','verify','logout','wallet-authorize'])panel.append(ui.node(`[data-passkey-${name}]`,'button'));
  ui.node('[data-sign-in-hq]').hidden=true;
  for(const script of scripts)ui.run(script);
  await tick();return {...ui,calls,redirects,emit:(type,detail)=>ui.document.dispatchEvent(new CustomEvent(type,{detail}))};
};

test('guest initialization has one account-status source and leaves the guest and returning choices available',async()=>{
  const ui=await mount({playerName:'Guest Geek',signedIn:false,walletLinked:false,credentials:[]});
  assert.deepEqual(ui.calls,['/api/session','/api/passkeys']);
  assert.equal(ui.node('[data-sign-in-status]').textContent,'Not signed in.');
  assert.equal(ui.node('[data-sign-in-hq]').hidden,true);assert.equal(ui.node('[data-sign-in-guest]').hidden,false);
  assert.equal(ui.node('[data-passkey-account]').hidden,true);
});

test('a saved session continues directly to HQ, including a receiving browser without WebAuthn',async()=>{
  const ui=await mount({playerName:'Saved Geek',signedIn:true,walletLinked:false,credentials:[]});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false);assert.equal(ui.node('[data-sign-in-guest]').hidden,true);
  assert.equal(ui.node('[data-sign-in-title]').textContent,'Welcome back.');
  assert.equal(ui.node('[data-passkey-player]').textContent,'Saved Geek');assert.equal(ui.node('[data-passkey-login-area]').hidden,true);
  assert.match(ui.node('[data-passkey-note]').textContent,/You’re signed in/);assert.equal(ui.node('[data-passkey-logout]').disabled,false);
  assert.equal(ui.node('[data-passkey-verify]').disabled,true);
  ui.emit('geek:account-status',{signedIn:false,walletLinked:false});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false,'late guest status cannot replace successful sign-in');
});

test('an existing verified wallet uses the same continuation state without asking for a new passkey',async()=>{
  const ui=await mount({playerName:'Wallet Geek',signedIn:false,walletLinked:true,credentials:[]});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false);assert.equal(ui.node('[data-sign-in-guest]').hidden,true);
  assert.equal(ui.node('[data-passkey-login-area]').hidden,true);assert.equal(ui.node('[data-passkey-account]').hidden,false);
  assert.equal(ui.node('[data-passkey-player]').textContent,'Wallet Geek');assert.equal(ui.calls.length,2);
});

test('only the explicit wallet sign-in action continues automatically to a fixed local destination',async()=>{
  for(const [next,expected] of [['?next=play','/play/#timed-games'],['?next=https://evil.invalid','/profile/']]){
    const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},next);
    ui.emit('geek:account-status',{walletLinked:true});assert.deepEqual(ui.redirects,[]);
    ui.emit('geek:signed-in',{recovered:false,source:'wallet-connect'});assert.deepEqual(ui.redirects,[expected]);
  }
});

test('completed account sign-in continues to receiving settings while management reauthentication stays on the page',async()=>{
  const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},'?next=rewards');
  ui.emit('geek:passkey-signed-in',{continue:false});assert.deepEqual(ui.redirects,[]);
  ui.emit('geek:passkey-signed-in',{continue:true});assert.deepEqual(ui.redirects,['/profile/#reward-address']);
  const other=await mount({signedIn:false,walletLinked:false,credentials:[]},'?next=https://evil.invalid');
  other.emit('geek:passkey-signed-in',{continue:true});assert.deepEqual(other.redirects,['/profile/']);
});

test('returning after logout confirms the signed-out state without overriding a valid session',async()=>{
  const guest=await mount({signedIn:false,walletLinked:false,credentials:[]},'?signedOut=1');
  assert.match(guest.node('[data-sign-in-status]').textContent,/You’re signed out.*saved progress/);
  const active=await mount({signedIn:true,walletLinked:false,credentials:[]},'?signedOut=1');
  assert.match(active.node('[data-sign-in-status]').textContent,/Signed in|You’re signed in/);
  assert.doesNotMatch(active.node('[data-sign-in-status]').textContent,/signed out/);
});

test('the mobile handoff copies only the canonical HQ link and an allowed continuation',async()=>{
  for(const [next,expected] of [['?next=play','https://www.geekprotocol.xyz/sign-in/?next=play'],['?next=https://evil.invalid&token=private','https://www.geekprotocol.xyz/sign-in/']]){
    const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},next);
    const link=ui.node('[data-wallet-hq-link]');let selected=false,copied;
    link.select=()=>{selected=true;};ui.document.execCommand=command=>{assert.equal(command,'copy');copied=link.value;return true;};
    await ui.node('[data-wallet-copy-link]').emit('click');
    assert.equal(selected,true);assert.equal(copied,expected);
    assert.match(ui.node('[data-wallet-copy-status]').textContent,/HQ link copied/);
    assert.deepEqual(ui.redirects,[]);assert.deepEqual(ui.calls,['/api/session','/api/passkeys']);
  }
});

test('denied mobile-link clipboard access leaves a complete manual selection',async()=>{
  const ui=await mount({signedIn:false,walletLinked:false,credentials:[]});let selection;
  ui.node('[data-wallet-hq-link]').setSelectionRange=(start,end)=>{selection=[start,end];};
  ui.context.navigator.clipboard={writeText:async()=>{throw Error('denied');}};
  await ui.node('[data-wallet-copy-link]').emit('click');
  assert.deepEqual(selection,[0,'https://www.geekprotocol.xyz/sign-in/'.length]);
  assert.match(ui.node('[data-wallet-copy-status]').textContent,/Link selected.*KasWare/);
  assert.deepEqual(ui.redirects,[]);
});

test('Android offers a package-pinned KasWare launch with a safe canonical fallback and no authentication claim',async()=>{
  const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},'?next=play&token=private','Mozilla/5.0 (Linux; Android 16) Chrome/140');
  const link=ui.node('[data-wallet-open-app]');
  assert.equal(link.hidden,false);
  assert.match(link.href,/^intent:\/\/#Intent;scheme=com\.kasware\.app;package=com\.kasware\.app;/);
  const fallback=decodeURIComponent(link.href.match(/S.browser_fallback_url=([^;]+);end$/)[1]);
  assert.equal(fallback,'https://www.geekprotocol.xyz/sign-in/?next=play&walletLaunch=unavailable');
  assert.doesNotMatch(link.href,/token|private/);
  await link.emit('click');
  assert.match(ui.node('[data-wallet-launch-status]').textContent,/Opening KasWare.*paste the copied HQ link/);
  assert.deepEqual(ui.redirects,[]);assert.deepEqual(ui.calls,['/api/session','/api/passkeys']);
  assert.equal(ui.node('[data-sign-in-hq]').hidden,true);
});

test('unsupported platforms hide the Android launcher and a failed launch retains honest recovery guidance',async()=>{
  for(const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)','Mozilla/5.0 (Windows NT 10.0)']){
    const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},'',ua);
    assert.equal(ui.node('[data-wallet-open-app]').hidden,true);
  }
  const ui=await mount({signedIn:false,walletLinked:false,credentials:[]},'?next=https://evil.invalid&walletLaunch=unavailable','Android');
  assert.match(ui.node('[data-wallet-launch-status]').textContent,/could not be opened/);
  assert.equal(ui.node('[data-wallet-hq-link]').value,'https://www.geekprotocol.xyz/sign-in/');
  assert.equal(ui.node('[data-sign-in-hq]').hidden,true);
});
