$(document).ready(function() {
    // Draw the water element table without the managers
    drawLogTable();
});


//Formatting function for row details
function format ( d ) {
    // d is the original data object for the row
    return d.details;
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

async function drawLogTable(){
    $('#flavoured-part').css('background-color', 'red');
    let table = $('#datatable-logs').DataTable(await getLogsTableConfiguration());

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
    requestHandler(url);
}

function acceptModification(elementID){
    let url = '../../api/log/?action=accept&id=' + elementID;
    requestHandler(url);
}

function requestHandler(url){
    var myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        }
    };

    navigator.serviceWorker.ready.then(async swRegistration => {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_table = db.table('update_queue');
        db_table.put({
            url:url,
            init:myInit,
            unsync:true
        });
        return swRegistration.sync.register('updateQueue');
    }).catch(() => {
        fetch(url, myInit).then(() => {
            drawDataTable('logs');
            drawDataTable('logs-history');
        }).catch(err => {
            console.error(this);
            new PNotify({
                title: 'Échec!',
                text: "Opération impossible: " + err,
                type: 'error'
            });
        })
    })
}

async function getLogsTableConfiguration(){
    let config = {
        lengthMenu: [
            [ 10, 25, 50, -1 ],
            [ '10', '25', '50', 'Tout afficher' ]
        ],
        dom: 'Bfrtip',
        buttons: [
            'pageLength'
        ],
        "columns": [
            { "data": "id" },
            { "data": "time" },
            { "data": "type" },
            { "data": "user" },
            { "data": "summary" },
            {
                "className":      'actions',
                "orderable":      false,
                "data":           null,
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
        scrollX:        true,
        scrollCollapse: true,
        paging:         true,
        pagingType: 'full_numbers',
        fixedColumns:   {
            leftColumns: 1,
            rightColumns: 1
        },
        "language": getDataTableFrenchTranslation(),
        "data": await getLogsData(),
        "createdRow": (row, data) => {
            if ( data.sync === false ) {
                console.log('The data: ',data[4]);
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
    return config;
}

function getLogsActionButtonsHTML(){
    return '<div class="center"><a style="cursor:pointer;" class="accept-modification fas fa-check-square"></a>' +
            '&nbsp&nbsp&nbsp&nbsp' + // Non-breaking spaces to avoid clicking on the wrong icon
            '<a style="cursor:pointer;" class="revert-modification far fa-times-circle"></a></div>'
}
