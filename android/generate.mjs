import {TwaManifest,TwaGenerator} from '@bubblewrap/core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=fileURLToPath(new URL('./generated/',import.meta.url));
const web=JSON.parse(await readFile(new URL('public/manifest.webmanifest',root),'utf8'));
const manifest=TwaManifest.fromWebManifestJson(new URL('https://www.geekprotocol.xyz/manifest.webmanifest'),web);
manifest.packageId='xyz.geekprotocol.app.test';manifest.name='Geek Protocol Test';manifest.launcherName='GEEK Test';manifest.appVersionCode=1;manifest.appVersionName='0.1.0-test';manifest.minSdkVersion=24;manifest.enableNotifications=false;manifest.signingKey={path:'test-only.keystore',alias:'test-only'};manifest.fingerprints=[];
// A local asset server gives the generator the exact reviewed site icon, not a remote snapshot.
const icon=await readFile(new URL('public/assets/app/geek-logo-512.png',root));
const server=createServer((req,res)=>{if(req.url==='/manifest.webmanifest'){res.writeHead(200,{'Content-Type':'application/manifest+json'});res.end(JSON.stringify(web));return;}if(req.url!=='/icon.png'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'image/png'});res.end(icon);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 manifest.webManifestUrl=new URL(`http://127.0.0.1:${server.address().port}/manifest.webmanifest`);manifest.iconUrl=`http://127.0.0.1:${server.address().port}/icon.png`;manifest.maskableIconUrl=manifest.iconUrl;
 await mkdir(out,{recursive:true});await new TwaGenerator().createTwaProject(out,manifest,{debug(){},info(){},warn:console.warn,error:console.error});
 manifest.webManifestUrl=new URL('https://www.geekprotocol.xyz/manifest.webmanifest');manifest.iconUrl='https://www.geekprotocol.xyz/assets/app/geek-logo-512.png';manifest.maskableIconUrl=manifest.iconUrl;await manifest.saveToFile(out+'/twa-manifest.json');
 // Reject production signing: this candidate produces a separately identified debug test app only.
 const build=await readFile(out+'/app/build.gradle','utf8');await writeFile(out+'/app/build.gradle',build.replace(/jcenter\(\)/g,'mavenCentral()').replace(/androidbrowserhelper:[^']+/g,'androidbrowserhelper:2.7.4'));
 console.log('Generated Android test project:',out);
}finally{server.closeAllConnections();server.close();}
