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
let isSending = false
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
    try {
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
        console.log('[SW_outletHandler]', 'outlets synced')
    } catch (e) {
        console.error('[SW_outletHandler]', e)
        throw e
    }
}

const waterElementDetailsHandler = async () => {
    try {
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
        console.log('[SW_waterElementDetailsHandler]', 'water-elements details synced')
    } catch (e) {
        console.error('[SW_waterElementDetailsHandler]', e)
        throw e
    }

}

const logsHandler = async () => {
    try {
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
        console.log('[SW_logsHandler]', 'logs synced')
    } catch (e) {
        console.error('[SW_logsHandler]', e)
        throw e
    }

}

const logsHistoryHandler = async () => {
    try {
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
        console.log('[SW_logsHistoryHandler]', 'logs history synced')
    } catch (e) {
        console.error('[SW_logsHistoryHandler]', e)
        throw e
    }
}

const consumerHandler = async () => {
    try {
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
        console.log('[SW_consumerHandler]', 'consumers synced')
    } catch (e) {
        console.error('[SW_consumerHandler]', e)
        throw e
    }
}

const invoiceHandler = async () => {
    try {
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
        console.log('[SW_consumerHandler]', 'consumers synced')
    } catch (e) {
        console.error('[SW_consumerHandler]', e)
        throw e
    }
}

const paymentHandler = async () => {
    try {
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
        console.log('[SW_paymentHandler]', 'payments synced' )
    } catch (e) {
        console.error('[SW_paymentHandler]', e)
        throw e
    }

}

const zoneHandler = async () => {
    try {
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
        console.log('[SW_zoneHandler]', 'zones synced')
    } catch (e) {
        console.error('[SW_zoneHandler]', e)
        throw e
    }

}

const managerHandler = async () => {
    try {
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
        console.log('[SW_managerHandler]', 'managers synced')
    } catch (e) {
        console.error('[SW_managerHandler]', e)
        throw e
    }
}

const ticketHandler = async () => {
    try {
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
        console.log('[SW_ticketHandler]', 'tickets synced')
    } catch (e) {
        console.error('[SW_ticketHandler]', e)
        throw e
    }
}

const waterElementHandler = async () => {
    try {
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
        console.log('[SW_waterElementHandler]', 'water-elements synced')
    } catch (e) {
        console.error('[SW_waterElementHandler]', e)
        throw e
    }
}

const getDataFromDB = async (table) => {
    channel.postMessage({
        title: 'updateStatus',
        date: await getOldestDate(),
        table: table,
        status: 'loading'
    })

    if (isDbLoading) return

    isDbLoading = true
    try {
        let isConnected = await fetch("../api/check-authentication")
        if (!isConnected.ok) throw 'You are not connected'
        await sendDataToDB(null, true)
        switch (table) {
            case "all":
                await Promise.all([
                    zoneHandler(),
                    waterElementHandler(),
                    waterElementDetailsHandler(),
                    outletHandler(),
                    managerHandler(),
                    ticketHandler(),
                    consumerHandler(),
                    paymentHandler(),
                    logsHandler(),
                    logsHistoryHandler()
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
                await waterElementHandler()
                break
        }
        channel.postMessage({
            title: 'updateStatus',
            status: 'loaded',
            table,
            date: await getOldestDate()
        })
        console.log('[SW_getDataFromDB]', 'Data synced')
    } catch (e) {
        channel.postMessage({
            title: 'updateStatus',
            status: 'failed',
            table,
            date: await getOldestDate()
        })
        console.error('[SW_getDataFromDB]', e)
        throw e
    } finally {
        isDbLoading = false
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
        console.log('[SW_EMPTY_DB]', 'IndexedDB is cleared')
    } catch (e) {
        console.error('[SW_EMPTY_DB]', e)
        throw e
    }
}

const updateIndexedDB = async (data) => {
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
                else await db.water_element_details.where('id').equals(parseInt(data.id)).modify(result => {result.geoJSON = data.data[1]})
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
                    action: (data.action === 'accept') ? "Validé" : "Refusé",
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
            table: data.table,
            consumerID: data.consumer || null
        })
        console.log('[SW_updateIndexedDB]', 'update done')
    } catch (e) {
        console.error('[SW_updateIndexedDB]',e)
        throw e
    }
}

