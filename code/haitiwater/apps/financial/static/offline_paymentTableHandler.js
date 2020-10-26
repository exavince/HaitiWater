async function getPaymentData(userID) {
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
        ]);
    });

    return result;
}

async function drawPaymentTable(userID) {

    let datatable = $('#datatable-payment');

    let configuration = await getPaymentDatatableConfiguration(userID);
    let table = datatable.DataTable(configuration);

    datatable.find('tbody').on( 'click', '.remove-row', function () {
        let data = table.row($(this).closest('tr')).data();
        if (confirm("Voulez-vous supprimer: " + data[0] + ' ?')) {
            let consumerIdParameter = '&id_consumer=' + $('#input-payment-id-consumer');
            removeElement("payment", data[0], consumerIdParameter );
        } else {}
    } );
    datatable.find('tbody').on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        setupModalPaymentEdit(data);
    } );

    prettifyHeader('payment');

    return table;
}

async function getPaymentDatatableConfiguration(userID){
    let config = {
        lengthMenu: [
            [ 10, 25, 50, -1 ],
            [ '10', '25', '50', 'Tout afficher' ]
        ],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'print',
                exportOptions: {
                    columns: [0,1,2],
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
        scrollX:        true,
        scrollCollapse: true,
        paging:         true,
        pagingType: 'full_numbers',
        "language": getDataTableFrenchTranslation(),
        "data": getPaymentData(userID),
        "initComplete": function(settings, json){
            // Removes the last column (both header and body) if we cannot edit

        },
    };
    return config;
}
