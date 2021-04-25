$(document).ready(function() {
    // Draw the water element table without the managers
    drawTosyncTable();
});


//Formatting function for row details
function format (d) {
    return d.details
}

async function getTosyncData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('update_queue');
    let result = [];
    await table.each(data => {
        result.push(formatRender(data));
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

async function sendAllData() {
    new BroadcastChannel("sw-message").postMessage({
        title:"pushData",
        id: null
    })
}

function formatRender(data) {
    let init = data.init
    let body = init.body
    let json = {}

    switch (data.table) {
        case 'Logs':
            data.table = 'Historique'
            data.details = ""
            break
        case 'zone':
            data.table = 'Zone'
            json = urlToJSON(body)
            data.details = 'ID de la zone : ' + json.id + '<br>' +
                'Nom de la zone : ' + json.name + '<br>' +
                'Fontaines : ' + json.fountain_price + ' gourdes tous les ' + json.fountain_duration + ' mois' + '<br>' +
                'Kiosques : ' + json.kiosk_price + ' gourdes tous les ' + json.kiosk_duration + ' mois' + '<br>' +
                'Prises individuelles : ' + json.indiv_price + ' gourdes tous les mois';
            break
        case 'consumer':
            data.table = 'Consommateur'
            json = urlToJSON(body)
            data.details = 'ID du consommateur : ' + json.id + '<br>' +
                'Nom : ' + json.lastname + '<br>' +
                'Prénom : ' + json.firstname + '<br>' +
                'Genre : ' + (json.gender === 'F' ? 'Femme' : 'Homme') + '<br>' +
                'Adresse : ' + json.address + '<br>' +
                'Telephone : ' + json.phone + '<br>' +
                'Consommateurs additionnels : ' + json.subconsumer + '<br>' +
                "ID sortie d'eau principale : " + json.mainOutlet
            break
        case 'manager':
            data.table = 'Gestionnaire'
            json = urlToJSON(body)
            data.details = 'Pseudonyme : ' + json.id + '<br>' +
                'Nom : ' + json.lastname + '<br>' +
                'Prenom : ' + json.firstname + '<br>' +
                'Courriel : ' + json.email + '<br>' +
                'Telephone : ' + json.phone + '<br>' +
                'Fonction : ' + (json.type === 'fountain-manager' ? 'Gestionnaire de fontaine' : 'Gestionnaire de kiosque') + '<br>' +
                'ID de la zone : ' + (json.zone === 'none' ? 'Pas de zone' : json.zone) + '<br>' +
                'ID des sources : ' + (json.outlets === 'none' ? 'Pas de sources' : json.outlets)
            break
        case 'payment':
            data.table = 'Paiement'
            json = urlToJSON(body)
            data.details = 'ID du paiement : ' + json.id + '<br>' +
                'ID du consommateur : ' + json.id_consumer + '<br>' +
                'Montant : ' + json.amout
            break
        case 'water_element':
            data.table = 'Element du réseau'
            json = urlToJSON(body)
            data.details = "ID de l'élement réseau : " + json.id + '<br>' +
                'Type : ' + (json.type === 'fountain' ? 'Fontaine' : 'Kiosque') + '<br>' +
                'Description : ' + json.localization + '<br>' +
                'Status : ' + (json.state === 'ok' ? 'En service' : (json.state === 'repair' ? 'Nécessite réparation' : 'Hors service'))
            break
        case 'MonthlyReport':
            data.table = 'Rapport mensuel'
            json = JSON.parse(body)
            let details = json.details[0]
            data.details = "ID élement réseau : " + json.selectedOutlets + "<br>" +
                "Status : " + (json.isActive ? "Actif" + "<br>" : "Inactif" + "<br>") +
                "Jours de fonctionnement : " + json.inputDays + "<br>" +
                "Heures de fonctionnement : " + json.inputHours + "<br>" +
                "Mois : " + json.month + "<br>" +
                "M³ : " + details.cubic + "<br>" +
                "Prix M³ : " + details.perCubic + "€" + "<br>" +
                "Total : " + details.bill + "€"
            break
        case 'IssueTable':
            data.table = 'Ticket'
            json = urlToJSON(body)
            data.details = 'ID du ticket : ' + json.id + '<br>' +
                'Type de probleme : ' + (json.type === 'mechanical' ? 'Mécanique' : (json.type === 'quality' ? 'Qualité' : 'Autre')) + '<br>' +
                "Niveau d'urgence : " + (json.urgency === 'high' ? 'Haute' : (json.urgency === 'medium' ? 'Moyen' : 'Bas')) + '<br>' +
                'ID élement concerné : ' + json.id_outlet + '<br>' +
                'Description : ' + json.comment + '<br>' +
                'Status : ' + (json.state === 'unresolved' ? 'Non résolu' : 'Résolu')
            break
    }
    return data
}

function urlToJSON(url) {
    let json = {}
    url.split('&').forEach(info => {
        let temp = info.split('=')
        switch (temp[0]) {
            case 'id':
                json.id = temp[1]
                break
            case 'name':
                json.name = temp[1]
                break
            case 'fountain-price':
                json.fountain_price = temp[1]
                break
            case 'fountain-duration':
                json.fountain_duration = temp[1]
                break
            case 'kiosk-price':
                json.kiosk_price = temp[1]
                break
            case 'kiosk-duration':
                json.kiosk_duration = temp[1]
                break
            case 'indiv-price':
                json.indiv_price = temp[1]
                break
            case 'lastname':
                json.lastname = temp[1]
                break
            case 'firstname':
                json.firstname = temp[1]
                break
            case 'gender':
                json.gender = temp[1]
                break
            case 'address':
                json.address = temp[1]
                break
            case 'phone':
                json.phone = temp[1]
                break
            case 'subconsumer':
                json.subconsumer = temp[1]
                break
            case 'mainOutlet':
                json.mainOutlet = temp[1]
                break
            case 'email':
                json.email = temp[1]
                break
            case 'type':
                json.type = temp[1]
                break
            case 'zone':
                json.zone = temp[1]
                break
            case 'outlets':
                json.outlets = temp[1]
                break
            case 'id_consumer':
                json.id_consumer = temp[1]
                break
            case 'amount':
                json.amout = temp[1]
                break
            case 'localization':
                json.localization = temp[1]
                break
            case 'state':
                json.state = temp[1]
                break
            case 'urgency':
                json.urgency = temp[1]
                break
            case 'id_outlet':
                json.id_outlet = temp[1]
                break
            case 'comment':
                json.comment = temp[1]
                break
        }
    })

    return json
}