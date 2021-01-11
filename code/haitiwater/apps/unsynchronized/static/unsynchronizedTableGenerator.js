$(document).ready(function() {
    // Draw the water element table without the managers
    drawTosyncTable();
});


//Formatting function for row details
function format ( d ) {
    // d is the original data object for the row
    return d.details.url;
}

async function getTosyncData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('update_queue');
    let result = [];
    await table.each(log => {
        result.push(log);
    });

    return result;
}

async function drawTosyncTable(){
    let table = $('#datatable-tosync').DataTable(await getTosyncTableConfiguration());

    $('#datatable-tosync tbody').on( 'click', 'tr td:not(:last-child)', function () {
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

    $('#datatable-tosync tbody').on( 'click', '.revert-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        revertModification(data.id);
    } );
    $('#datatable-tosync tbody').on( 'click', '.accept-modification', function () {
        let data = table.row($(this).closest('tr')).data();
        acceptModification(data.id);
    } );
    prettifyHeader('logs');
}

function revertModification(elementID){
    new BroadcastChannel('sw-messages').postMessage({
        title:'revertModification',
        id:elementID
    })
}

function acceptModification(elementID){
    new BroadcastChannel('sw-messages').postMessage({
        title:'acceptModification',
        id:elementID
    })
}

async function getTosyncTableConfiguration(){
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
            { "data": "date" },
            { "data": "table" },
            { "data": "type" },
            { "data": "elemId" },
            { "data": "status" },
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
        "data": await getTosyncData()
    };
    return config;
}

function getLogsActionButtonsHTML(){
    return '<div class="center"><a style="cursor:pointer;" class="accept-modification fas fa-check-square"></a>' +
            '&nbsp&nbsp&nbsp&nbsp' + // Non-breaking spaces to avoid clicking on the wrong icon
            '<a style="cursor:pointer;" class="revert-modification far fa-times-circle"></a></div>'
}
