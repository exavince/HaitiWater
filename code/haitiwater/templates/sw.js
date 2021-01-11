importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");


/*********************************************************************************
 * Variable globale
 *********************************************************************************/
const cacheVersion = 'static';
const userCache = 'user_1';
const revalidatePages = ['/accueil/', '/offline/', '/aide/', '/profil/editer/'];
const cachePages = ['/reseau/', '/gestion/', '/rapport/', '/consommateurs/', '/finances/', '/historique/', 'reseau/gis', '/modifications/'];
const staticExt = ['.js', '.woff', '/static/'];
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
    '/static/paymentModalHandler.js',
    '/static/paymentTableHandler.js',
    '/static/unsynchronizedTableGenerator.js',
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
];
const channel = new BroadcastChannel('sw-messages');
const dbVersion = 1;
const db = new Dexie("user_db");

let isConnecting = false;
let synced = false;
let username = null;
let offlineMode = false;
let needDisconnect = false;
let dataLoaded = false;
let lastUpdate = undefined;
let isLoading = false;
let connected = false;



/*********************************************************************************
 * IndexDB
 *********************************************************************************/
db.version(dbVersion).stores({
    editable:'table,is_editable,unSync_add',
    zone: 'id,name,cout_fontaine,mois_fontaine,cout_kiosque,mois_kiosque,cout_mensuel, sync',
    consumer: 'id,nom,prenom,genre,adresse,telephone,membres,sortie_eau,argent_du,zone, sync',
    ticket: 'id,urgence,emplacement,type,commentaire,statut,photo, sync',
    water_element: 'id,type,place,users,state,m3,gallons,gestionnaire,zone_up, sync',
    water_element_details: 'id,type,localization,manager,users,state,currentMonthCubic,averageMonthCubic,totalCubic,geoJSON',
    manager: 'id,nom,prenom,telephone,mail,role,zone,unknown, sync',
    consumer_details: 'consumer_id,amount_due,validity, sync',
    payment: 'id,data,value,source,user_id, sync',
    logs: 'id,time,type,user,summary,details, sync',
    logs_history: 'id,time,type,user,summary,details,action, sync',
    update_queue: '++id, url, init, date, type, table, elemId, status, details',
    sessions: 'id,username,needDisconnect,offlineMode,lastUpdate,dataLoaded, sync'
});

const waterElementDetailsHandler = () => {
    return fetch('http://127.0.0.1:8000/api/details/?table=water_element_all')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.water_element_details.clear();
                db.editable.put({table:'water_element_details', is_editable:true});
                console.log(result);
                for (let entry of result) {
                    db.water_element_details.put({
                        id: entry.id,
                        type: entry.type,
                        localization: entry.localization,
                        manager: entry.manager,
                        users: entry.users,
                        state: entry.state,
                        currentMonthCubic: entry.currentMonthCubic,
                        averageMonthCubic: entry.averageMonthCubic,
                        totalCubic: entry.totalCubic,
                        geoJSON: entry.geoJSON,
                        sync: 0
                    });
                }
            })
        );
}

const logsHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=logs&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.logs.clear();
                db.editable.put({table:'logs', is_editable:result.editable});
                for (let entry of result.data) {
                    db.logs.put({
                        id: entry.id,
                        time: entry.time,
                        type: entry.type,
                        user: entry.user,
                        summary: entry.summary,
                        details: entry.details,
                        sync: 0
                    });
                }
            })
        );
}

const logsHistoryHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=logs_history&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.logs_history.clear();
                db.editable.put({table:'logs_history', is_editable:result.editable});
                for (let entry of result.data) {
                    db.logs_history.put({
                        id: entry.id,
                        time: entry.time,
                        type: entry.type,
                        user: entry.user,
                        summary: entry.summary,
                        details: entry.details,
                        action: entry.action,
                        sync: 0
                    });
                }
            })
        );
}

const consumerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=consumer_full&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.consumer.clear();
                db.editable.put({table:'consumer', is_editable:result.editable});
                db.consumer_details.clear();
                for (let entry of result.data) {
                    db.consumer.put({
                        id: entry.consumer[0],
                        nom: entry.consumer[1],
                        prenom: entry.consumer[2],
                        genre: entry.consumer[3],
                        adresse: entry.consumer[4],
                        telephone: entry.consumer[5],
                        membres: entry.consumer[6],
                        sortie_eau: entry.consumer[7],
                        argent_du: entry.consumer[8],
                        zone: entry.consumer[9],
                        sync: 0
                    });

                    db.consumer_details.put({
                        consumer_id: entry.consumer[0],
                        amount_due: entry.consumer[8],
                        validity: entry.validity,
                        sync: 0
                    });
                }
            })
        );
}

const paymentHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=all_payment&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.payment.clear();
                db.editable.put({table:'payment', is_editable:result.editable});
                for (let payment of result.data) {
                    db.payment.put({
                        id: payment.payments[0],
                        data: payment.payments[1],
                        value: payment.payments[2],
                        source: payment.payments[3],
                        user_id: payment.consumer_id,
                        sync: 0
                    });
                }
            })
        );
}

const zoneHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=zone&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.zone.clear();
                db.editable.put({table:'zone', is_editable:result.editable});
                for (let entry of result.data) {
                    db.zone.put({
                        id: entry[0],
                        name: entry[1],
                        cout_fontaine: entry[2],
                        mois_fontaine: entry[3],
                        cout_kiosque: entry[4],
                        mois_kiosque: entry[5],
                        cout_mensuel: entry[6],
                        sync: 0
                    })
                }
            })
        );
}

const managerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=manager&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.manager.clear();
                db.editable.put({table:'manager', is_editable:result.editable});
                for (let entry of result.data) {
                    db.manager.put({
                        id: entry[0],
                        nom: entry[1],
                        prenom: entry[2],
                        telephone: entry[3],
                        mail: entry[4],
                        role: entry[5],
                        zone: entry[6],
                        unknown: entry[7],
                        sync: 0
                    });
                }
            })
        );
}

const ticketHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=ticket&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.ticket.clear();
                db.editable.put({table:'ticket', is_editable:result.editable});
                for (let entry of result.data) {
                    db.ticket.put({
                        id: entry[0],
                        urgence: entry[1],
                        emplacement: entry[2],
                        type: entry[3],
                        commentaire: entry[4],
                        statut: entry[5],
                        photo: entry[6],
                        sync: 0
                    });
                }
            })
        );
}

const waterElement_handler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=water_element&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.water_element.clear();
                db.editable.put({table:'water_element', is_editable:result.editable});
                for (let entry of result.data) {
                    db.water_element.put({
                        id: entry[0],
                        type: entry[1],
                        place: entry[2],
                        users: entry[3],
                        state: entry[4],
                        m3: entry[5],
                        gallons: entry[6],
                        gestionnaire: entry[7],
                        zone_up: entry[8],
                        sync: 0
                    })
                }
            })
        );
}

const getDataFromDB = async (table) => {
    try {
        switch (table) {
            case "all":
                await Promise.all([
                    consumerHandler(),
                    zoneHandler(),
                    managerHandler(),
                    ticketHandler(),
                    waterElement_handler(),
                    paymentHandler(),
                    logsHandler(),
                    logsHistoryHandler(),
                    waterElementDetailsHandler()
                ]);
                break;
            case "logs":
                await logsHandler();
                break;
            case "logsHistory":
                await logsHistoryHandler();
                break;
            case "consumer":
                await consumerHandler();
                break;
            case "payment":
                await paymentHandler();
                break;
            case "zone":
                await zoneHandler();
                break;
            case "manager":
                await managerHandler();
                break;
            case "ticket":
                await ticketHandler();
                break;
            case "waterElement":
                await waterElement_handler();
                break;
        }
        isLoading = false;
        setInfos('lastUpdate', new Date());
        channel.postMessage({
            title: 'updateStatus',
            status: 'loaded',
            date: lastUpdate
        });
    } catch (err) {
        isLoading = false;
        channel.postMessage({
            title: 'updateStatus',
            status: 'failed',
            date: lastUpdate
        });
        console.log('[SW_POPULATEDB]', err);
    }
}

const populateDB = async () => {
    isLoading = true;
    await sendDataToDB();
    return Promise.all([
        consumerHandler(),
        zoneHandler(),
        managerHandler(),
        ticketHandler(),
        waterElement_handler(),
        paymentHandler(),
        logsHandler(),
        logsHistoryHandler(),
        waterElementDetailsHandler()
    ]).then(() => {
        isLoading = false;
        setInfos('lastUpdate', new Date());
        channel.postMessage({
            title: 'updateStatus',
            status: 'loaded',
            date: lastUpdate
        });
    }).catch(err => {
        isLoading = false;
        channel.postMessage({
            title: 'updateStatus',
            status: 'failed',
            date: lastUpdate
        });
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
        db.logs_history.clear(),
        db.water_element_details.clear()
    ]).catch(err => {
        console.log('[SW_EMPTYDB]', err);
    });
}

