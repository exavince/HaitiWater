importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');
workbox.loadModule('workbox-strategies');


/*********************************************************************************
 * Variable globale
 *********************************************************************************/
const cacheVersion = 'static';
const userCache = 'user_1';
const onlinePages = ['/accueil/','/offline/','/aide/','/profil/editer'];
const doublePages= ['/reseau/', '/gestion/', '/rapport/', '/consommateurs/', '/finances/', '/historique'];
const offlinePages = ['/reseau/offline', 'gestion/offline', '/rapport/offline', '/consommateurs/offline', '/finances/offline', '/historique/offline']
const staticExt = ['.js','.woff','/static/'];
let offlineMode = false;
let userIDs = [];
let channel = new BroadcastChannel('sw-messages');
let lastPage = null;
let needDisconnect = false;
let connected = false;
let dataLoaded = false;
let lastUpdate = null;
let dbVersion = 1;
let db = new Dexie("user_db");
const staticFiles = [
    '/static/consumerFormHandler.js',
    '/static/consumerTableHandler.js',
    '/static/consumers.js',
    '/static/dashboard.js',
    '/static/vendor/dexie/dexie.js',
    '/static/financial.js',
    '/static/gis.js',
    '/static/gisHelper.js',
    '/static/help.css',
    '/static/help.js',
    '/static/javascripts/tables/genericModalHandler.js',
    '/static/javascripts/tables/genericTableHandler.js',
    '/static/javascripts/ui-elements/graph.js',
    '/static/locale_fr.js',
    '/static/logsHistoryTableGenerator.js',
    '/static/logsTableGenerator.js',
    '/static/managerModalHandler.js',
    '/static/managersTableGenerator.js',
    '/static/manifest.json',
    '/static/monthlyReportEditFormHandler.js',
    '/static/monthlyReportFormHandler.js',
    '/static/offline_consumerTableHandler.js',
    '/static/offline_financial.js',
    '/static/offline_logsTableGenerator.js',
    '/static/offline_logsHistoryTableGenerator.js',
    '/static/offline_managersTableGenerator.js',
    '/static/offline_paymentTableHandler.js',
    '/static/offline_supportTicketTableHandler.js',
    '/static/offline_waterElementTableGenerator.js',
    '/static/offline_zoneTableGenerators.js',
    '/static/paymentModalHandler.js',
    '/static/paymentTableHandler.js',
    '/static/problemReportFormHandler.js',
    '/static/profileHandler.js',
    '/static/report.js',
    '/static/reportTableHandler.js',
    '/static/supportTicketTableHandler.js',
    '/static/vendor/bootstrap-datepicker/css/datepicker.css',
    '/static/vendor/bootstrap-datepicker/js/bootstrap-datepicker.js',
    '/static/vendor/bootstrap-multiselect/bootstrap-multiselect.js',
    '/static/vendor/bootstrap-wizard/jquery.bootstrap.wizard.js',
    '/static/vendor/fontawesome/css/all.min.css',
    '/static/vendor/fontawesome/webfonts/fa-solid-900.woff2',
    '/static/vendor/fonts-google/open-sans.css',
    '/static/vendor/intro/intro.min.css',
    '/static/vendor/intro/intro.min.js',
    '/static/vendor/jquery-datatables-bs3/assets/css/datatables.css',
    '/static/vendor/jquery-datatables-bs3/assets/js/datatables.js',
    '/static/vendor/jquery-datatables/media/js/jquery.dataTables.min.js',
    '/static/vendor/leaflet/leaflet.css',
    '/static/vendor/leaflet/leaflet.draw.css',
    '/static/vendor/leaflet/leaflet.draw.js',
    '/static/vendor/leaflet/leaflet.js',
    '/static/vendor/select2/select2.css',
    '/static/vendor/select2/select2.js',
    '/static/waterElementFormHandler.js',
    '/static/waterElementTableGenerator.js',
    '/static/waterNetwork.js',
    '/static/zoneManagement.js',
    '/static/zoneModalHandler.js',
    '/static/zoneTableGenerator.js',
    '/static/CACHE/css/29de54cb81d2.css',
    '/static/CACHE/js/0a55f327dfed.js',
    '/static/CACHE/js/bf8351900f38.js',
];

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
    logs:'id,time,type,user,summary,details',
    logs_history:'id,time,type,user,summary,details,action',
    update_queue:'++id, url, init, unsync',
});

const logsHandler= fetch('http://127.0.0.1:8000/api/get-zone/?name=logs').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.logs.put({
                id:entry.id,
                time:entry.time,
                type:entry.type,
                user:entry.user,
                summary:entry.summary,
                details:entry.details,
            })
        }
    })
}).catch(err => {
    console.log('[SW_LOGS]', err);
})

