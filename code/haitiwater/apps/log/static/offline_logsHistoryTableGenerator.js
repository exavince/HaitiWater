$(document).ready(function() {
    // Draw the water element table without the managers
    drawLogsHistoryTable();
});


//Formatting function for row details
function format ( d ) {
    // d is the original data object for the row
    return d.details;
}

async function getLogsHistoryData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('logs_history');
    let result = [];
    await table.each(log => {
        result.push(log);
    });

    return result;
}

async function drawLogsHistoryTable(){
    let table = $('#datatable-logs-history').DataTable(await getLogsHistoryTableConfiguration());

    $('#datatable-logs-history tbody').on( 'click', 'tr td:not(:last-child)', function () {
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
    prettifyHeader('logs-history');
}

async function getLogsHistoryTableConfiguration(){
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
            { "data": "action" }
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
        "data": await getLogsHistoryData(),
        "createdRow": (row, data) => {
            if ( data.sync > 0 ) {
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
    return config;
}
