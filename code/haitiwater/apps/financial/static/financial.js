let paymentTable = 'undefined';
let user = 'undefined';

$(document).ready(function() {
    // Draw DataTables
    drawZoneTable().then(zoneTable => {
        drawConsumerTable(false).then(consumerTable => {
                attachHandlers(zoneTable, consumerTable);
        })
    })
});


/**
 * Attach the handlers for onclick navigation
 * @param zoneTable to attach event to
 * @param consumerTable to attach event to
 */
function attachHandlers(zoneTable, consumerTable){
    $('#datatable-consumer').first('tbody').on('click', 'tr td:not(:last-child)', async function(){
        $('#consumer-payment-details').removeClass('hidden');
        await consumerDetails(consumerTable.row($(this).closest('tr')).data());
    });

    $('#datatable-zone').first('tbody').on('click', 'tr td:not(:last-child)', function(){
        let row = ($(this).closest('tr'));
        filterConsumersFromZone(zoneTable);
    });
}

/**
 * Automatically fill the field on the manager table from the selected zone
 * (Takes the data from the first tr.selected)
 *
 * @param zoneTable the table zone datatable object
 */
function filterConsumersFromZone(zoneTable){
    let data = zoneTable.row('tr.selected').data();
    let consumerTable = $('#datatable-consumer').DataTable();
    if  (data == null){ // If nothing selected
        consumerTable.search("").draw();
        return;
    }
    let zoneName = data[1];
    consumerTable.search(zoneName).draw();

}

/**
 * Setup the consumer details window
 * @param data the datatable row
 */
async function consumerDetails(data){
    user = data[0];
    let userID = data[0];
    if (paymentTable === 'undefined') {
        paymentTable = drawPaymentTable(null);
    }

    if (localStorage.getItem("offlineMode") === "true") {
        await getPaymentData(userID).then(result => {
            $('#datatable-payment').DataTable().clear();
            $('#datatable-payment').DataTable().rows.add(result).draw();
        });
    }
    else {
        setTableURL('payment', '&user=' + userID);
        drawDataTable('payment');
    }

    $('#input-payment-id-consumer').val(userID);

    let userName = data[1] + " " + data[2];
    $('.consumer-name-details').html(userName);

    await requestFinancialDetails(userID);

    $('#consumer-details-id').html(data[0]);
    $('#consumer-details-lastname').html(data[1]);
    $('#consumer-details-firstname').html(data[2]);
    $('#consumer-details-gender').html(data[3]);
    $('#consumer-details-address').html(data[4]);
    $('#consumer-details-phone').html(data[5]);
    $('#consumer-details-subconsumers').html(data[6]);
    $('#consumer-details-outlet').html(data[7]);
}

/**
 * Ask the server for financial details on a given user
 * @param userID the user ID
 * @return {object} the data
 */
async function requestFinancialDetails(userID) {
    if (localStorage.getItem("offlineMode") === "true") {
        let financialDetails = await getConsumerDetailsData(userID);
        $('#consumer-details-amount-due').html('(HTG) ' + financialDetails[1]);
        $('#consumer-details-next-bill').html(financialDetails[2]);
    }
    else {
        let requestURL = "../api/details?table=payment&id=" + userID;
        let xhttp = new XMLHttpRequest();

        xhttp.onreadystatechange = function(){
            if (this.readyState === 4) {
                if (this.status === 200) {
                    let financialDetails = JSON.parse(this.response);
                    $('#consumer-details-amount-due').html('(HTG) ' + financialDetails.amount_due);
                    $('#consumer-details-next-bill').html(financialDetails.validity);
                }
                else{
                    console.error(this);
                    new PNotify({
                        title: 'Échec du téléchargement',
                        text: "Impossible de récupérer les détails financiers de l'utilisateur.",
                        type: 'warning'
                    })
                }
            }
        };

        xhttp.open('GET', requestURL, true);
        xhttp.send();
    }
}

function refreshFinancialDetails() {
    requestFinancialDetails($('#input-payment-id-consumer').val());
}

async function getConsumerDetailsData(userID) {
    if (userID === null) {
        return [];
    }
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('consumer');
    let result = [];
    let users = await table.where("id").equals(userID);
    await users.each(user => {
        result.push(
        user.id,
        user.argent_du,
        user.validity,
        )
    });

    return result;
}