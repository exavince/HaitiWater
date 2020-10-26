importScripts("https://unpkg.com/dexie@3.0.2/dist/dexie.js");
const test = 'essai';
const cacheVersion = 'v4';
const userCache = 'user_1';
const userPages = ['/accueil/','/offline/','/reseau/','/reseau/gis','/gestion/','/historique/','/rapport/','/consommateurs/','/finances/','/aide/','/profil/editer/'];
const staticExt = ['.js','.woff','/static/'];
let needDisconnect = false;
let connected = false;
let dbVersion = 1;
let db = new Dexie("user_db");


db.version(dbVersion).stores({
    zone: 'id,name,cout_fontaine,mois_fontaine,cout_kiosque,mois_kiosque,cout_mensuel',
    consumer: 'id,nom,prenom,genre,adresse,telephone,membres,sortie_eau,argent_du,zone',
    ticket: 'id,urgence,emplacement,type,commentaire,statut,photo',
    water_element: 'id,type,place,users,state,m3,gallons,gestionnaire,zone_up',
    manager:'id,nom,prenom,telephone,mail,role,zone,unknown',
    consumer_details:'consumer_id,amount_due,validity',
    payment:'id,data,value,source,user_id',
});

const consumerHandler = async () => {
    await fetch('http://127.0.0.1:8000/api/get-zone/?name=consumer').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.consumer.add({
                    id:entry[0],
                    nom:entry[1],
                    prenom:entry[2],
                    genre:entry[3],
                    adresse:entry[4],
                    telephone:entry[5],
                    membres:entry[6],
                    sortie_eau:entry[7],
                    argent_du:entry[8],
                    zone:entry[9],
                })
                fetch('http://127.0.0.1:8000/api/details/?table=payment&id='+entry[0]).then(networkResponse => {
                    networkResponse.json().then(infos => {
                        db.consumer_details.add({
                            consumer_id:entry[0],
                            amount_due:infos.amount_due,
                            validity:infos.validity
                        })
                    });
                });
                fetch('http://127.0.0.1:8000/api/get-zone/?name=payment&user='+entry[0]).then(networkResponse => {
                    networkResponse.json().then(infos => {
                        for(let info of infos.data) {
                            db.payment.add({
                                id:info[0],
                                data:info[1],
                                value:info[2],
                                source:info[3],
                                user_id:entry[0],
                            })
                        }
                    })
                })
            }
        })
    })
}

const zoneHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=zone').then(networkResponse => {
        networkResponse.json().then(result => {
            for (let entry of result.data) {
                db.zone.add({
                    id: entry[0],
                    name: entry[1],
                    cout_fontaine: entry[2],
                    mois_fontaine: entry[3],
                    cout_kiosque: entry[4],
                    mois_kiosque: entry[5],
                    cout_mensuel: entry[6],
                })
            }
        })
    })
}

const managerHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=manager').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.manager.add({
                    id:entry[0],
                    nom:entry[1],
                    prenom:entry[2],
                    telephone:entry[3],
                    mail:entry[4],
                    role:entry[5],
                    zone:entry[6],
                    unknown:entry[7],
                })
            }
        })
    })
}

const ticketHandler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=ticket').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.ticket.add({
                    id:entry[0],
                    urgence:entry[1],
                    emplacement:entry[2],
                    type:entry[3],
                    commentaire:entry[4],
                    statut:entry[5],
                    photo:entry[6],
                })
            }
        })
    })
}

const waterElement_handler = () => {
    fetch('http://127.0.0.1:8000/api/get-zone/?name=water_element').then(networkResponse => {
        networkResponse.json().then(result => {
            for(let entry of result.data) {
                db.water_element.add({
                    id:entry[0],
                    type:entry[1],
                    place:entry[2],
                    users:entry[3],
                    state:entry[4],
                    m3:entry[5],
                    gallons:entry[6],
                    gestionnaire:entry[7],
                    zone_up:entry[8],
                })
            }
        })
    })
}

const populateDB = () => {
    consumerHandler();
    zoneHandler();
    managerHandler();
    ticketHandler();
    waterElement_handler();
}

populateDB();

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