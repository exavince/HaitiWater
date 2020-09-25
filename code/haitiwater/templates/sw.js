const cacheVersion = 'v4';
const userCache = 'user_1';
const userPages = ['login'];

self.addEventListener('install', event => {
    // Cache the offline page by default
    event.waitUntil(
        caches.open(cacheVersion).then(cache => {
            return cache.addAll([
                '/offline/',
                '/static/report.js',
                '/static/monthlyReportFormHandler.js',
                '/static/monthlyReportEditFormHandler.js',
                '/static/vendor/bootstrap-wizard/jquery.bootstrap.wizard.js',
                '/static/vendor/bootstrap-multiselect/bootstrap-multiselect.js'
            ]).catch(error => {
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
    if (event.request.url.includes("/static/") ||
        event.request.url.includes(".js") ||
        event.request.url.includes(".wof"))
    {
        // For static elements, try to match in the cache, else fetch and cache
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
                        return Response.redirect('/offline/');
                    });
                })
            );
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
        /*event.respondWith(
            caches.match(event.request).then(cacheResponse => {
                return cacheResponse || fetch(event.request).catch(() => {
                    return Response.redirect('/offline/');
                });
            })
        );*/
    }
});