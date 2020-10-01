const cacheVersion = 'v4';
const userCache = 'user_1';
const userPages = ['/accueil/','/offline/'];
let needDisconnect = false;

self.addEventListener('install', event => {
    // Cache the offline page by default
    event.waitUntil(
        caches.open(cacheVersion).then(cache => {
            return cache.addAll(
                userPages
            ).catch(error => {
                console.error(error)
            });
        }).catch(function (error) {
            console.error(error)
        })
    );
});


self.addEventListener('activate', (evt) => {
    let cacheCleanedPromise = caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== cacheVersion) {
                return caches.delete(key);
            }
        });
    });
    evt.waitUntil(cacheCleanedPromise);
});


self.addEventListener('fetch', event => {
    console.log('nav : '+navigator.onLine + '   needDC : ' +needDisconnect);
    if (event.request.url.includes("/static/") ||
        event.request.url.includes(".js") ||
        event.request.url.includes(".wof"))
    {
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
            let cacheCleanedPromise = caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key === userCache) {
                        return caches.delete(key);
                    }
                });
            });
            event.waitUntil(cacheCleanedPromise);
            event.respondWith(
                caches.match(event.request).then(cacheResponse => {
                    return cacheResponse || fetch(event.request).then(networkResponse => {
                        const clonedResponse = networkResponse.clone();
                        caches.open(userCache).then(cache => {
                            cache.put(event.request, clonedResponse).catch(error => {
                                console.error(error)
                            });
                        });
                        return networkResponse;
                    }).catch(() => {
                        needDisconnect = true;
                        return Response.redirect('/offline/');
                    });
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
