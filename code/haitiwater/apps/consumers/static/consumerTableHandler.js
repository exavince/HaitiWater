/**
 * Custom Table Handler
 * Used to prettify the table and make it respond to custom input and commands
 *
 */
async function drawConsumerTable(fullView = true) {
    let config;

    if (localStorage.getItem("offlineMode") === "true") {
        config = await getConsumerDatatableOfflineConfiguration(fullView);
    }
    else {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=consumer";
        config = getConsumerDatatableConfiguration(dataURL, fullView)
        console.log('[REQUEST DATA]', dataURL);
    }

    let datatable = $('#datatable-consumer');
    datatable.DataTable(config);
    let table = datatable.DataTable();
    setTitle();

    datatable.find('tbody').on('click', 'tr', function () {
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
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
    });

    datatable.find('tbody').on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        setupModalConsumerEdit(data);
    } );

    prettifyHeader('consumer');

    return table;
}

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
            row.sync
        ]);
    });

    return result;
}

async function reloadConsumer() {
    new BroadcastChannel('sw-messages').postMessage({
        title:'updateDB',
        db:'consumer'
    })
    console.log("update consumer")
}

function getConsumerDatatableConfiguration(dataURL, fullView){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                },
            },
            'pageLength'
        ],
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
        "columnDefs": [
            {
                targets: [3, 4, 5, 6, 7],
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
        "ajax": getAjaxController(dataURL),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            if ($("#datatable-consumer th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(10).addClass('hidden');
            }
        },

        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit
            if (!(json.hasOwnProperty('editable') && json['editable'])) {
                $("#datatable-consumer th:last-child, #datatable-ajax td:last-child").addClass("hidden");
                $("#datatable-ajax_wrapper tr:last-child th:last-child").addClass("hidden");
            }
        }
    };
}

async function getConsumerDatatableOfflineConfiguration(fullView){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                },
            },
            'pageLength'
        ],
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
        "columnDefs": [
            {
                targets: [3, 4, 5, 6, 7],
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
            if ($("#datatable-consumer th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(10).addClass('hidden');
            }
            if (data[10] > 0) {
                console.log('The data: ', data[4]);
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
    };
}

async function setTitle() {
    let title = $('#consumer-title')
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('editable');
    table.where('table').equals('consumer').first().then(result => {
        if(result.last_sync !== null && result.last_sync !== undefined && localStorage.getItem('offlineMode') === 'true') {
            title.html("Consommateurs " + ("(" + result.last_sync.toLocaleString('en-GB', {
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

function format (data) {
    let result = ""
    let init = d.init
    let body = init.body
    let infos = body.split('&')

    if (d.table === 'Rapport mensuel') {
        let json = JSON.parse(infos)
        result += "ID élement réseau : " + json.selectedOutlets + "<br>"
        result += "Status : " + (json.isActive ? "Actif" + "<br>" : "Inactif" + "<br>")
        result += "Jours de fonctionnement : " + json.inputDays + "<br>"
        result += "Heures de fonctionnement : " + json.inputHours + "<br>"
        result += "Mois : " + json.month + "<br>"
        let details = json.details[0]
        result += "M³ : " + details.cubic + "<br>"
        result += "Prix M³ : " + details.perCubic + "€" + "<br>"
        result += "Total : " + details.bill + "€" + "<br>"
        return result
    }
    if (d.table === 'Historique') return ''

    infos.forEach(data => {
        let tab = data.split("=")
        switch (tab[0]) {
            case 'table':
                result = result + "Table : " + formatTable(tab[1]) + "<br>"
                break
            case 'id_consumer':
                result = result + "ID du consommateur : " + tab[1] + "<br>"
                break
            case 'id':
                result = result + "ID : " + tab[1] + "<br>"
                break
            case 'amount':
                result = result + "Montant : " + tab[1] + "€" + "<br>"
                break
            case 'lastname':
                result = result + "Nom : " + tab[1] + "<br>"
                break
            case 'firstname':
                result = result + "Prénom : " + tab[1] + "<br>"
                break
            case 'gender':
                result = result + "Genre : " + tab[1] + "<br>"
                break
            case 'address':
                result = result + "Addresse : " + tab[1] + "<br>"
                break
            case 'phone':
                result = result + "Télephone : " + tab[1] + "<br>"
                break
            case 'subconsumer':
                result = result + "Autres consommateurs : " + tab[1] + "<br>"
                break
            case 'mainOutlet':
                result = result + "ID source principale : " + tab[1] + "<br>"
                break
            case 'name':
                result = result + "Nom : " + tab[1] + "<br>"
                break
            case 'fountain-price':
                result = result + "Prix de la fontaine : " + tab[1] + "<br>"
                break
            case 'fountain-duration':
                result = result + "Durée de la fontaine : " + tab[1] + "<br>"
                break
            case 'kiosk-price':
                result = result + "Prix du kiosque : " + tab[1] + "<br>"
                break
            case 'kiosk-duration':
                result = result + "Durée du kiosque : " + tab[1] + "<br>"
                break
            case 'indiv-price':
                result = result + "Prix individuel : " + tab[1] + "<br>"
                break
            case 'type':
                result = result + "Type de problème : " + tab[1] + "<br>"
                break
            case 'urgency':
                result = result + "Urgence : " + tab[1] + "<br>"
                break
            case 'id_outlet':
                result = result + "ID de la source : " + tab[1] + "<br>"
                break
            case 'comment':
                result = result + "Commentaire : " + tab[1] + "<br>"
                break
            case 'state':
                result = result + "Status : " + tab[1] + "<br>"
                break
            case 'picture':
                break
            case 'localization':
                result = result + "Localisation : " + tab[1] + "<br>"
                break
            default:
                result = result + tab[0] + " : " + tab[1] + "<br>"
                break
        }
    })

    return result
}
