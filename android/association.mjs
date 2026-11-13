// Public certificate fingerprints only; never keystores or private key material.
import {writeFile,mkdir} from 'node:fs/promises';
const fingerprint=process.argv[2]?.toUpperCase();
if(!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint||''))throw Error('Supply the signed APK certificate SHA-256 fingerprint');
const statement=[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'xyz.geekprotocol.app.test',sha256_cert_fingerprints:[fingerprint]}}];
await mkdir('public-association',{recursive:true});await writeFile('public-association/assetlinks.json',JSON.stringify(statement,null,2)+'\n');
console.log('Public statement written; review and deploy at https://www.geekprotocol.xyz/.well-known/assetlinks.json');