const sendDataToDB = async () => {
    let tab = await db.update_queue.toArray();
    return Promise.all(tab.map(element =>
        fetch(element.url, element.init).then(response => {
            if (response.ok) {
                console.log('[SW_SYNC]', 'The ' + element.id + ' is synced');
                db.update_queue.delete(element.id);
            } else {
                db.update_queue.update(element.id, {unsync: response.status}).then(update => {
                    console.log('[SW_PUSH]', 'Server refused the modifications for element ' + update.id)
                });
            }
        })
    )).then(async () => {
        channel.postMessage({
            title: 'toPush',
            toPush: await db.update_queue.count()
        });
    }).catch(async () => {
        console.log('[SW_PUSH]', 'Cannot reach the network, data still need to be pushed');
        channel.postMessage({
            title: 'toPush',
            toPush: await db.update_queue.count()
        });
    })
}

const sendOneDataToDB = async (elementID) => {
    let table = db.table('update_queue');
    let result = await table.where('id').equals(elementID).first();
    fetch(result.url, result.init).then(response => {
        if (response.ok) {
            console.log('[SW_SYNC]', 'The ' + element.id + ' is synced');
            db.update_queue.delete(element.id);
        } else {
            db.update_queue.update(element.id, {unsync: response.status}).then(update => {
                console.log('[SW_PUSH]', 'Server refused the modifications for element ' + update.id)
            });
        }
    }).then(async () => {
        channel.postMessage({
            title: 'toPush',
            toPush: await db.update_queue.count()
        });
    }).catch(async () => {
        console.log('[SW_PUSH]', 'Cannot reach the network, data still need to be pushed');
        channel.postMessage({
            title: 'toPush',
            toPush: await db.update_queue.count()
        });
    })
}

/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = (cache, tab) => {
    return caches.open(cache)
        .then(cache => cache.addAll(tab))
        .catch(err => {console.error('[SW_CACHEADD]', err);});
}

const cacheCleanedPromise = () => {
    return caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== cacheVersion) return caches.delete(key);
        });
    });
}

const isRevalidatePages = (url) => {
    for (const ext of revalidatePages) {
        if (url.includes(ext)) return true;
    }
    return false;
};

const isConnected = () => {
    isConnecting = true;
    return fetch('/api/check-authentication')
        .then(response => {
            if (response.ok) {
                connected = true;
                isConnecting = false;
                return true;
            }
            isConnecting = false;
        })
        .catch(() => {
            isConnecting = false;
            return false;
        });
}

const getOfflineData = () => {
    isLoading = true;
    return Promise.all([
        getCache(),
        getDataFromDB("all"),
    ]).then(() => {
        setInfos('dataLoaded', true);
        isLoading = false;
    }).catch(err => {
        isLoading = false;
        console.error('[SW_GETDATA]', err);
    });
}

const getCache = () => {
    return Promise.all([
        addCache(cacheVersion, ['/offline/']),
        addCache(userCache, revalidatePages),
        addCache(userCache, cachePages),
        addCache(cacheVersion, staticFiles),
    ]);
}

const getInfos = () => {
    synced = true;
    return db.sessions.where('id').equals(1).first(async data => {
        username = data.username;
        needDisconnect = data.needDisconnect;
        offlineMode = data.offlineMode;
        lastUpdate = data.lastUpdate;
        dataLoaded = data.dataLoaded;
        channel.postMessage({
            title: 'getInfos',
            toPush: await db.update_queue.count(),
            offlineMode: offlineMode,
            date: lastUpdate
        });
        return data;
    });
}

const setInfos = (info, value) => {
    switch (info) {
        case 'username':
            username = value;
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
        id: 1,
        username: username,
        needDisconnect: needDisconnect,
        offlineMode: offlineMode,
        lastUpdate: lastUpdate,
        dataLoaded: dataLoaded
    });
}

const resetState = async () => {
    channel.postMessage({
        title: 'resetNavigation'
    });
    await cacheCleanedPromise()
    await emptyDB();
    synced = false;
    setInfos('username', null);
    setInfos('offlineMode', false);
    setInfos('needDisconnect', false);
    setInfos('dataLoaded', false);
    setInfos('lastUpdate', undefined);
    setInfos('isLoading', false);
    connected = false;
    console.log("State reset")
}

const CacheFirst = event => {
    return caches.match(event.request)
        .then(response => response || fetch(event.request).catch(() => caches.match('/offline/')));
}

