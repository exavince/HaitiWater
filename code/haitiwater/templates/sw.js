importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');
workbox.loadModule('workbox-strategies');


/*********************************************************************************
 * Variable globale
 *********************************************************************************/
const cacheVersion = 'static';
const userCache = 'user_1';
const onlinePages = ['/accueil/','/offline/','/aide/','/profil/editer'];
const doublePages= ['/reseau/', '/gestion/', '/rapport/', '/consommateurs/', '/finances/'];
const offlinePages = ['/reseau/offline', 'gestion/offline', '/rapport/offline', '/consommateurs/offline', '/finances/offline']
const staticExt = ['.js','.woff','/static/'];
const channel = new BroadcastChannel('sw-messages');
let needDisconnect = false;
let connected = false;
let dataLoaded = false;
let offlineMode = false;
let dbVersion = 1;
let db = new Dexie("user_db");
const staticFiles = [
  '/static/consumerFormHandler.js',
  '/static/consumerTableHandler.js',
  '/static/consumers.js',
  '/static/dashboard.js',
  '/static/dexie.js',
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
];

/*********************************************************************************
 * IndexDB
 *********************************************************************************/
db.version(dbVersion).stores({
    connectionInfos: 'offlineMode',
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

const emptyDB = async () => {
    await db.zone.clear();
    await db.consumer.clear();
    await db.ticket.clear();
    await db.water_element.clear();
    await db.manager.clear();
    await db.consumer_details.clear();
    await db.payment.clear();
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


/*********************************************************************************
 * Event listener
 *********************************************************************************/


self.addEventListener('install', async () => {
    // Cache the offline page by default
    await cacheCleanedPromise();
});


self.addEventListener('activate', async () => {
    await Promise.all([
        addCache(cacheVersion, ['/offline/']),
        addCache(userCache, onlinePages),
        addCache(userCache, offlinePages),
        addCache(cacheVersion, staticFiles),
        populateDB(),
    ]).then(() => {
        dataLoaded = true;
    });

    if (!connected) {
        fetch('http://127.0.0.1:8000/api/check-authentication')
            .then(async networkResponse => {
                if(networkResponse.status == 200) {
                    connected = true;
                    if (dataLoaded = false) {
                        Promise.all([
                            addCache(cacheVersion, ['/offline/']),
                            addCache(userCache, onlinePages),
                            addCache(userCache, offlinePages),
                            populateDB()
                        ]).then(() => {
                            dataLoaded = true;
                        });
                    }
                }
            })
            .catch(error => {
                console.error(error);
            })
    }
});


self.addEventListener('fetch', async event => {
    const {request} = event;
    const url = event.request.url;

    if (!connected) {
        fetch('http://127.0.0.1:8000/api/check-authentication')
            .then(async networkResponse => {
                if(networkResponse.status == 200) {
                    connected = true;
                    if (dataLoaded = false) {
                        Promise.all([
                            addCache(cacheVersion, ['/offline/']),
                            addCache(userCache, onlinePages),
                            addCache(userCache, offlinePages),
                            populateDB()
                        ]).then(() => {
                            dataLoaded = true;
                        })
                    }
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(new workbox.strategies.CacheFirst({cacheName:'static'}).handle({event, request}));
    }
    else if (url.includes('/logout')) {
        await Promise.all([
            cacheCleanedPromise(),
            emptyDB(),
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
    else if (url.includes('/api/table') || url.includes('.png')) {
        event.respondWith(new workbox.strategies.NetworkOnly().handle({event, request}));
    }
    else if (offlineMode) {
        if(url.includes('/reseau')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    let response = await cache.match('/reseau/offline') || caches.match('/offline/');
                    return new Response(response.body);
                })
            )
        }
        else if (url.includes('/gestion')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    let response = await cache.match('/gestion/offline') || caches.match('/offline/');
                    return new Response(response.body);
                })
            )
        }
        else if (url.includes('/rapport')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    let response = await cache.match('/rapport/offline') || caches.match('/offline/');
                    return new Response(response.body);
                })
            )
        }
        else if (url.includes('/consommateurs')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    let response = await cache.match('/consommateurs/offline') || caches.match('/offline/');
                    return new Response(response.body);
                })
            )
        }
        else if (url.includes('/finances')) {
            event.respondWith(
                caches.open('user_1').then(async cache => {
                    let response = await cache.match('/finances/offline') || caches.match('/offline/');
                    return new Response(response.body);;
                })
            )
        }
        else if (url.includes('/login')) {
            event.respondWith(
              new workbox.strategies.NetworkOnly().handle({event, request})
                  .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/offline/');
                        })
                        return new Response(response.body)
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
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/reseau/offline') || caches.match('/offline/');
                        })
                        return new Response(response.body)
                    })
            );
        }
        else if (url.includes('/gestion')) {
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/gestion/offline') || caches.match('/offline/');
                        })
                        return new Response(response.body)
                    })
            )
        }
        else if (url.includes('/rapport')) {
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/rapport/offline') || caches.match('/offline/');
                        })
                        return new Response(response.body)
                    })
            )
        }
        else if (url.includes('/consommateurs')) {
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/consommateurs/offline') || caches.match('/offline/');
                        })
                        return new Response(response.body)
                    })
            )
        }
        else if (url.includes('/finances')) {
            event.respondWith(
                new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request})
                    .catch(async () => {
                        response = await caches.open('user_1').then(cache => {
                            return cache.match('/finances/offline') || caches.match('/offline/');
                        })
                        return new Response(response.body)
                    })
            )
        }
        else if (url.includes('/api/graph')) {
            event.respondWith(new workbox.strategies.NetworkFirst({cacheName:'user_1'}).handle({event, request}));
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
});

channel.addEventListener('message', event => {
  if (event.data.title === 'navigationMode') {
	    if(event.data.offlineMode === 'true') {offlineMode = true;}
	    else {offlineMode = false}
    }
	console.log(offlineMode, event.data);
});