const logsHistoryHandler = fetch('http://127.0.0.1:8000/api/get-zone/?name=logs_history').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.logs_history.put({
                id:entry.id,
                time:entry.time,
                type:entry.type,
                user:entry.user,
                summary:entry.summary,
                details:entry.details,
                action:entry.action,
            })
        }
    })
}).catch(err => {
    console.log('[SW_LOGSH]', err);
})

const consumerHandler = fetch('http://127.0.0.1:8000/api/get-consumers').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.consumer.put({
                id:entry.consumer[0],
                nom:entry.consumer[1],
                prenom:entry.consumer[2],
                genre:entry.consumer[3],
                adresse:entry.consumer[4],
                telephone:entry.consumer[5],
                membres:entry.consumer[6],
                sortie_eau:entry.consumer[7],
                argent_du:entry.consumer[8],
                zone:entry.consumer[9],
            })

            db.consumer_details.put({
                consumer_id:entry.consumer[0],
                amount_due:entry.consumer[8],
                validity:entry.validity
            })
        }
    })
}).catch(err => {
    console.log('[SW_CONSUMER]', err);
})

const paymentHandler = fetch('http://127.0.0.1:8000/api/get-payments').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let payment of result.data) {
            db.payment.put({
                id:payment.payments[0],
                data:payment.payments[1],
                value:payment.payments[2],
                source:payment.payments[3],
                user_id:payment.consumer_id,
            })
        }
    })
}).catch(err => {
    console.log('[SW_PAYMENT]', err);
})

