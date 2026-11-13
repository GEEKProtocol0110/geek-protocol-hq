// Device opt-in only. No permission prompt or subscription is created on page load.
const button=document.getElementById('push-alerts'),note=document.getElementById('push-alert-note');
const endpoint='/api/lobbies?service=classic';let config=null,busy=false,registered=null,current=null;
const supported=()=>window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
async function request(body){const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Notification settings could not be saved.');return data;}
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const publicBytes=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
function render(){button.disabled=busy||!config?.enabled;button.textContent=current?'Turn alerts off on this device':'Enable turn alerts on this device';}
async function initialize(){
 if(!supported()){button.disabled=true;note.textContent='Device push is unavailable in this browser. Your turn badges still work; on iPhone use an installed home-screen app.';return;}
 try{const response=await fetch(endpoint+'&pushSettings=1',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});config=await response.json();if(!response.ok||!config.ok)throw Error();
  registered=await navigator.serviceWorker.getRegistration('/games/online/');current=await registered?.pushManager.getSubscription();
  if(current){const owned=await request({action:'push-status',subscriptionId:await hash(current.endpoint)});if(!owned.enabled){await current.unsubscribe();current=null;}}
  note.textContent=current?'Turn alerts are enabled on this device, including when the lounge is closed. Browser and phone settings control delivery.':config.enabled?'Opt in for your-turn notifications, even with the lounge closed. You can turn them off here.':'Device notifications are temporarily unavailable. Your turn badges still work.';
 }catch{config=null;note.textContent='Notification settings are unavailable. Your games and turn badges still work.';}finally{render();}
}
button.addEventListener('click',async()=>{
 if(busy||!config?.enabled)return;busy=true;render();
 try{
  if(current){const sub=current;try{await request({action:'push-unsubscribe',subscriptionId:await hash(sub.endpoint)});}finally{await sub.unsubscribe();current=null;}note.textContent='Turn alerts are off on this device. Your turn badges still work.';}
  else{
   // Request permission directly from this click before asynchronous setup.
   const permission=await Notification.requestPermission();if(permission!=='granted'){note.textContent='Notification permission was not granted. Your turn badges still work.';return;}
   registered=await navigator.serviceWorker.register('/games/online/turn-alerts-sw.js',{scope:'/games/online/'});await navigator.serviceWorker.ready;
   current=await registered.pushManager.getSubscription()||await registered.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicBytes(config.publicKey)});
   try{await request({action:'push-subscribe',subscription:current.toJSON()});}catch(error){await current.unsubscribe();current=null;throw error;}
   note.textContent='Turn alerts are enabled on this device, including when the lounge is closed. Browser and phone settings control delivery.';
  }
 }catch(error){note.textContent=error.message||'Notifications are unavailable. Your turn badges still work.';}finally{busy=false;render();}
});
document.addEventListener('geek:lounge-connected',initialize);
document.addEventListener('geek:signed-out',async()=>{config=null;button.disabled=true;try{const reg=await navigator.serviceWorker?.getRegistration('/games/online/'),sub=await reg?.pushManager.getSubscription();await sub?.unsubscribe();}catch{}current=null;note.textContent='Signed out. This device must opt in again for its next Geek player.';});
