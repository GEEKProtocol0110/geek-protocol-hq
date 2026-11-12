// Notification delivery/clicks only. No fetch interception, caching or app shell.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data;try{data=event.data.json();}catch{return;}const code=data?.code;
  if(!/^PLAY-[A-F0-9]{12}$/.test(code||'')||!Number.isSafeInteger(data.ply)||data.ply<1)return;
  let current=false;
  try{
   const response=await fetch(`/api/lobbies?service=classic&code=${encodeURIComponent(code)}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(6000)});
   if(response.status===401||response.status===403)return;
   if(response.ok){const result=await response.json(),game=result.myGames?.find(g=>g.code===code);if(!game||!game.yourTurn||game.turnToken!==data.ply)return;current=true;}
  }catch{ /* Offline fallback contains no opponent, board or account information. */ }
  await self.registration.showNotification(current?'Geek · Your turn':'Geek · Saved games',{body:current?'A Geek game is waiting for your next move.':'Open Geek to check your saved games.',icon:'/assets/app/geek-logo-192.png',tag:code,renotify:false,data:{code:current?code:null}});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const code=event.notification.data?.code;
 const url=new URL('/games/online/',self.location.origin);if(/^PLAY-[A-F0-9]{12}$/.test(code||''))url.searchParams.set('room',code);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(w=>new URL(w.url).pathname==='/games/online/');if(existing){try{const navigated=await existing.navigate(url.href);if(navigated)return navigated.focus();}catch{}return self.clients.openWindow(url.href);}return self.clients.openWindow(url.href);
 }));
});