const zoneHandler = fetch('http://127.0.0.1:8000/api/get-zone/?name=zone').then(networkResponse => {
    networkResponse.json().then(result => {
        for (let entry of result.data) {
            db.zone.put({
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
}).catch(err => {
    console.log('[SW_ZONE]', err);
})

const managerHandler = fetch('http://127.0.0.1:8000/api/get-zone/?name=manager').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.manager.put({
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
}).catch(err => {
    console.log('[SW_MANAGER]', err);
})

const ticketHandler = fetch('http://127.0.0.1:8000/api/get-zone/?name=ticket').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.ticket.put({
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
}).catch(err => {
    console.log('[SW_TICKET]', err);
})


const waterElement_handler = fetch('http://127.0.0.1:8000/api/get-zone/?name=water_element').then(networkResponse => {
    networkResponse.json().then(result => {
        for(let entry of result.data) {
            db.water_element.put({
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
}).catch(err => {
    console.log('[SW_WATER]', err);
})

const populateDB = Promise.all([
    consumerHandler,
    zoneHandler,
    managerHandler,
    ticketHandler,
    waterElement_handler,
    paymentHandler,
    logsHandler,
    logsHistoryHandler
]).catch(err => {
    console.log('[SW_POPULATEDB]', err);
});

const emptyDB = Promise.all([
    db.zone.clear(),
    db.consumer.clear(),
    db.ticket.clear(),
    db.water_element.clear(),
    db.manager.clear(),
    db.consumer_details.clear(),
    db.payment.clear(),
    db.logs.clear(),
    db.logs_history.clear()
]).catch(err => {
    console.log('[SW_EMPTYDB]', err);
});



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
    }).catch(err => {
        console.error('[SW_CACHEADD]', err);
    });
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

const isDoublePages = (url) => {
    for(const ext of doublePages) {
        if(url.includes(ext)) {
            return true;
        }
    }
    return false;
}

const isOnlinePages = (url) => {
    for(const ext of onlinePages) {
        if(url.includes(ext)) {
            return true;
        }
    }
    return false;
};

const getOfflineData = () => {
    dataLoaded = true;
    Promise.all([
        addCache(cacheVersion, ['/offline/']),
        addCache(userCache, onlinePages),
        addCache(userCache, offlinePages),
        addCache(cacheVersion, staticFiles),
        populateDB,
    ]).then(async () => {
        lastUpdate = {
            year: await new Date().getFullYear(),
            month: await new Date().getMonth()+1,
            day: await new Date().getDate(),
            hours: await new Date().getHours(),
            minutes: await new Date().getMinutes(),
        }
    }).catch(err => {
        dataLoaded = false;
        console.error('[SW_GETDATA]', err);
    });
}


/*********************************************************************************
 * Event listener
 *********************************************************************************/

self.addEventListener('install', event => {
    event.waitUntil(cacheCleanedPromise());
});


self.addEventListener('activate', event => {
    if (!connected) {
        fetch('http://127.0.0.1:8000/api/check-authentication').then(networkResponse => {
            if(networkResponse.status === 200) {
                connected = true;
                if (!dataLoaded) {
                    getOfflineData();
                }
            }
        }).catch(err => {
            console.error('[SW_CONNECTED]',err);
        });
    }
});


self.addEventListener('fetch', async event => {
    const {request} = event;
    const url = event.request.url;

    if (!connected) {
        await fetch('http://127.0.0.1:8000/api/check-authentication').then(async networkResponse => {
            if(networkResponse.status === 200) {
                connected = true;
                if (!dataLoaded) {
                    event.waitUntil(getOfflineData());
                }
            }
        }).catch(err => {
            console.error('[SW_CONNECTED]',err);
        })
    }

    if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(new workbox.strategies.CacheFirst({cacheName:'static'}).handle({event, request}));
    }
    else if (url.includes('/logout')) {
        await Promise.all([
            cacheCleanedPromise(),
            emptyDB,
        ]);
        connected = false;
        dataLoaded = false;
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                offlineMode = false;
                needDisconnect = false;
                return networkResponse;
            }).catch(() => {
                needDisconnect = true;
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
    else if (offlineMode) {
        if(url.includes('/reseau')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/reseau/offline');
                })
            )
        }
        else if (url.includes('/gestion')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/gestion/offline');
                })
            )
        }
        else if (url.includes('/rapport')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/rapport/offline');
                })
            )
        }
        else if (url.includes('/consommateurs')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/consommateurs/offline');
                })
            )
        }
        else if (url.includes('/finances')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/finances/offline');
                })
            )
        }
        else if (url.includes('/historique')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    return await cache.match('/historique/offline');
                })
            )
        }
        else if (url.includes('/login')) {
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/offline/');
                        })
                    })
            );
        }
        else if (url.includes('/api/graph')) {
            event.respondWith(new workbox.strategies.StaleWhileRevalidate({cacheName:'user_1'}).handle({event, request}));
        }
        else {
            event.respondWith(
                new workbox.strategies.StaleWhileRevalidate({cacheName:'user_1'}).handle({event, request})
                    .catch(() => {
                        return caches.match('/offline/');
                    })
            );
        }
    }
    else {
        if(url.includes('/reseau')) {
            lastPage = '/reseau/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/reseau/offline');
                        })
                    })
            );
        }
        else if (url.includes('/gestion')) {
            lastPage = '/gestion/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/gestion/offline');
                        })
                    })
            )
        }
        else if (url.includes('/rapport')) {
            lastPage = '/rapport/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/rapport/offline');
                        })
                    })
            )
        }
        else if (url.includes('/historique')) {
            lastPage = '/historique/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('historique/offline/');
                        });
                    })
            )
        }
        else if (url.includes('/consommateurs')) {
            lastPage = '/consommateurs/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/consommateurs/offline');
                        })
                    })
            )
        }
        else if (url.includes('/finances')) {
            lastPage = '/finances/offline';
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(async () => {
                        return await caches.open('user_1').then(cache => {
                            return cache.match('/finances/offline');
                        })
                    })
            )
        }
        else if (url.includes('/login')) {
            event.respondWith(
              new workbox.strategies.NetworkOnly().handle({event, request})
                  .catch(async () => {
                        return await caches.open(cacheVersion).then(cache => {
                            return cache.match('/offline/');
                        })
                    })
            );
        }
        else if (url.includes('/api/graph')) {
            event.respondWith(new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request}));
        }
        else if (url.includes('/api/table') || url.includes('.png')) {
            event.respondWith(
                new workbox.strategies.NetworkOnly().handle({event, request})
                    .catch(() => {
                        /*caches.open('user_1').then(async cache => {
                            return await cache.match(lastPage);
                        })*/
                        console.error('cannot reach the dataTable online');
                    })
            );
        }
        else {
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(() => {
                        return caches.match('/offline/');
                    })
            );
        }
    }
});

channel.addEventListener('message', event => {
    if (event.data.title === 'navigationMode') {
	    offlineMode = event.data.offlineMode === 'true';
    }
    else if(event.data.title === 'updatedDB') {
        channel.postMessage({
            title: 'updateIndexDB',
            date: lastUpdate
        });
    }
});

self.addEventListener('sync', async event => {
    if (event.tag === 'updateQueue') {
        let tab = await db.update_queue.toArray();

        tab.forEach(element => {
            fetch(element.url, element.init).then(async () => {
                console.log('[SYNC]', tab);
                db.update_queue.delete(element.id);
                channel.postMessage({
                    title:'notification',
                    unsync: await db.update_queue.count()
                });
            }).catch(async () => {
                console.log('[SYNC]','Cannot reach the network, data still need to be pushed');
                channel.postMessage({
                    title:'notification',
                    unsync: await db.update_queue.count()
                });
            })
        });
    }
});