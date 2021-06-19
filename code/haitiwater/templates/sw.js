self.importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js")
self.importScripts("/static/javascripts/indexedDB.js")
self.importScripts("/static/javascripts/swUtils.js")



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
