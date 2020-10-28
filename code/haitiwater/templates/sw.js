importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');
workbox.loadModule('workbox-strategies');



/*********************************************************************************
 * Variable globale
 *********************************************************************************/
const cacheVersion = 'static';
const userCache = 'user_1';
const onlinePages = ['/accueil/','/offline/','/reseau/','/reseau/gis','/gestion/','/historique/','/rapport/','/consommateurs/','/finances/','/aide/','/profil/editer/'];
const offlinePages = ['/reseau/offline', 'gestion/offline', '/rapport/offline', '/consommateurs/offline', '/finances/offline']
const staticExt = ['.js','.woff','/static/'];
let needDisconnect = false;
let connected = false;
let offlineMode = false;
let dbVersion = 1;
let db = new Dexie("user_db");



/*********************************************************************************
 * IndexDB
 *********************************************************************************/
db.version(dbVersion).stores({
    zone: 'id,name,cout_fontaine,mois_fontaine,cout_kiosque,mois_kiosque,cout_mensuel',
    consumer: 'id,nom,prenom,genre,adresse,telephone,membres,sortie_eau,argent_du,zone',
    ticket: 'id,urgence,emplacement,type,commentaire,statut,photo',
    water_element: 'id,type,place,users,state,m3,gallons,gestionnaire,zone_up',
    manager:'id,nom,prenom,telephone,mail,role,zone,unknown',
    consumer_details:'consumer_id,amount_due,validity',
    payment:'id,data,value,source,user_id',
});

const consumerHandler = async () => {
    await fetch('http://127.0.0.1:8000/api/get-zone/?name=consumer').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.consumer.add({
                    id:entry[0],
                    nom:entry[1],
                    prenom:entry[2],
                    genre:entry[3],
                    adresse:entry[4],
                    telephone:entry[5],
                    membres:entry[6],
                    sortie_eau:entry[7],
                    argent_du:entry[8],
                    zone:entry[9],
                })
                fetch('http://127.0.0.1:8000/api/details/?table=payment&id='+entry[0]).then(networkResponse => {
                    networkResponse.json().then(infos => {
                        db.consumer_details.add({
                            consumer_id:entry[0],
                            amount_due:infos.amount_due,
                            validity:infos.validity
                        })
                    });
                });
                fetch('http://127.0.0.1:8000/api/get-zone/?name=payment&user='+entry[0]).then(networkResponse => {
                    networkResponse.json().then(infos => {
                        for(let info of infos.data) {
                            db.payment.add({
                                id:info[0],
                                data:info[1],
                                value:info[2],
                                source:info[3],
                                user_id:entry[0],
                            })
                        }
                    })
                })
            }
        })
    })
}

const zoneHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=zone').then(networkResponse => {
        networkResponse.json().then(result => {
            for (let entry of result.data) {
                db.zone.add({
                    id: entry[0],
                    name: entry[1],
                    cout_fontaine: entry[2],
                    mois_fontaine: entry[3],
                    cout_kiosque: entry[4],
                    mois_kiosque: entry[5],
                    cout_mensuel: entry[6],
                })
            }
        })
    })
}

const managerHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=manager').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.manager.add({
                    id:entry[0],
                    nom:entry[1],
                    prenom:entry[2],
                    telephone:entry[3],
                    mail:entry[4],
                    role:entry[5],
                    zone:entry[6],
                    unknown:entry[7],
                })
            }
        })
    })
}

const ticketHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=ticket').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.ticket.add({
                    id:entry[0],
                    urgence:entry[1],
                    emplacement:entry[2],
                    type:entry[3],
                    commentaire:entry[4],
                    statut:entry[5],
                    photo:entry[6],
                })
            }
        })
    })
}

const waterElement_handler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=water_element').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.water_element.add({
                    id:entry[0],
                    type:entry[1],
                    place:entry[2],
                    users:entry[3],
                    state:entry[4],
                    m3:entry[5],
                    gallons:entry[6],
                    gestionnaire:entry[7],
                    zone_up:entry[8],
                })
            }
        })
    })
}

const populateDB = () => {
    consumerHandler();
    zoneHandler();
    managerHandler();
    ticketHandler();
    waterElement_handler();
}

const emptyDB = () => {
    db.zone.clear();
    db.consumer.clear();
    db.ticket.clear();
    db.water_element.clear();
    db.manager.clear();
    db.consumer_details.clear();
    db.payment.clear();
}



/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = (cache, tab) => {
    caches.open(cache).then(cache => {
        cache.addAll(
            tab
        ).catch(error => {
            console.error(error)
        });
    }).catch(function (error) {
        console.error(error)
    })
}

let cacheCleanedPromise = () => {
    caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== cacheVersion) {
                return caches.delete(key);
            }
        });
    });
}



/*********************************************************************************
 * Event listener
 *********************************************************************************/
self.addEventListener('install', async () => {
    // Cache the offline page by default
    await cacheCleanedPromise();
});


self.addEventListener('activate', async () => {
    await addCache(cacheVersion, ['/offline/']);
    await addCache(userCache, onlinePages);
    populateDB();
});


self.addEventListener('fetch', async event => {
    const {request} = event;
    const url = event.request.url;

    if (url.includes('/static/')) {
        event.respondWith(new workbox.strategies.CacheFirst({cacheName:'static'}).handle({event, request}));
    }
    else if (url.includes('/logout/')) {
        await cacheCleanedPromise();
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                emptyDB();
                connected = false;
                return networkResponse;
            }).catch(() => {
                needDisconnect = true;
                emptyDB();
                return caches.match('/offline/');
            })
        );
    }
    else if (needDisconnect) {
        event.respondWith(
            fetch(event.request).then(() => {
                needDisconnect = false;
                return Response.redirect('/logout/');
            }).catch(() => {
                return caches.match('/offline/');
            })
        )
    }
    else {
        if(offlineMode) {
            if(url.includes('/reseau/gis')) {
                event.respondWith(caches.match('/reseau/offline'));
            }
            else if (url.includes('/reseau/')) {
                event.respondWith(caches.match('/reseau/offline'));
            }
            else if(url.includes('/gestion/')) {
                event.respondWith(caches.match('/gestion/offline'));
            }
            else if(url.includes('/rapport/')) {
                event.respondWith(caches.match('/rapport/offline'));
            }
            else if(url.includes('/consommateurs/')) {
                event.respondWith(caches.match('/consommateurs/offline'));
            }
            else if(url.includes('/finances/')) {
                event.respondWith(caches.match('/finances/offline'));
            }
        }
        else {
            if (url.includes('/accueil/')) {
                if (connected === false) {
                    connected = true;
                    populateDB();
                    await addCache(userCache, onlinePages);
                    await addCache(cacheVersion, ['/offline/']);
                }
            }
            event.respondWith(
                new workbox.strategies.StaleWhileRevalidate({cacheName:'user_1'}).handle({event, request})
                    .catch(() => {
                        return caches.match('/offline/');
                    })
            );
        }
    }
});
