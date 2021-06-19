/*********************************************************************************
 * Globals variables
 *********************************************************************************/
const cacheVersion = 'static'
const userCache = 'user_1'
const revalidatePages = ['/accueil/', '/offline/', '/aide/', '/profil/editer/']
const cachePages = ['/reseau/', '/gestion/', '/rapport/', '/consommateurs/', '/finances/', '/historique/', '/reseau/gis', '/modifications/']
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

let synced = false
let isDbLoading = false
let isSending = false
let dbLoaded = false
let isCacheLoading = false
let cacheLoaded = false
let username = null
let needDisconnect = false



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
