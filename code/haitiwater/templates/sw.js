const cacheVersion = 'v4';
const userCache = 'user_1';
const userPages = ['/accueil/','/offline/','/reseau/','/reseau/gis','/gestion/','/historique/','/rapport/','/consommateurs/','/finances/','/aide/','/profil/editer/'];
const staticExt = ['.js','.woff','/static/'];
let needDisconnect = false;
let connected = false;
let request = self.indexedDB.open('EXAMPLE_DB', 1);

request.onsuccess = event => {
    console.log('[onsuccess]', request.result);
    let products = [
        {id: 1, name: 'Red Men T-Shirt', price: '$3.99'},
        {id: 2, name: 'Pink Women Shorts', price: '$5.99'},
        {id: 3, name: 'Nike white Shoes', price: '$300'}];

    let db = event.target.result;
    let transaction = db.transaction('products', 'readwrite');

    transaction.onsuccess = function(event) {
        console.log('[Transaction] ALL DONE!');
    };

    let productsStore = transaction.objectStore('products');

    products.forEach(function(product){
        let db_op_req = productsStore.add(product); // IDBRequest
    });
}

request.onerror = event => {
    console.log('[onerror]', request.error);
}

request.onupgradeneeded = event => {
    let db = event.target.result;
    let store = db.createObjectStore('products', {keyPath: 'id', autoIncrement: true});
    store.createIndex('products_id', 'id', {unique: true});
}

const isStatic = event => {
    for(const ext of staticExt) {
        if(event.request.url.includes(ext)) {
            return true;
        }
    }
    return false;
}

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
            if (key === userCache) {
               return caches.delete(key);
            }
        })
    })
}

/*********************************************************************************
 * Event listener
 *********************************************************************************/

self.addEventListener('install', event => {
    // Cache the offline page by default
     let cacheCleanedPromise = caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== cacheVersion) {
                return caches.delete(key);
            }
        });
    });
    event.waitUntil(cacheCleanedPromise);
});


self.addEventListener('activate', event => {
    Promise.all([addCache(userCache, userPages), addCache(cacheVersion, ['/offline/'])]);
});


self.addEventListener('fetch', event => {
    if (isStatic(event)) {
        event.respondWith(
            caches.match(event.request).then(cacheResponse => {
                return cacheResponse || fetch(event.request).then(networkResponse => {
                    const clonedResponse = networkResponse.clone();
                    caches.open(cacheVersion).then(cache => {
                        cache.put(event.request, clonedResponse).catch(error => {
                            console.error(error)
                        });
                    });
                    return networkResponse;
                }).catch(error => {
                    console.error(error)
                });
            })
        );
    }
    else {
        const url = event.request.url;
        if (url.includes('/logout/')) {
            Promise.resolve(cacheCleanedPromise());
            event.respondWith(
                fetch(event.request).then(networkResponse => {
                    connected = false;
                    return networkResponse;
                }).catch(() => {
                    needDisconnect = true;
                    return Response.redirect('/offline/');
                })
            );
        }
        else {
            if (needDisconnect) {
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
                event.respondWith(
                    caches.match(event.request).then(cacheResponse => {
                        return cacheResponse || fetch(event.request).then(networkResponse => {
                            if (url.includes('/accueil/')) {
                                if (connected === false) {
                                    connected = true;
                                    Promise.resolve(addCache(userCache, userPages))
                                }
                            }
                            const clonedResponse = networkResponse.clone();
                            caches.open(userCache).then(cache => {
                                cache.put(event.request, clonedResponse).catch(error => {
                                    console.error(error)
                                });
                            });
                            return networkResponse;
                        }).catch(() => {
                            return Response.redirect('/offline/');
                        });
                    })
                );
            }
        }
    }
});