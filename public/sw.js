self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={title:'JARVIS',body:'Yeni bildirim'};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'JARVIS',{body:d.body||'',icon:'/jarvis-icon.svg',badge:'/jarvis-icon.svg',data:d.data||{}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow('/')));});
