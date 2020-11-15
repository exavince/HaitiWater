async function getConsumerData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('consumer');
    let result = [];

    await table.each(row => {
        result.push([
            row.id,
            row.nom,
            row.prenom,
            row.genre,
            row.adresse,
            row.telephone,
            row.membres,
            row.sortie_eau,
            row.argent_du,
            row.zone,
        ]);
    });

    return result;
}


/**
 * Custom Table Handler
 * Used to prettify the table and make it respond to custom input and commands
 *
 */
async function drawConsumerTable(fullView = true) {
    $('#flavoured-part').css('background-color', 'red');
    let datatable = $('#datatable-consumer');
    let configuration = await getConsumerDatatableConfiguration(fullView);
    datatable.DataTable(configuration);

    let table = datatable.DataTable();
    datatable.find('tbody').on('click', 'tr', function () {
        if ($(this).hasClass('selected')) {
            //$(this).removeClass('selected');
        }
        else {
            table.$('tr.selected').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    datatable.find('tbody').on( 'click', '.remove-row', function () {
        let data = $(this).parents('tr')[0].getElementsByTagName('td');
        if (confirm("Voulez-vous supprimer: " + data[1].innerText + ' ' + data[2].innerText + ' ?')){
            removeElement("consumer", data[0].innerText);
        } else {}
    } );
    datatable.find('tbody').on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        setupModalConsumerEdit(data);
    } );

    prettifyHeader('consumer');

    return table;
}

async function getConsumerDatatableConfiguration(fullView){
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
                    columns: [0,1,2,3,4,5,6,7,8,9],
                },
            },
            'pageLength'
        ],
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
        "columnDefs": [
            {
                targets: [3,4,5,6,7],
                searchable: fullView,
                visible: fullView,
            },
            {
                "targets": -1,
                "data": null,
                "orderable": false,
                "defaultContent": getActionButtonsHTML("modalConsumer"),
            }
        ],
        "language": getDataTableFrenchTranslation(),
        "data": await getConsumerData(),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            if ($("#datatable-consumer th:last-child, #datatable-ajax td:last-child").hasClass("hidden")){
                $('td', row).eq(10).addClass('hidden');
            }
        },

        "initComplete": function(settings, json){
            // Removes the last column (both header and body) if we cannot edit

        }
    };
    return config;
}
