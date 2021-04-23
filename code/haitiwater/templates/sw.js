importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js")


/*********************************************************************************
 * Globals variables
 *********************************************************************************/
const cacheVersion = 'static'
const userCache = 'user_1'
const revalidatePages = ['/accueil/', '/offline/', '/aide/', '/profil/editer/']
const cachePages = ['/reseau/', '/gestion/', '/rapport/', '/consommateurs/', '/finances/', '/historique/', 'reseau/gis', '/modifications/']
const staticExt = ['.js', '.woff', '/static/']
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
]
const channel = new BroadcastChannel('sw-messages')
const dbVersion = 1
const db = new Dexie("user_db")

let synced = false
let isDbLoading = false
let dbLoaded = false
let isCacheLoading = false
let cacheLoaded = false
let username = null
let needDisconnect = false



/*********************************************************************************
 * IndexDB
 *********************************************************************************/
db.version(dbVersion).stores({
    editable:'table,is_editable,unSync_add,last_sync',
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
    sessions: 'id,username,needDisconnect,dbLoaded, cacheLoaded'
})

const getOldestDate = async () => {
    if (!dbLoaded) return null
    let tab = await db.editable.toArray()
    let date = new Date()
    for (let entry of tab) {
        if (date > entry.last_sync) {
            date = entry.last_sync
        }
    }
    return date
}

const waterElementDetailsHandler = () => {
    return fetch('http://127.0.0.1:8000/api/details/?table=water_element_all')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.water_element_details.clear();
                db.editable.put({table:'water_element_details', is_editable:true, last_sync: new Date()});
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
                    })
                }
            })
        )
}

const logsHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=logs&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.logs.clear();
                db.editable.put({table:'logs', is_editable:result.editable, last_sync: new Date()});
                for (let entry of result.data) {
                    db.logs.put({
                        id: entry.id,
                        time: entry.time,
                        type: entry.type,
                        user: entry.user,
                        summary: entry.summary,
                        details: entry.details,
                        sync: 0
                    })
                }
            })
        )
}

const logsHistoryHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=logs_history&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.logs_history.clear();
                db.editable.put({table:'logs_history', is_editable:result.editable, last_sync: new Date()});
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
                    })
                }
            })
        )
}

const consumerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=consumer_full&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.consumer.clear()
                db.editable.put({table:'consumer', is_editable:result.editable, last_sync: new Date()})
                db.consumer_details.clear()
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
                    })

                    db.consumer_details.put({
                        consumer_id: entry.consumer[0],
                        amount_due: entry.consumer[8],
                        validity: entry.validity,
                        sync: 0
                    })
                }
            })
        )
}

const paymentHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=all_payment&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.payment.clear()
                db.editable.put({table:'payment', is_editable:result.editable, last_sync: new Date()})
                for (let payment of result.data) {
                    db.payment.put({
                        id: payment.payments[0],
                        data: payment.payments[1],
                        value: payment.payments[2],
                        source: payment.payments[3],
                        user_id: payment.consumer_id,
                        sync: 0
                    })
                }
            })
        )
}

const zoneHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=zone&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.zone.clear()
                db.editable.put({table:'zone', is_editable:result.editable, last_sync: new Date()})
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
        )
}

const managerHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=manager&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.manager.clear()
                db.editable.put({table:'manager', is_editable:result.editable, last_sync: new Date()})
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
                    })
                }
            })
        )
}

const ticketHandler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=ticket&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.ticket.clear()
                db.editable.put({table:'ticket', is_editable:result.editable, last_sync: new Date()})
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
                    })
                }
            })
        )
}

const waterElement_handler = () => {
    return fetch('http://127.0.0.1:8000/api/table/?name=water_element&indexDB=true')
        .then(networkResponse => networkResponse.json()
            .then(result => {
                db.water_element.clear()
                db.editable.put({table:'water_element', is_editable:result.editable, last_sync: new Date()})
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
        )
}

const getDataFromDB = async (table) => {
    isDbLoading = true
    try {
        await sendDataToDB(null, true)
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
                ]).then(() => {
                    setInfos('dbLoaded', true)
                })
                break
            case "logs":
                await logsHandler()
                break
            case "logsHistory":
                await logsHistoryHandler()
                break
            case "consumer":
                await consumerHandler()
                break
            case "payment":
                await paymentHandler()
                break
            case "zone":
                await zoneHandler()
                break
            case "manager":
                await managerHandler()
                break
            case "ticket":
                await ticketHandler()
                break
            case "waterElement":
                await waterElement_handler()
                break
        }
        isDbLoading = false
        channel.postMessage({
            title: 'updateStatus',
            status: 'loaded',
            table,
            date: await getOldestDate()
        })
    } catch (err) {
        isDbLoading = false
        channel.postMessage({
            title: 'updateStatus',
            status: 'failed',
            table,
            date: await getOldestDate()
        })
        console.log('[SW_POPULATEDB]', err)
    }
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
    ]).then(() => {
        setInfos('dbLoaded', false)
    }).catch(err => {
        console.log('[SW_EMPTYDB]', err)
    })
}

