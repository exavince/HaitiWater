importScripts("../static/javascripts/dexie.js")


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
    consumer: 'id,nom,prenom,genre,adresse,telephone,membres,sortie_eau,argent_du,zone, validity, sync',
    ticket: 'id,urgence,emplacement,type,commentaire,statut,photo, sync',
    water_element: 'id,type,place,users,state,m3,gallons,gestionnaire,zone_up, sync',
    water_element_details: 'id,type,localization,manager,users,state,currentMonthCubic,averageMonthCubic,totalCubic,geoJSON, sync',
    manager: 'id,nom,prenom,telephone,mail,role,zone,unknown, sync',
    payment: 'id,data,value,source,user_id, sync',
    logs: 'id,time,type,user,summary,details, sync',
    logs_history: 'id,time,type,user,summary,details,action, sync',
    update_queue: '++id, url, init, date, type, table, elemId, status, details',
    sessions: 'id,username,needDisconnect,dbLoaded, cacheLoaded',
    outlets: 'id, name',
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

const outletHandler = async () => {
    let networkResponse = await fetch('../api/outlets/')
    let json = await networkResponse.json()
    await db.outlets.clear()
    db.editable.put({table:'outlets', is_editable:false, last_sync: new Date()})
    for (let entry of json.data) {
        db.outlets.put({
            id:entry[0],
            name:entry[1],
        })
    }
}

