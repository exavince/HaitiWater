$(document).ready(function() {
    // Draw the water element table without the managers
    drawTosyncTable();
});

function formatTable(table) {
    switch (table) {
        case 'Logs':
            return 'Historique'
        case 'zone':
            return 'Zone'
        case 'consumer':
            return 'Consommateur'
        case 'manager':
            return 'Gestionnaire'
        case 'payment':
            return 'Payement'
        case 'ticket':
            return 'Ticket'
        case 'water_element':
            return 'Element réseau'
        case 'MonthlyReport':
            return 'Rapport mensuel'
        case 'IssueTable':
            return 'Ticket'
        default:
            return table
        }
}


//Formatting function for row details
function format (d) {
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

async function getTosyncData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('update_queue');
    let result = [];
    await table.each(log => {
        log.table = formatTable(log.table)
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
    prettifyHeader('tosync');
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
