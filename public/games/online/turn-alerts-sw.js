// Notification display/click only. No fetch interception, caching or push subscription.
self.addEventListener('notificationclick',event=>{
 event.notification.close();const code=event.notification.data?.code;if(!/^PLAY-[A-F0-9]{12}$/.test(code||''))return;
 const url=new URL('/games/online/',self.location.origin);url.searchParams.set('room',code);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(w=>new URL(w.url).pathname==='/games/online/');if(existing){await existing.navigate(url.href);return existing.focus();}return self.clients.openWindow(url.href);
 }));
});
