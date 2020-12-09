async function drawPaymentTable(userID) {
    let config;

    if (localStorage.getItem("offlineMode") === "true") {
        config = await getPaymentDatatableOfflineConfiguration(userID);
    }
    else {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=payment&user=none";
        console.log('[REQUEST_DATA]', dataURL);
        config = getPaymentDatatableConfiguration(dataURL);
    }

    let datatable = $('#datatable-payment');
    let table = datatable.DataTable(config);

    datatable.find('tbody').on( 'click', '.remove-row', async function () {
        let data = table.row($(this).closest('tr')).data();
        if (confirm("Voulez-vous supprimer: " + data[0] + ' ?')){
            let consumerIdParameter = '&id_consumer=' + $('#input-payment-id-consumer');
            await removeElement("payment", data[0], consumerIdParameter );
            redrawPayment(table, data[5]);
        } else {}
    } );
    datatable.find('tbody').on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        setupModalPaymentEdit(data);
        redrawPayment(table, data[5]);
    } );

    prettifyHeader('payment');
}

async function redrawPayment(datatable, consumerID) {
    datatable.clear();
    let data = await  getPaymentData(consumerID);
    console.log(data);
    await datatable.rows.add(data);
    datatable.draw();
}

async function getPaymentData(userID) {
    if (userID === null) {
        return [];
    }
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('payment');
    let result = [];
    let users = await table.where('user_id').equals(userID);
    await users.each(user => {
        result.push([
            user.id,
            user.data,
            user.value,
            user.source,
            user.sync,
            user.user_id
        ]);
    });

    return result;
}

function getPaymentDatatableConfiguration(dataURL){
    return {
        lengthMenu: [
            [10, 25, 50, -1],
            ['10', '25', '50', 'Tout afficher']
        ],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'print',
                exportOptions: {
                    columns: [0, 1, 2],
                },
            },
            'pageLength'
        ],
        "columnDefs": [
            {
                "targets": -1,
                "data": null,
                "orderable": false,
                "defaultContent": getActionButtonsHTML("modal-payment"),
            }
        ],
        "sortable": true,
        "processing": false,
        "serverSide": true,
        "responsive": true,
        "autoWidth": true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        "language": getDataTableFrenchTranslation(),
        "ajax": getAjaxController(dataURL),
        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit
            if (json.hasOwnProperty('editable') && !json['editable']) {
                $('#datatable-payment').DataTable().column(-1).visible(false);

            }
        },
    };
}


async function getPaymentDatatableOfflineConfiguration(userID){
    return {
        lengthMenu: [
            [10, 25, 50, -1],
            ['10', '25', '50', 'Tout afficher']
        ],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'print',
                exportOptions: {
                    columns: [0, 1, 2],
                },
            },
            'pageLength'
        ],
        "columnDefs": [
            {
                "targets": -1,
                "data": null,
                "orderable": false,
                "defaultContent": getActionButtonsHTML("modal-payment"),
            }
        ],
        "sortable": true,
        "processing": false,
        "serverSide": false,
        "responsive": true,
        "autoWidth": true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        "language": getDataTableFrenchTranslation(),
        "data": getPaymentData(userID),
        "createdRow": (row, data) => {
            if (data[4] > 0) {
                console.log('The data: ', data[4]);
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
}