const NetworkFirst = (event, page) => {
    return fetch(event.request)
        .catch(() => caches.match(page));
}

const StaleWhileRevalidate = event => {
    return caches.open(userCache)
        .then(cache => cache.match(event.request)
            .then(response => response || fetch(event.request)
                .then(networkResponse => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                })
            )
        );
}

const CacheOrFetchAndCache = (event,cacheToUse) => {
    return caches.match(event.request)
        .then(cacheResponse =>
            cacheResponse || fetch(event.request)
                .then(networkResponse => {
                    const clonedResponse = networkResponse.clone();
                    caches.open(cacheToUse).then(cache => {
                        cache.put(event.request, clonedResponse).catch(error => {
                            console.error(error)
                        });
                    });
                    return networkResponse;
                }).catch(function (error) {
                    console.error(error)
                })
        )
}

/*********************************************************************************
 * Event listener
 *********************************************************************************/
self.addEventListener('install', event => {
    event.waitUntil(cacheCleanedPromise());
});


self.addEventListener('activate', () => {
    db.sessions.add({
        id: 1,
        username: undefined,
        needDisconnect: false,
        offlineMode: false,
        lastUpdate: undefined,
        dataLoaded: false
    }).then(async () => {
        channel.postMessage({
            title: 'updateInfos',
            offlineMode: offlineMode,
            toPush: await db.update_queue.count(),
            date: lastUpdate
        });
        getOfflineData();
    }).catch(() => {
        getInfos().then(async () => {
            if (!dataLoaded) getOfflineData();
            else channel.postMessage({
                title: 'updateInfos',
                offlineMode: offlineMode,
                toPush: await db.update_queue.count(),
                date: lastUpdate
            });
            getCache();
        });
        console.log('[SW_SESSIONS]', 'Old configuration has been charged');
    });
});


self.addEventListener('fetch', async event => {
    const url = event.request.url;

    if (!synced) await getInfos();
    if (!connected && !needDisconnect && !isConnecting) await isConnected();
    if (!dataLoaded && connected && !isLoading) event.waitUntil(getOfflineData());

    if (event.request.method === 'POST' || event.request.method === 'post') {
        event.respondWith(fetch(event.request));
    } else if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(CacheOrFetchAndCache(event, cacheVersion));
    } else if (url.includes('/logout')) {
        await Promise.all([cacheCleanedPromise(), emptyDB(), resetState()]);
        event.respondWith(fetch(event.request)
            .then(networkResponse => {
                setInfos('needDisconnect', false);
                return networkResponse;
            })
            .catch(() => {
                setInfos('needDisconnect', true);
                return caches.match('/offline/');
            })
        );
    } else if (needDisconnect) {
        event.respondWith(fetch(event.request)
            .then(() => {
                setInfos('needDisconnect', false);
                return Response.redirect('/logout/');
            })
            .catch(() => {
                return caches.match('/offline/');
            })
        );
    } else if (url.includes('/api/graph')){
        event.respondWith(NetworkFirst(event, event.request.url));
    } else if (url.includes('/api/table') || url.includes('.png')) {
        event.respondWith(fetch(event.request)
            .catch(() => {
                console.error('cannot reach the dataTable online')
            })
        );
    }
    else if (url.includes('/login')) {
        event.respondWith(NetworkFirst(event, '/offline/'));
    }
    else if (isRevalidatePages(url)) {
        event.respondWith(StaleWhileRevalidate(event))
    }
    else {
        event.respondWith(CacheOrFetchAndCache(event, userCache));
    }
});


channel.addEventListener('message', async event => {
    switch (event.data.title) {
        case 'getInfos':
            if (username === null || username === undefined) {
                username = event.data.username;
            }
            channel.postMessage({
                title: 'updateInfos',
                date: lastUpdate,
                toPush: await db.update_queue.count()
            });
            break
        case 'updateDB':
            if (!isLoading) getDataFromDB(event.data.db);
            channel.postMessage({
                title: 'updateStatus',
                date: lastUpdate,
                status: 'loading'
            });
            break
        case 'pushData':
            sendDataToDB();
            break
        case 'getUsername':
            console.log(event.data.username)
            console.log(username)
            if(username !== null && username !== event.data.username && username !== undefined) resetState();
            else if (username === null) setInfos('username', event.data.username);
            break
        case 'acceptModification':
            await sendOneDataToDB(event.data.id)
            break
        case 'revertModification':
            break
    }
});