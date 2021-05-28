$(document).ready(function() {
    drawLogTable();
});

function format(d) {
    return d.details;
}

async function drawLogTable() {
    let config;
    let offline = localStorage.getItem("offlineMode") === "true";

    if (offline) {
        config = await getLogsTableOfflineConfiguration();
        addLastUpdateToTitle('logs');
    }
    else  {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=logs";
        config = getLogsTableConfiguration(dataURL);
    }

    let table = $('#datatable-logs').DataTable(config);
    let logsTable = $('#datatable-logs tbody');

    logsTable.on( 'click', 'tr td:not(:last-child)', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);

        if (row.child.isShown()) {
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            row.child( format(row.data()) ).show();
            tr.addClass('shown');
        }
    });

    logsTable.on( 'click', '.revert-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        revertModification(data.id);
    });

    logsTable.on( 'click', '.accept-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        acceptModification(data.id);
    });

    prettifyHeader('logs');
}

function revertModification(elementID){
    let url = '../../api/log/?action=revert&id=' + elementID;
    requestHandler(url, elementID, 'Annuler');
}

function acceptModification(elementID){
    let url = '../../api/log/?action=accept&id=' + elementID;
    requestHandler(url, elementID,'Accepter');
}

async function requestHandler(url, elementID, type){
    var myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body:'',
    };

    try {
        await navigator.serviceWorker.ready;
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_table = db.table('update_queue');
        db_table.put({
            url:url,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: 'Logs',
            init:myInit,
            type:type,
            elemId: elementID,
            status:"En attente",
            details:myInit
        });

        indexedDBModify('logs', elementID);
        postMessage({title:'pushData'});
        console.log('[LOGS_requestHandler]', type + ' ' + elementID);
    } catch (e) {
        console.error('[LOGS_requestHandler]', e);
        try {
            let networkResponse = await fetch(url, myInit);
            if (networkResponse.ok) {
                new PNotify({
                    title: 'Succès!',
                    text: 'Élément supprimé avec succès',
                    type: 'success'
                });
                console.error('[LOGS_requestHandler]', type + ' ' + elementID + ' without SW');
            } else {
                new PNotify({
                    title: 'Échec!',
                    text: 'Veuillez vérifier votre connexion.',
                    type: 'error'
                });
                console.error('[LOGS_requestHandler]', networkResponse.statusText);
            }
        } catch (e) {
            console.error('[LOGS_requestHandler]', e);
        }
    }

    await drawDataTable('logs');
    await drawDataTable('logs_history');
}

async function getLogsData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('logs');
    let result = [];

    await table.each(log => {
        result.push(log);
    });

    return result;
}

function getLogsTableConfiguration(dataURL){
    return {
        lengthMenu: [
            [10, 25, 50, -1],
            ['10', '25', '50', 'Tout afficher']
        ],
        dom: 'Bfrtip',
        buttons: [
            'pageLength'
        ],
        "columns": [
            {"data": "id"},
            {"data": "time"},
            {"data": "type"},
            {"data": "user"},
            {"data": "summary"},
            {
                "className": 'actions',
                "orderable": false,
                "data": null,
                "defaultContent": getLogsActionButtonsHTML()
            }
        ],
        "order": [[1, 'asc']],
        "searching": false,
        "sortable": true,
        "processing": true,
        "serverSide": true,
        "responsive": true,
        "autoWidth": true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        "language": getDataTableFrenchTranslation(),
        "ajax": {
            url: dataURL
        }
    };
}

async function getLogsTableOfflineConfiguration(){
    return {
        lengthMenu: [
            [10, 25, 50, -1],
            ['10', '25', '50', 'Tout afficher']
        ],
        dom: 'Bfrtip',
        buttons: [
            'pageLength'
        ],
        "columns": [
            {"data": "id"},
            {"data": "time"},
            {"data": "type"},
            {"data": "user"},
            {"data": "summary"},
            {
                "className": 'actions',
                "orderable": false,
                "data": null,
                "defaultContent": getLogsActionButtonsHTML()
            }
        ],
        "order": [[1, 'asc']],
        "searching": false,
        "sortable": true,
        "processing": true,
        "serverSide": false,
        "responsive": true,
        "autoWidth": true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        "language": getDataTableFrenchTranslation(),
        "data": await getLogsData(),
        "createdRow": (row, data) => {
            if (data.sync > 0) {
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
}

function getLogsActionButtonsHTML(){
    return '<div class="center"><a style="cursor:pointer;" class="accept-modification fas fa-check-square"></a>' +
            '&nbsp&nbsp&nbsp&nbsp' + // Non-breaking spaces to avoid clicking on the wrong icon
            '<a style="cursor:pointer;" class="revert-modification far fa-times-circle"></a></div>'
}

function postMessage(message) {
    navigator.serviceWorker.ready.then( registration => {
        registration.active.postMessage(message);
    });
}