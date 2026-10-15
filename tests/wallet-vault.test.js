import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import kaspa from '@dfns/kaspa-wasm';
import { runInNewContext } from 'node:vm';
import { initialize } from '../public/wallet-lab/assets/kaspa-sdk.js';
import { derive, seal, open, NETWORK } from '../public/wallet-lab/assets/vault.js';
const sdk = await initialize(readFileSync(new URL('../public/wallet-lab/assets/kaspa_bg.wasm',import.meta.url)));
const mnemonic = new kaspa.Mnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const phrase = mnemonic.phrase;
test('wallet SDK generation works with browser globals and no Node require, process or filesystem', async () => {
  const context = { crypto:globalThis.crypto, TextEncoder, TextDecoder, WebAssembly, console, Uint8Array, ArrayBuffer, DataView, FinalizationRegistry, setTimeout, clearTimeout };
  context.window = context; context.self = context;
  const source = readFileSync(new URL('../public/wallet-lab/assets/kaspa-sdk.js',import.meta.url),'utf8').replace('export async function initialize','async function initialize').replace("new URL('./kaspa_bg.wasm', import.meta.url)", "'/unused-test-fetch'");
  runInNewContext(source+'\nglobalThis.boot = initialize;',context);
  const browser = await context.boot(readFileSync(new URL('../public/wallet-lab/assets/kaspa_bg.wasm',import.meta.url)));
  const generated = browser.Mnemonic.random(24);
  try { assert.equal(generated.phrase.split(' ').length,24); assert.equal(browser.Mnemonic.validate(generated.phrase),true); assert.match(derive(browser,generated.phrase),/^kaspatest:/); }
  finally { generated.free(); }
});
test('browser-adapted SDK derives the same testnet receive address as the unmodified pinned SDK', () => {
  const root = new kaspa.XPrv(mnemonic.toSeed()), gen = new kaspa.PrivateKeyGenerator(root,false,0n), key = gen.receiveKey(0), address = key.toAddress(NETWORK);
  try { assert.equal(derive(sdk,phrase),address.toString()); assert.match(address.toString(),/^kaspatest:/); }
  finally { address.free(); key.free(); gen.free(); root.free(); }
});
test('encrypted backup restores exactly and rejects wrong passwords, header changes and modified ciphertext', async () => {
  const password = 'synthetic-backup-password', vault = await seal(sdk,phrase,password);
  assert.equal(JSON.stringify(vault).includes(phrase),false);
  assert.equal((await open(sdk,JSON.parse(JSON.stringify(vault)),password)).address,derive(sdk,phrase));
  await assert.rejects(open(sdk,vault,'incorrect-password'));
  for (const patch of [{ phrase },{ network:'mainnet' },{ address:vault.address.slice(0,-1)+'x' },{ iterations:1 },{ ciphertext:Buffer.alloc(128).toString('base64') }]) await assert.rejects(open(sdk,{...vault,...patch},password));
  const second = await seal(sdk,phrase,password); assert.notEqual(vault.salt,second.salt);assert.notEqual(vault.iv,second.iv);assert.notEqual(vault.ciphertext,second.ciphertext);
});
