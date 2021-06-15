$(document).ready(function() {
    drawLogsHistoryTable();
});

//Formatting function for row details
function format(d) {
    return d.details;
}

async function drawLogsHistoryTable() {
    let config;
    let offline = localStorage.getItem("offlineMode") === "true";

    if (offline) {
        config = await getLogsHistoryTableOfflineConfiguration();
        addLastUpdateToTitle('logsHistory');
    }
    else {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=logs_history";
        config = getLogsHistoryTableConfiguration(dataURL);
    }

    let table = $('#datatable-logs-history').DataTable(config);

    $('#datatable-logs-history tbody').on( 'click', 'tr td:not(:last-child)', function () {
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

    prettifyHeader('logs-history');
}

async function getLogsHistoryData() {
    try {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let table = db.table('logs_history');
        let result = [];
        await table.each(log => {
            result.push(log);
        });

        return result;
    } catch (e) {
        console.error('[LOGS_getLogsHistoryData]', e);
    }
}

async function getLogsHistoryTableOfflineConfiguration(){
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
            {"data": "action"}
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
        "data": await getLogsHistoryData(),
        "createdRow": (row, data) => {
            if (data.sync > 0) {
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
}

function getLogsHistoryTableConfiguration(dataURL){
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
            {"data": "action"}
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
        "ajax": getAjaxController(dataURL),
    };
}
