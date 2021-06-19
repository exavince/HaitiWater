const timeout = 180

describe('Mocha', () => {
    it('Tests mocha', () => {
        chai.expect(true);
    })
})


describe('Service Worker - Cache functions', () => {
    it('Should empty the cache', async () => {
        await cacheClean()
        chai.expect(await caches.has('user_1')).to.equal(false)
    }).timeout(timeout * 1000)

    it('Should get the cache', async () => {
        return getCache()
    }).timeout(timeout * 1000)

    it('Should check the static files in the cache', async () => {
        let data = await db.sessions.toCollection().first()
        while(!data.cacheLoaded) {data = await db.sessions.toCollection().first()}

        return Promise.all(staticFiles.map(async element => {
            return caches.match(element)
                .then(async response => {
                    if(!response) throw 'Eek, no response was found in the cache.'
                    console.log(await response.statusText)
                    return response.status;
                })
        }))
    }).timeout(timeout * 1000)

    it('Should check the pages to revalidate in cache', async () => {
        let data = await db.sessions.toCollection().first()
        while(!data.cacheLoaded) {data = await db.sessions.toCollection().first()}

        return Promise.all(revalidatePages.map(async element => {
            return caches.match(element)
                .then(async response => {
                    if(!response) throw 'Eek, no response was found in the cache.'
                    console.log(await response.statusText)
                    return response.status;
                })
        }))
    }).timeout(timeout * 1000)

    it('Should check the static pages in cache', async () => {
        let data = await db.sessions.toCollection().first()
        while(!data.cacheLoaded) {data = await db.sessions.toCollection().first()}

        return Promise.all(cachePages.map(async element => {
            return caches.match(element)
                .then(async response => {
                    if(!response) throw 'No response was found in the cache for:' + element
                    console.log(await response.statusText)
                    return response.status;
                })
        }))
    }).timeout(timeout * 1000)
})


describe('Service Worker - DB functions', () => {
    it('Should empty the DB', async () => {
        await emptyDB()
        chai.expect(await db.water_element.count()).to.equal(0)
        chai.expect(await db.water_element_details.count()).to.equal(0)
        chai.expect(await db.logs.count()).to.equal(0)
        chai.expect(await db.logs_history.count()).to.equal(0)
        chai.expect(await db.consumer.count()).to.equal(0)
        chai.expect(await db.payment.count()).to.equal(0)
        chai.expect(await db.zone.count()).to.equal(0)
        chai.expect(await db.manager.count()).to.equal(0)
        chai.expect(await db.ticket.count()).to.equal(0)
    })

    it('Should get outlets', async() => {
        let response = await outletHandler()
        let itemNumber = await db.outlets.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get water elements', async() => {
        let response = await waterElementHandler()
        let itemNumber = await db.water_element.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get water element details', async() => {
        let response = await waterElementDetailsHandler()
        let itemNumber = await db.water_element_details.count()
        chai.expect(itemNumber).to.equal(response.length)
    }).timeout(timeout * 1000)

    it('Should get logs', async() => {
        let response = await logsHandler()
        let itemNumber = await db.logs.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get logs history', async() => {
        let response = await logsHistoryHandler()
        let itemNumber = await db.logs_history.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get consumers', async() => {
        let response = await consumerHandler()
        let itemNumber = await db.consumer.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get payments', async() => {
        let response = await paymentHandler()
        let itemNumber = await db.payment.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get zones', async() => {
        let response = await zoneHandler()
        let itemNumber = await db.zone.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get managers', async() => {
        let response = await managerHandler()
        let itemNumber = await db.manager.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should get tickets', async() => {
        let response = await ticketHandler()
        let itemNumber = await db.ticket.count()
        chai.expect(itemNumber).to.equal(response.data.length)
    }).timeout(timeout * 1000)

    it('Should send data to the DB and update IndexedDB value', async () => {
        await db.update_queue.put({
            url:"http://127.0.0.1:8000/api/edit/?",
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: "consumer",
            init:{
                body: "table=consumer&id=11&lastname=Agenorde&firstname=Etienne&gender=M&address=Kafe Mannwal&phone=&subconsumer=5&mainOutlet=39",
                headers: {
                    "Content-type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": getCookie('csrftoken')
                },
                method: "post"
            },
            type:'Edit',
            elemId: 11,
            status:"En attente",
            details:{
                body: "table=consumer&id=11&lastname=Agenorde&firstname=Etienne&gender=M&address=Kafe Mannwal&phone=&subconsumer=5&mainOutlet=39",
                headers: {
                    "Content-type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": getCookie('csrftoken')
                },
                method: "post"
            }
        });
        await sendDataToDB(null, true)
        let data = await db.consumer.where('id').equals(11).first()
        chai.expect(await db.update_queue.count()).to.equal(0)
        chai.expect(data.nom).to.equal("Agenorde")
    }).timeout(1000 * timeout)
})