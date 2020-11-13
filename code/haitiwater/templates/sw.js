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
const channel = new BroadcastChannel('sw-messages');
const dbVersion = 1;
const db = new Dexie("user_db");

let synced = false;
let username = null;
let offlineMode = false;
let needDisconnect = false;
let connected = false;
let dataLoaded = false;
let lastUpdate = false;
let isLoading = false;



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
    sessions:'id,username,connected,needDisconnect,offlineMode,lastUpdate,dataLoaded'
});

const logsHandler= () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=logs').then(networkResponse => {
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
    });
}

const logsHistoryHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=logs_history').then(networkResponse => {
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
    });
}

const consumerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-consumers').then(networkResponse => {
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
    });
}

const paymentHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-payments').then(networkResponse => {
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
    });
}

const zoneHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=zone').then(networkResponse => {
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
    });
}

const managerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=manager').then(networkResponse => {
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
    });
}

const ticketHandler = () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=ticket').then(networkResponse => {
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
    });
}

const waterElement_handler = () => {
    return fetch('http://127.0.0.1:8000/api/get-zone/?name=water_element').then(networkResponse => {
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
    });
}

const populateDB = () => {
    isLoading = true;
    Promise.all([
        consumerHandler(),
        zoneHandler(),
        managerHandler(),
        ticketHandler(),
        waterElement_handler(),
        paymentHandler(),
        logsHandler(),
        logsHistoryHandler()
    ]).then(() => {
        isLoading = false;
        setInfos( 'lastUpdate', {
            year: new Date().getFullYear(),
            month: new Date().getMonth()+1,
            day: new Date().getDate(),
            hours: new Date().getHours(),
            minutes: new Date().getMinutes(),
        });
        channel.postMessage({
            title:'newDate',
            date:lastUpdate
        });
    }).catch(err => {
        isLoading = false;
        console.log('[SW_POPULATEDB]', err);
    });
}

const emptyDB = () => {
    return Promise.all([
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
}



/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = (cache, tab) => {
    return caches.open(cache).then(cache => {
        cache.addAll(
            tab
        );
    }).catch(err => {
        console.error('[SW_CACHEADD]', err);
    });
}

const cacheCleanedPromise = () => {
    return caches.keys().then(keys => {
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
    setInfos('dataLoaded', true);
    return Promise.all([
        addCache(cacheVersion, ['/offline/']),
        addCache(userCache, onlinePages),
        addCache(userCache, offlinePages),
        addCache(cacheVersion, staticFiles),
        populateDB(),
    ]).catch(err => {
        setInfos('dataLoaded', false);
        console.error('[SW_GETDATA]', err);
    });
}

const getInfos = () => {
    return db.sessions.where('id').equals(1).first(data => {
        username = data.username;
        connected = data.connected;
        needDisconnect = data.needDisconnect;
        offlineMode = data.offlineMode;
        lastUpdate = data.lastUpdate;
        dataLoaded = data.dataLoaded;
        synced = true;
        console.log('[TEST]', lastUpdate);
        channel.postMessage({
            title:'newDate',
            data:lastUpdate
        });
        return data;
    });
}

const setInfos = (info, value) => {
    switch (info){
        case 'username':
            username = value;
            break
        case 'connected':
            connected = value;
            break
        case 'needDisconnect':
            needDisconnect = value;
            break
        case 'offlineMode':
            offlineMode = value;
            break
        case 'lastUpdate':
            lastUpdate = value;
            break
        case 'dataLoaded':
            dataLoaded = value;
            break
    }
    db.sessions.put({
        id:1,
        username:username,
        connected:connected,
        needDisconnect:needDisconnect,
        offlineMode:offlineMode,
        lastUpdate:lastUpdate,
        dataLoaded:dataLoaded
    });
}

const isConnected = () => {
    return fetch('http://127.0.0.1:8000/api/check-authentication').then(async networkResponse => {
        if(networkResponse.status === 200) {
            setInfos('connected' ,true);
            if (!dataLoaded) {
                getOfflineData();
            }
        }
    }).catch(err => {
        console.error('[SW_CONNECTED]',err);
    })
}

const pushData = async () => {
    let tab = await db.update_queue.toArray();
    tab.forEach(element => {
        fetch(element.url, element.init).then(async () => {
            console.log('[SW_SYNC]', 'The ' + element + ' is synced');
            db.update_queue.delete(element.id);
            channel.postMessage({
                title:'notification',
                unsync: await db.update_queue.count()
            });
        }).catch(async () => {
            console.log('[SW_SYNC]','Cannot reach the network, data still need to be pushed');
            channel.postMessage({
                title:'notification',
                unsync: await db.update_queue.count()
            });
        })
    });
}

const cleanSession = () => {
    return db.sessions.put({
        id:1,
        username:null,
        connected:false,
        needDisconnect:false,
        offlineMode:false,
        lastUpdate:false,
        dataLoaded:false
    });
}



/*********************************************************************************
 * Event listener
 *********************************************************************************/
self.addEventListener('install', event => {
    event.waitUntil(cacheCleanedPromise());
});


self.addEventListener('activate', async () => {
    await db.sessions.add({
        id:1,
        username:null,
        connected:false,
        needDisconnect:false,
        offlineMode:false,
        lastUpdate:false,
        dataLoaded:false
    }).then(() => {
        console.log('[ACTIVATE]', lastUpdate);
        channel.postMessage({
            title:'newDate',
            data:lastUpdate
        });
    }).catch(err => {
        getInfos();
        console.error('[SW_SESSIONS]', err);
    });
    if (!connected) isConnected();
});


self.addEventListener('fetch', async event => {
    const {request} = event;
    const url = event.request.url;

    if(!synced) await getInfos();
    if (!connected) event.waitUntil(isConnected());

    if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(new workbox.strategies.CacheFirst({cacheName:'static'}).handle({event, request}));
    }
    else if (url.includes('/logout')) {
        await Promise.all([
            cacheCleanedPromise(),
            emptyDB(),
        ]);
        setInfos('connected', false);
        setInfos('dataLoaded', false);
        event.respondWith(
            fetch(event.request).then(async networkResponse => {
                setInfos('offlineMode', false);
                setInfos('needDisconnect', false);
                await cleanSession();
                return networkResponse;
            }).catch(() => {
                setInfos('needDisconnect', true);
                return caches.match('/offline/');
            })
        );
    }
    else if (needDisconnect) {
        event.respondWith(
            fetch(event.request).then(() => {
                setInfos('needDisconnect', false);
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


channel.addEventListener('message', async event => {
    if (event.data.title === 'navigationMode') {
        setInfos('offlineMode', event.data.offlineMode)
    }
    else if(event.data.title === 'lastUpdate') {
        if (username !== null && username !== event.data.username) {
            Promise.all([cleanSession(), emptyDB(), cacheCleanedPromise()]).then(() => {
                setInfos('needDisconnect', true);
            });
        }
        channel.postMessage({
            title: 'newDate',
            date: lastUpdate
        });
        setInfos('username', event.data.username);
    }
    else if(event.data.title === 'updateIndexDB'){
        pushData().then(() => {
            if(!isLoading) {
                console.log('[SW_UPDATE]', 'DB is loading');
                populateDB();
            }
            else {
                console.log('[SW_UPDATE]', 'DB is already loading');
            }
        });
    }
});


self.addEventListener('sync', async event => {
    if (event.tag === 'updateQueue') {
        await pushData();
    }
});