const sendDataToDB = async(dataID, silent=false) => {
    if (isSending) return
    isSending = true

    let tab
    if(dataID !== null) tab = await db.update_queue.where('id').equals(dataID).toArray()
    else tab = await db.update_queue.toArray()

    try {
        await Promise.all(tab.map(async element => {
            let networkResponse = await fetch(element.url, element.init)
            if (networkResponse.ok) {
                await db.update_queue.delete(element.id)
                if (element.table !== 'MonthlyReport') await updateIndexedDB(await networkResponse.json())
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
        console.log('[SW_sendDataToDB]', 'data sent')
    } catch (e) {
        channel.postMessage({
            title: 'toPush',
            silent,
            dataID: dataID,
            success: false,
            toPush: await db.update_queue.count()
        })
        console.error('[SW_sendDataToDB]', e);
        throw e
    } finally {
        isSending = false
        channel.postMessage({
            title: 'reloadTable',
            table: 'tosync'
        })
    }
}

const cancelModification = async (id) => {
    try {
        let data = await db.update_queue.where('id').equals(id).first()
        let table = data.table
        if (table === "Logs") table = 'logs'
        if (table === "Carte") table = 'water_element_details'
        if (table === "IssueTable ") table = 'ticket'

        if (table === 'payment') {
            let details = data.details
            let consumerID = details.body.split("&").filter(entry => entry.includes('id_consumer='))[0].replace("id_consumer=", "")

            await db.consumer.where('id').equals(parseInt(consumerID)).modify(result => {result.sync -= 1;})
            await db.update_queue.where('id').equals(id).delete()
        }
        else {
            if (data.elemId === '?') await db.update_queue.where('id').equals(id).delete()
            else {
                let dataID = data.elemId
                console.log(dataID)
                await db.table(table).where('id').equals(parseInt(dataID)).modify(result => {result.sync -= 1;})
                db.update_queue.where('id').equals(id).delete()
            }
        }

        channel.postMessage({
            title: 'reloadTable',
            table: 'tosync'
        })

        console.log('[SW_cancelModification]', 'modification canceled')
    } catch (e) {
        console.error('[SW_cancelModification]', e)
        throw e
    }
}


/*********************************************************************************
 * Utils
 *********************************************************************************/
const addCache = async (cache, tab) => {
    try {
        let files = await caches.open(cache)
        await files.addAll(tab)
    } catch (e) {
        console.error('[SW_addCache]', e)
        throw e
    }
}

const cacheClean = async () => {
    try {
        let keys = await caches.keys()
        keys.forEach(key => {
            if (key !== cacheVersion) caches.delete(key)
        })
        setInfos('cacheLoaded', false)
        console.log('[SW_cacheClean]', 'cache cleaned')
    } catch (e) {
        console.error('[SW_cacheClean]', e)
        throw e
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
        let isConnected = await fetch("../api/check-authentication")
        if (!isConnected.ok) throw 'You are not connected'
        await Promise.all([
            addCache(cacheVersion, ['/offline/']),
            addCache(userCache, revalidatePages),
            addCache(userCache, cachePages),
            addCache(cacheVersion, staticFiles),
        ])
        setInfos('cacheLoaded', true)
        console.log('[SW_getCache]', 'Cache is loaded !')
    } catch (e) {
        console.error('[SW_getCache]', e)
        throw e
    } finally {
        isCacheLoading = false
    }
}

const getInfos = async () => {
    try {
        let data = await db.sessions.toCollection().first()

        username = data.username
        needDisconnect = data.needDisconnect
        dbLoaded = data.dbLoaded
        cacheLoaded = data.cacheLoaded

        channel.postMessage({
            title: 'getInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })

        console.log('[SW_getInfos]', 'Old service worker state has been loaded')
    } catch (e) {
        db.sessions.add({
            id: 1,
            username: null,
            needDisconnect: false,
            dbLoaded: false,
            cacheLoaded: false
        })
        channel.postMessage({
            title: 'updateInfos',
            toPush: await db.update_queue.count(),
            date: await getOldestDate()
        })
        console.log('[SW_getInfos]', 'New session has been created')
    } finally {
        synced = true
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
    } catch (e) {
        console.error('[SW_setInfos]', e)
        throw e
    }
}

const resetState = async () => {
    try {
        channel.postMessage({
            title: 'resetNavigation'
        })
        await cacheClean()
        await emptyDB()
        await Promise.all([
            setInfos('username', null),
            setInfos('needDisconnect', false),
            setInfos('dbLoaded', false),
            setInfos('cacheLoaded', false)
        ])
        synced = false
        console.log('[SW_resetState]' ,"Session has been reset")
    } catch (e) {
        console.error('[SW_resetState]', e)
        throw e
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
self.addEventListener('install',  async event => {
    event.waitUntil(await cacheClean())
})


self.addEventListener('activate', async event => {
    console.log('SW_ACTIVATE')
    await getInfos()
    if (!cacheLoaded && !needDisconnect) getCache()
    if (!dbLoaded && !needDisconnect) event.waitUntil(getDataFromDB('all'))
})


self.addEventListener('fetch', async event => {
    const url = event.request.url

    if (!synced) await getInfos()
    if (synced && !cacheLoaded && !isCacheLoading && !needDisconnect) event.waitUntil(getCache())
    if (synced && !dbLoaded && !isDbLoading && !needDisconnect) event.waitUntil(getDataFromDB('all'))

    if (event.request.method === 'POST' || event.request.method === 'post') {
        let networkResponse = event.waitUntil(await fetch(event.request))
        event.respondWith(networkResponse)

    } 
    else if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        event.respondWith(CacheOrFetchAndCache(event, cacheVersion))
    } 
    else if (url.includes('/logout')) {
        try {
            await Promise.all([cacheClean(), emptyDB(), resetState()])
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
        let networkResponse = event.waitUntil(await NetworkFirst(event, event.request.url))
        event.respondWith(networkResponse)
    } 
    else if (url.includes('/api/table') || url.includes('.png')) {
        try {
            let networkResponse = event.waitUntil(await fetch(event.request))
            event.respondWith(networkResponse)
        } catch (e) {

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


self.addEventListener('message', async event => {
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
            event.waitUntil(getDataFromDB(event.data.db))
            break
        case 'pushData':
            event.waitUntil(sendDataToDB(event.data.id))
            break
        case 'getUsername':
            if(username !== null && username !== event.data.username && username !== undefined) resetState()
            else if (username === null) await setInfos('username', event.data.username)
            break
        case 'acceptModification':
            await event.waitUntil(sendDataToDB(event.data.id))
            break
        case 'revertModification':
            await event.waitUntil(cancelModification(event.data.id))
            break
    }
})