const waterElementDetailsHandler = async () => {
    let networkResponse = await fetch('../api/details/?table=water_element_all')
    let json = await networkResponse.json()
    await db.water_element_details.clear()
    db.editable.put({table:'waterElementDetails', is_editable:true, last_sync: new Date()})
    for (let entry of json) {
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
}

const logsHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=logs&indexDB=true')
    let json = await networkResponse.json()
    await db.logs.clear()
    db.editable.put({table:'logs', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const logsHistoryHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=logs_history&indexDB=true')
    let json = await networkResponse.json()
    await db.logs_history.clear()
    db.editable.put({table:'logsHistory', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const consumerHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=consumer_full&indexDB=true')
    let json = await networkResponse.json()
    await db.consumer.clear()
    db.editable.put({table:'consumer', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
            validity: entry.validity,
            sync: 0
        })
    }
}

const paymentHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=all_payment&indexDB=true')
    let json = await networkResponse.json()
    await db.payment.clear()
    db.editable.put({table:'payment', is_editable:json.editable, last_sync: new Date()})
    for (let payment of json.data) {
        db.payment.put({
            id: payment.payments[0],
            data: payment.payments[1],
            value: payment.payments[2],
            source: payment.payments[3],
            user_id: payment.consumer_id,
            sync: 0
        })
    }
}

const zoneHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=zone&indexDB=true')
    let json = await networkResponse.json()
    await db.zone.clear()
    db.editable.put({table:'zone', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const managerHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=manager&indexDB=true')
    let json = await networkResponse.json()
    await db.manager.clear()
    db.editable.put({table:'manager', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const ticketHandler = async () => {
    let networkResponse = await fetch('../api/table/?name=ticket&indexDB=true')
    let json = await networkResponse.json()
    await db.ticket.clear()
    db.editable.put({table:'ticket', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const waterElement_handler = async () => {
    let networkResponse = await fetch('../api/table/?name=water_element&indexDB=true')
    let json = await networkResponse.json()
    await db.water_element.clear()
    db.editable.put({table:'waterElement', is_editable:json.editable, last_sync: new Date()})
    for (let entry of json.data) {
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
}

const getDataFromDB = async (table) => {
    if (isDbLoading) return

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
                    waterElementDetailsHandler(),
                    outletHandler(),
                ])
                setInfos('dbLoaded', true)
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
        console.log('[SW_POPULATE_DB]', table + ' table synced !')
    } catch (err) {
        isDbLoading = false
        channel.postMessage({
            title: 'updateStatus',
            status: 'failed',
            table,
            date: await getOldestDate()
        })
        console.log('[SW_POPULATE_DB]', err)
    }
}

const emptyDB = async () => {
    try {
        await Promise.all([
            db.zone.clear(),
            db.consumer.clear(),
            db.ticket.clear(),
            db.water_element.clear(),
            db.manager.clear(),
            db.payment.clear(),
            db.logs.clear(),
            db.logs_history.clear(),
            db.water_element_details.clear(),
            db.outlets.clear(),
        ])
        setInfos('dbLoaded', false)
        console.log('[SW_EMPTY_DB]', 'IndexDB is cleared !')
    } catch (err) {
        console.log('[SW_EMPTY_DB]', err)
    }
}

const updateIndexDB = async (data) => {
    try {
        if (data.type === 'delete' && data.table !== 'manager' && data.table !== 'water_element_details' && data.table !== 'payment') {
            await db.table(data.table).where('id').equals(parseInt(data.data)).delete()
            channel.postMessage({
                title: 'reloadTable',
                table: data.table
            })
            return
        }

        switch (data.table) {
            case 'water_element':
                await db.water_element.put({
                    id: data.data[0],
                    type: data.data[1],
                    place: data.data[2],
                    users: data.data[3],
                    state: data.data[4],
                    m3: data.data[5],
                    gallons: data.data[6],
                    gestionnaire: data.data[7],
                    zone_up: data.data[8],
                    sync: 0
                })
                break

            case 'water_element_details':
                if (data.type === 'delete') await db.water_element_details.where('id').equals(parseInt(data.data)).modify(result => {result.geoJSON = null})
                else await db.water_element_details.where('id').equals(parseInt(data.data)).modify(result => {result.geoJSON = data.data[1]})
                break

            case 'consumer':
                await db.consumer.put({
                    id: data.data[0],
                    nom: data.data[1],
                    prenom: data.data[2],
                    genre: data.data[3],
                    adresse: data.data[4],
                    telephone: data.data[5],
                    membres: data.data[6],
                    sortie_eau: data.data[7],
                    argent_du: data.data[8],
                    zone: data.data[9],
                    sync: 0
                })
                break

            case 'logs':
                let log = await db.logs.where('id').equals(parseInt(data.data)).first()
                await db.logs_history.put({
                    id: log.id,
                    time: log.time,
                    type: log.type,
                    user: log.user,
                    summary: log.summary,
                    details: log.details,
                    action: data.action,
                    sync: 0
                })
                await db.logs.where('id').equals(parseInt(data.data)).delete()
                break

            case 'manager':
                if (data.type === 'delete') {
                    await db.manager.where('id').equals(data.data).delete()
                    break
                }
                await db.manager.put({
                    id: data.data[0],
                    nom: data.data[1],
                    prenom: data.data[2],
                    telephone: data.data[3],
                    mail: data.data[4],
                    role: data.data[5],
                    zone: data.data[6],
                    unknown: data.data[7],
                    sync: 0
                })
                break

            case 'payment':
                if (data.type === 'delete') {
                    let amount = await db.payment.where('id').equals(parseInt(data.data)).first()
                    await db.payment.where('id').equals(parseInt(data.data)).delete()
                    await db.consumer.where('id').equals(parseInt(data.consumer)).modify(result => {
                        result.argent_du += amount.value;
                        result.sync -= 1
                    })
                } else {
                    if (data.type === 'edit') {
                        let amount = await db.payment.where('id').equals(parseInt(data.data)).first()
                        await db.consumer.where('id').equals(parseInt(data.consumer)).modify(result => {
                            result.argent_du += (amount.value - data.data[2]);
                            result.sync -= 1
                        })
                    }
                    else {
                        await db.consumer.where('id').equals(parseInt(data.consumer)).modify(result => {
                            result.argent_du -= data.data[2];
                            result.sync -= 1
                        })
                    }

                    await db.payment.put({
                        id: data.data[0],
                        data: data.data[1],
                        value: data.data[2],
                        source: data.data[3],
                        user_id: data.consumer,
                        sync: 0
                    })
                }
                break

            case 'ticket':
                await db.ticket.put({
                    id: data.data[0],
                    urgence: data.data[1],
                    emplacement: data.data[2],
                    type: data.data[3],
                    commentaire: data.data[4],
                    statut: data.data[5],
                    photo: data.data[6],
                    sync: 0
                })
                break

            case 'zone':
                await db.zone.put({
                    id: data.data[0],
                    name: data.data[1],
                    cout_fontaine: data.data[2],
                    mois_fontaine: data.data[3],
                    cout_kiosque: data.data[4],
                    mois_kiosque: data.data[5],
                    cout_mensuel: data.data[6],
                    sync: 0
                })
                break
        }
        channel.postMessage({
            title: 'reloadTable',
            table: data.table
        })
    } catch (err) {
        console.log('[SW_UPDATE_IDB]',err)
    }
}

const sendDataToDB = async(dataID, silent=false) => {
    let tab
    if(dataID !== null) tab = await db.update_queue.where('id').equals(dataID).toArray()
    else tab = await db.update_queue.toArray()

    try {
        await Promise.all(tab.map(async element => {
            let networkResponse = await fetch(element.url, element.init)
            if (networkResponse.ok) {
                console.log('[SW_SYNC]', 'The ' + element.id + 'data is synced')
                await db.update_queue.delete(element.id)
                await updateIndexDB(await networkResponse.json())
                channel.postMessage({
                    title: 'toPush',
                    silent,
                    data: dataID,
                    success: true,
                    toPush: await db.update_queue.count()
                })
            } else {
                await db.update_queue.update(element.id, {status: networkResponse.status}).then(update => {
                    console.log('[SW_PUSH_'+ update.id +']', networkResponse.statusText)
                })
                channel.postMessage({
                    title: 'toPush',
                    silent,
                    data: dataID,
                    success: false,
                    toPush: await db.update_queue.count()
                })
            }
        }))
    } catch (err) {
        console.log('[SW_PUSH]', err);
        channel.postMessage({
            title: 'toPush',
            silent,
            dataID: dataID,
            success: false,
            toPush: await db.update_queue.count()
        })
    }
}

const cancelModification = async (id) => {
    let data = await db.update_queue.where('id').equals(id).first()
    let table = data.table
    let elemId = parseInt(data.elemId)

    if (elemId === NaN) {

    }
    else {

    }
    console.log(synced)
    db.table(table).update(elemId, {sync:synced})
    db.update_queue.where('id').equals(id).delete()
}


/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = async (cache, tab) => {
    try {
        let files = await caches.open(cache)
        await files.addAll(tab)
    } catch (err) {
        console.error('[SW_CACHEADD]', err)
    }
}

const cacheCleanedPromise = async () => {
    try {
        let keys = await caches.keys()
        keys.forEach(key => {
            if (key !== cacheVersion) caches.delete(key)
        })
        setInfos('cacheLoaded', false)
    } catch (err) {
        console.log('[SW_CACHE_CLEAN]', err)
    }
}

const isRevalidatePages = (url) => {
    for (const ext of revalidatePages) {
        if (url.includes(ext)) return true
    }
    return false
}

const getCache = async () => {
    if (isCacheLoading) return
    isCacheLoading = true

    try {
        await Promise.all([
            addCache(cacheVersion, ['/offline/']),
            addCache(userCache, revalidatePages),
            addCache(userCache, cachePages),
            addCache(cacheVersion, staticFiles),
        ])
        setInfos('cacheLoaded', true)
        isCacheLoading = false
        console.log('[SW_GET_CACHE]', 'Cache is loaded !')
    } catch (err) {
        isCacheLoading = false
        console.log('[SW_GET_CACHE]', err)
    }
}

const getInfos = async () => {
    try {
        let data = await db.sessions.toCollection().first()
        console.log(data)

        username = data.username
        needDisconnect = data.needDisconnect
        dbLoaded = data.dbLoaded
        cacheLoaded = data.cacheLoaded

        channel.postMessage({
            title: 'getInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })

        if (!cacheLoaded && !needDisconnect) getCache()
        if (!dbLoaded && !needDisconnect) getDataFromDB('all')

        synced = true
        console.log('[SW_GET_INFOS]', 'Old service worker state has been charged !')
        return data
    } catch (err) {
        console.log('[SW_GET_INFOS]', 'New sessions !')
        db.sessions.add({
            id: 1,
            username: null,
            needDisconnect: false,
            dbLoaded: false,
            cacheLoaded: false
        })
        synced = true
        channel.postMessage({
            title: 'updateInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })
        await Promise.all([getCache(), getDataFromDB('all')])
    }
}

const setInfos = async (info, value) => {
    try {
        switch (info) {
            case 'username':
                username = value;
                db.sessions.toCollection().modify(data => {data.username = value})
                break
            case 'needDisconnect':
                needDisconnect = value;
                db.sessions.toCollection().modify(data => {data.needDisconnect = value})
                break
            case 'dbLoaded':
                dbLoaded = value
                db.sessions.toCollection().modify(data => {data.dbLoaded = value})
                break
            case 'cacheLoaded':
                cacheLoaded = value
                db.sessions.toCollection().modify(data => {data.cacheLoaded = value})
                break
        }
    } catch (err) {
        console.log('[SW_SET_INFOS]', err)
    }
}

const resetState = async () => {
    try {
        channel.postMessage({
            title: 'resetNavigation'
        })
        await cacheCleanedPromise()
        await emptyDB()
        synced = false
        await Promise.all([
            setInfos('username', null),
            setInfos('needDisconnect', false),
            setInfos('dbLoaded', false),
            setInfos('cacheLoaded', false)
        ])
        console.log('[SW_RESET_STATE]' ,"IndexDB session is reset")
    } catch (err) {
        console.log('[SW_RESET_STATE]', err)
    }
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
                })
        )
}

/*********************************************************************************
 * Event listener
 *********************************************************************************/
self.addEventListener('install', event => {
    event.waitUntil(cacheCleanedPromise())
})


self.addEventListener('activate', async () => {
    console.log('SW_ACTIVATE')
    await getInfos()
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
        try {
            await Promise.all([cacheCleanedPromise(), emptyDB(), resetState()])
            let networkResponse = fetch(event.request)
            setInfos('needDisconnect', false)
            event.respondWith(networkResponse)
        } catch (e) {
            setInfos('needDisconnect', true)
            event.respondWith(caches.match('/offline/'))
        }
    } 
    else if (needDisconnect) {
        try {
            await fetch(event.request)
            setInfos('needDisconnect', false)
            event.respondWith(Response.redirect('/logout/'))
        } catch (e) {
            event.respondWith(caches.match('/offline/'))
        }
    } 
    else if (url.includes('/api/graph')){
        event.respondWith(NetworkFirst(event, event.request.url))
    } 
    else if (url.includes('/api/table') || url.includes('.png')) {
        try {
            event.respondWith(await fetch(event.request))
        } catch (e) {
            console.error('cannot reach the dataTable online')
        }
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
            else if (username === null) await setInfos('username', event.data.username)
            break
        case 'acceptModification':
            await sendDataToDB(event.data.id)
            break
        case 'revertModification':
            await cancelModification(event.data.id)
            break
    }
})