$(document).ready(function() {
    // Draw the water element table without the managers
    drawLogTable();
});


//Formatting function for row details
function format ( d ) {
    // d is the original data object for the row
    return d.details;
}

async function drawLogTable() {
    let config;
    if (localStorage.getItem("offlineMode") === "true") {
        $('#flavoured-part').css('background-color', '#8B0000');
        config = await getLogsTableOfflineConfiguration();
    }
    else  {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=logs";
        console.log("[REQUEST DATA]" ,dataURL);
        config = getLogsTableConfiguration(dataURL);
    }

    let table = $('#datatable-logs').DataTable(config);
    setTitleLogs()
    setTitleLogsHistory()

    $('#datatable-logs tbody').on( 'click', 'tr td:not(:last-child)', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);

        if (row.child.isShown()) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            // Open this row
            row.child( format(row.data()) ).show();
            tr.addClass('shown');
        }
    });

    $('#datatable-logs tbody').on( 'click', '.revert-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        revertModification(data.id);
    } );
    $('#datatable-logs tbody').on( 'click', '.accept-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        acceptModification(data.id);
    } );
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

    await navigator.serviceWorker.ready.then(async () => {
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
        new PNotify({
            title: 'Réussite!',
            text: "Demande enregistrée",
            type: 'success'
        });

        indexDBModify('logs', elementID);
        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
    }).catch(() => {
        fetch(url, myInit).then(() => {
            new PNotify({
                title: 'Réussite!',
                text: "Modification acceptée",
                type: 'success'
            });
        }).catch(err => {
            console.error(this);
            new PNotify({
                title: 'Échec!',
                text: "Opération impossible: " + err,
                type: 'error'
            });
        })
    });
    await drawDataTable(table);
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

async function setTitleLogs() {
    let title = $('#logs-title')
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('editable');
    table.where('table').equals('logs').first().then(result => {
        if(result.last_sync !== null && result.last_sync !== undefined && localStorage.getItem('offlineMode') === 'true') {
            title.html("Actions effectuées " + ("(" + result.last_sync.toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }) + ")").fontsize(2)
            )
        }
    })
}

async function setTitleLogsHistory() {
    let title = $('#logsHistory-title')
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('editable');
    table.where('table').equals('logs_history').first().then(result => {
        if(result.last_sync !== null && result.last_sync !== undefined && localStorage.getItem('offlineMode') === 'true') {
            title.html("Actions effectuées " + ("(" + result.last_sync.toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }) + ")").fontsize(2)
            )
        }
    })
}

async function reloadLogs() {
    new BroadcastChannel('sw-messages').postMessage({
        title:'updateDB',
        db:'logs'
    })
    console.log("update consumer")
}