const sendDataToDB = async(dataID, silent=false) => {
    let tab = []
    if(dataID !== null) tab = await db.update_queue.where('id').equals(dataID).toArray()
    else tab = await db.update_queue.toArray()

    return Promise.all(tab.map(element =>
        fetch(element.url, element.init).then(response => {
            if (response.ok) {
                console.log('[SW_SYNC]', 'The ' + element.id + ' is synced')
                db.update_queue.delete(element.id)
            } else {
                db.update_queue.update(element.id, {status: response.status}).then(update => {
                    console.log('[SW_PUSH]', 'Server refused the modifications for element ' + update.id)
                })
            }
        })
    )).then(async () => {
        if (silent)
        channel.postMessage({
            title: 'toPush',
            silent,
            toPush: await db.update_queue.count()
        })
    }).catch(async () => {
        console.log('[SW_PUSH]', 'Cannot reach the network, data still need to be pushed');
        channel.postMessage({
            title: 'toPush',
            silent,
            toPush: await db.update_queue.count()
        })
    })
}

const cancelModification = async (id) => {
    let data = db.update_queue.where('id').equals(id).first()
    let table = data.table
    let elemId = data.elemId
    let synced = db.table.where('id').equals(elemId).first().sync
    console.log(synced)
    db.table(table).update(elemId, {sync:synced})
    db.update_queue.where('id').equals(id).delete()
}


/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = (cache, tab) => {
    return caches.open(cache)
        .then(cache => cache.addAll(tab))
        .catch(err => {console.error('[SW_CACHEADD]', err)})
}

const cacheCleanedPromise = () => {
    return caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== cacheVersion) caches.delete(key)
        })
    }).then(() => {
        setInfos('cacheLoaded', false)
    })
}

const isRevalidatePages = (url) => {
    for (const ext of revalidatePages) {
        if (url.includes(ext)) return true
    }
    return false
}

const getCache = () => {
    isCacheLoading = true
    return Promise.all([
        addCache(cacheVersion, ['/offline/']),
        addCache(userCache, revalidatePages),
        addCache(userCache, cachePages),
        addCache(cacheVersion, staticFiles),
    ]).then(() => {
        setInfos('cacheLoaded', true)
        isCacheLoading = false
    }).catch(() => {
        isCacheLoading = false
    })
}

