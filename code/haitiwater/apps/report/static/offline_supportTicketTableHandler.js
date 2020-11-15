async function getData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('ticket');
    let result = [];

    await table.each(row => {
        result.push([
            row.id,
            row.urgence,
            row.emplacement,
            row.type,
            row.commentaire,
            row.statut,
            row.photo,
        ]);
    });

    return result;
}

async function drawTicketTable(){
    $('#flavoured-part').css('background-color', 'red');
    let configuration;
    configuration = await getTicketDatatableConfiguration();
    $('#datatable-ticket').DataTable(configuration);

    $('#datatable-ticket tbody').on( 'click', '.remove-row', function () {
        let data = $(this).parents('tr')[0].getElementsByTagName('td');
        if (confirm("Voulez-vous supprimer: " + data[1].innerText + ' ' + data[2].innerText + ' ?')){
            removeElement("ticket", data[0].innerText);
        } else {}
    } );
    $('#datatable-ticket tbody').on( 'click', '.edit-row', function () {
        let data = $(this).parents('tr')[0].getElementsByTagName('td');
        editElement(data);
    } );
    prettifyHeader('ticket');
}

async function getTicketDatatableConfiguration(dataURL){
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
                    columns: [0,1,2,3,4,5,6,7],
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
        "columnDefs": [
            {
                "targets": -1,
                "data": null,
                "orderable": false,
                "defaultContent": getActionButtonsHTML('modalProblemReport'),
            },
            ],
        "language": getDataTableFrenchTranslation(),
        "data": await getData(),

        //Callbacks on fetched data
        "createdRow": function (row, data, index, cells) {
            let path = data[6];
            if (path !== null){
                let imageURL = '../static' + path;
                let commentDom = $('td', row).eq(4);
                let comment = commentDom.text();

                commentDom.html('<i class="far fa-image clickable" title="Cliquez pour voir l\'image"></i>&nbsp' + comment);
                commentDom.on('click', function(){
                    $.magnificPopup.open({
                        type: 'image',
                        items: {
                        src: imageURL
                        },
                    });
                })
            }
        }
    };

    return config;
}
