importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");

const cacheVersion = 'v4';
const userCache = 'user_1';
const userPages = ['/accueil/','/offline/','/reseau/','/reseau/gis','/gestion/','/historique/','/rapport/','/consommateurs/','/finances/','/aide/','/profil/editer/'];
const staticExt = ['.js','.woff','/static/'];
let needDisconnect = false;
let connected = false;

let db = new Dexie("user_db");
db.version(1).stores({
    zone: 'id,name,cout_fontaine,mois_fontaine,cout_kiosque,mois_kiosque,cout_mensuel',
    consumer: 'id,nom,prenom,genre,adresse,telephone,membres,sortie_eau,zone,argent_du',
    rapport: 'id,type,urgence,element,description,statut,photo',
    water_element: 'id,type,place,users,state,m3,gallons,gestionnaire,zonu_up',

});

const zoneHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=zone').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.zone.add({
                    id:entry[0],
                    name:entry[1],
                    cout_fontaine:entry[2],
                    mois_fontaine:entry[3],
                    cout_kiosque:entry[4],
                    mois_kiosque:entry[5],
                    cout_mensuel:entry[6],
                })
            }
        })
    })
}

const consumerHandler = () => {

}



const dbHandler = () => {

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
                                    Promise.resolve(addCache(cacheVersion, ['/offline/']))
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