const getInfos = () => {
    return db.sessions.where('id').equals(1).first(async data => {
        username = data.username
        needDisconnect = data.needDisconnect
        dbLoaded = data.dbLoaded
        cacheLoaded = data.cacheLoaded
        channel.postMessage({
            title: 'getInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })
        return data
    }).then(() => {
        synced = true
    })
}

const setInfos = (info, value) => {
    switch (info) {
        case 'username':
            username = value;
            break
        case 'needDisconnect':
            needDisconnect = value;
            break
        case 'dbLoaded':
            dbLoaded = value
            break
        case 'cacheLoaded':
            cacheLoaded = value
    }
    db.sessions.put({
        id: 1,
        username: username,
        needDisconnect: needDisconnect,
        cacheLoaded: cacheLoaded,
        dbLoaded: dbLoaded
    })
}

const resetState = async () => {
    channel.postMessage({
        title: 'resetNavigation'
    })
    await cacheCleanedPromise()
    await emptyDB()
    synced = false
    setInfos('username', null)
    setInfos('needDisconnect', false)
    setInfos('dbLoaded', false)
    setInfos('cacheLoaded', false)
    console.log("State reset")
}

const CacheFirst = event => {
    return caches.match(event.request)
        .then(response => response || fetch(event.request).catch(() => caches.match('/offline/')))
}

const NetworkFirst = (event, page) => {
    return fetch(event.request)
        .catch(() => caches.match(page))
}

const StaleWhileRevalidate = event => {
    return caches.open(userCache)
        .then(cache => cache.match(event.request)
            .then(response => response || fetch(event.request)
                .then(networkResponse => {
                    cache.put(event.request, networkResponse.clone())
                    return networkResponse
                })
            )
        )
}

const CacheOrFetchAndCache = (event,cacheToUse) => {
    return caches.match(event.request)
        .then(cacheResponse =>
            cacheResponse || fetch(event.request)
                .then(networkResponse => {
                    const clonedResponse = networkResponse.clone()
                    caches.open(cacheToUse).then(cache => {
                        cache.put(event.request, clonedResponse).catch(error => {
                            console.error(error)
                        });
                    });
                    return networkResponse
                }).catch(function (error) {
                    console.error(error)
                })
        )
}

/*********************************************************************************
 * Event listener
 *********************************************************************************/
self.addEventListener('install', event => {
    event.waitUntil(cacheCleanedPromise())
})


self.addEventListener('activate', () => {
    db.sessions.add({
        id: 1,
        username: null,
        needDisconnect: false,
        dbLoaded: false,
        cacheLoaded: false
    }).then(async () => {
        channel.postMessage({
            title: 'updateInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })
        synced = true
        getCache()
        getDataFromDB('all')
    }).catch(() => {
        getInfos().then(async () => {
            if (!cacheLoaded && !needDisconnect) getCache()
            if (!dbLoaded && !needDisconnect) getDataFromDB('all')
            else channel.postMessage({
                title: 'updateInfos',
                toPush: await db.update_queue.count(),
                date: await getOldestDate()
            })
        })
        console.log('[SW_SESSIONS]', 'Old configuration has been charged')
    })
})


self.addEventListener('fetch', async event => {
    const url = event.request.url

    if (!synced) await getInfos()
    if (synced && !cacheLoaded && !isCacheLoading && !needDisconnect) getCache()
    if (synced && !dbLoaded && !isDbLoading && !needDisconnect) getDataFromDB('all')

    if (event.request.method === 'POST' || event.request.method === 'post') {
        event.respondWith(fetch(event.request))
    } 
    else if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(CacheOrFetchAndCache(event, cacheVersion))
    } 
    else if (url.includes('/logout')) {
        await Promise.all([cacheCleanedPromise(), emptyDB(), resetState()])
        event.respondWith(fetch(event.request)
            .then(networkResponse => {
                setInfos('needDisconnect', false)
                return networkResponse
            })
            .catch(() => {
                setInfos('needDisconnect', true)
                return caches.match('/offline/')
            })
        )
    } 
    else if (needDisconnect) {
        event.respondWith(fetch(event.request)
            .then(() => {
                setInfos('needDisconnect', false)
                return Response.redirect('/logout/')
            })
            .catch(() => {
                return caches.match('/offline/')
            })
        )
    } 
    else if (url.includes('/api/graph')){
        event.respondWith(NetworkFirst(event, event.request.url))
    } 
    else if (url.includes('/api/table') || url.includes('.png')) {
        event.respondWith(fetch(event.request)
            .catch(() => {
                console.error('cannot reach the dataTable online')
            })
        )
    }
    else if (url.includes('/login')) {
        event.respondWith(NetworkFirst(event, '/offline/'))
    }
    else if (isRevalidatePages(url)) {
        event.respondWith(StaleWhileRevalidate(event))
    }
    else {
        event.respondWith(CacheOrFetchAndCache(event, userCache))
    }
})


channel.addEventListener('message', async event => {
    switch (event.data.title) {
        case 'getInfos':
            if (username === null || username === undefined) {
                username = event.data.username
            }
            channel.postMessage({
                title: 'updateInfos',
                date: await getOldestDate(),
                toPush: await db.update_queue.count()
            })
            break
        case 'updateDB':
            if (!isDbLoading) getDataFromDB(event.data.db)
            channel.postMessage({
                title: 'updateStatus',
                date: await getOldestDate(),
                table: event.data.db,
                status: 'loading'
            })
            break
        case 'pushData':
            sendDataToDB(event.data.id)
            break
        case 'getUsername':
            if(username !== null && username !== event.data.username && username !== undefined) resetState()
            else if (username === null) setInfos('username', event.data.username)
            break
        case 'acceptModification':
            await sendDataToDB(event.data.id)
            break
        case 'revertModification':
            await cancelModification(event.data.id)
            break
    }
})