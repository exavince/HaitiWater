/**
 * Hide all the error messages from start.
 * It is better to hide them than to append HTML with JS
 */
window.onload = function() {
    let buttons = document.getElementsByClassName("error"),
        len = buttons !== null ? buttons.length : 0,
        i = 0;
    for(i; i < len; i++) {
        buttons[i].className += " hidden";
    }
};

function getAjaxController(dataURL){
    return ({
        url: dataURL,
        error: function (xhr, error, thrown) {
            if(xhr.status === 200) { return; } //301
            console.log(xhr);
            console.log(error + '\n' + thrown);
            $('#datatable-ajax_wrapper').hide();
            new PNotify({
                title: 'Échec du téléchargement!',
                text: "Veuillez passer en mode Hors-ligne.",
                type: 'failure',
            });
        }
    });
}

function editElement(data){
    if(data){
        setupModalEdit(data);
    } else {
        new PNotify({
            title: 'Échec!',
            text: "L'élément ne peut être récupéré (tableHandler.js)",
            type: 'error'
        });
    }
}

async function drawDataTable(tableName, consumerID){
    let table = $('#datatable-' + tableName).DataTable();
    console.log('[DRAW_DATA_TABLE]', tableName)

    if (localStorage.getItem("offlineMode") === "true") {
        try {
            let data;
            switch (tableName) {
                case 'payment':
                    await drawDataTable('consumer');
                    data = await getPaymentData(parseInt(consumerID));
                    break;
                case 'consumer':
                    data = await getConsumerData();
                    break;
                case 'zone':
                    data = await getZoneData();
                    break;
                case 'ticket':
                    data = await getTicketData();
                    break;
                case 'manager':
                    data = await getManagerData();
                    break;
                case 'water_element':
                    data = await getWaterElementData();
                    break;
                case 'tosync':
                    data = await getTosyncData();
                    break;
                case 'logs':
                    data = await getLogsData();
                    break;
                default:
                    data = null;
                    return
            }
            table.clear();
            table.rows.add(data);
            table.draw();
            return;
        } catch (err) {
            console.log('[DRAW_DATA_TABLE]', err)
            return;
        }
    }
    if (tableName === 'tosync') {
        let data = await getTosyncData();
        table.clear();
        table.rows.add(data);
        table.draw();
        return;
    }
    console.log("ajax");
    table.ajax.reload();
    table.draw();
}

/**
 * Request the removal of element # id in table
 * @param table a String containing the table name
 * @param id an integer corresponding to the primary key of the element to remove
 * @param otherParameters
 */
async function removeElement(table, id, otherParameters) {
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let postURL = baseURL + "/api/remove/";
    if (typeof otherParameters === 'undefined') { otherParameters = ''; }
    let myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body: "table=" + table + "&id=" + id + otherParameters
    };
    console.log('[DELETE]', myInit)

    try {
        await navigator.serviceWorker.ready
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_queue = db.table('update_queue');

        db_queue.put({
            url:postURL,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: table,
            init:myInit,
            type:'Supprimer',
            elemId: id,
            status:"En attente",
            details:myInit
        });

        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
        await indexDBModify(table, id);
    } catch (e) {
        try {
            let networkResponse = fetch(postURL, myInit)
            if(networkResponse.ok) {
                new PNotify({
                    title: 'Succès!',
                    text: 'Élément supprimé avec succès',
                    type: 'success'
                });
            }
            else {
                console.log('[DELETE]', networkResponse.statusText);
                new PNotify({
                    title: 'Échec!',
                    text: 'Veuillez vérifier votre connexion.',
                    type: 'error'
                });
            }
        } catch (err) {
            console.log('[DELETE]', err);
            new PNotify({
                title: 'Échec!',
                text: 'Veuillez vérifier votre connexion.',
                type: 'error'
            });
        }
    }

    if (table === 'payment') {
        let consumerID = otherParameters.split("&").filter(entry => entry.includes('id_consumer='))[0].replace("id_consumer=", "");
        console.log("Consumer ID : " + consumerID);
        await drawDataTable(table, parseInt(consumerID));
    }
    else await drawDataTable(table);
}

/**
 *
 * @returns {string} containing edit and remove buttons HTML code
 */
function getActionButtonsHTML(modalName){
    return '<div class="center"><a href="#'+ modalName + '" class="modal-with-form edit-row fa fa-pen" title="Editer"></a>' +
            '&nbsp&nbsp&nbsp&nbsp' + // Non-breaking spaces to avoid clicking on the wrong icon
            '<a style="cursor:pointer;" class="on-default remove-row fa fa-trash" title="Supprimer"></a></div>'
}

function hideFormErrorMsg(table){
    $('#form-' + table + '-error').addClass('hidden');
}

/**
 * Add placeholder and CSS class in the search field
 */
function prettifyHeader(tableName){
    let searchField = $('#datatable-' + tableName + '_filter');
    searchField.find('input').addClass("form-control");
    searchField.find('input').attr("placeholder", "Recherche");

    let wrapper = $('#datatable-'+ tableName + '_wrapper');
    let buttons = wrapper.find('.dt-buttons');

    buttons.addClass('hidden');
    buttons.find('.buttons-print').addClass('hidden');

    // Link the custom print button to the DataTable one (hidden)
    let print = wrapper.find('.buttons-print');
    $('#print-' + tableName).on('click', function(){
        print.trigger('click');
    });

    wrapper.find('.buttons-page-length');
    $('#' + tableName + '-options').on('click', function(){
        (buttons.hasClass('hidden') ? buttons.removeClass('hidden') : buttons.addClass('hidden'))
    })

}

function getRequest(table){
    console.log('[TABLE]', table);
    switch(table){
        case 'manager':
            return validateManagerForm();
        case 'zone':
            return validateZoneForm();
        case 'payment':
            return validatePaymentForm();
        default:
            return validateForm();
    }
}

/**
 * Send a post request to server and handle it
 */
async function postNewRow(table, callback){
    let request = getRequest(table);
    if(!request){
        console.log('[ADD]', "invalid form");
        return false;
    }
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let postURL = baseURL + "/api/add/";
    let myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body: request
    };
    beforeModalRequest();
    console.log('[ADD]', myInit);

    try {
        await navigator.serviceWorker.ready
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_table = db.table('update_queue');

        db_table.put({
            url:postURL,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: table,
            init:myInit,
            type:'Ajouter',
            elemId: '?',
            status:"En attente",
            details:myInit
        });

        document.getElementById("form-" + table + "-error").className = "alert alert-danger hidden"; // hide old msg
        if (table === 'payment') {
            let rowID = request.split("&").filter(entry => entry.includes('id_consumer='))[0].replace("id_consumer=", "");
            indexDBModify('payment', rowID, true)
        }
        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
    } catch (e) {
        try {
            let networkResponse = await fetch(postURL, myInit)
            if(networkResponse.ok) {
                document.getElementById("form-" + table + "-error").className = "alert alert-danger hidden"; // hide old msg
                dismissModal();
                new PNotify({
                    title: 'Succès!',
                    text: 'Élément ajouté avec succès',
                    type: 'success'
                });
            }
            else {
                document.getElementById("form-" + table + "-error").className = "alert alert-danger";
                document.getElementById("form-" + table + "-error-msg").innerHTML = networkResponse.statusText;
                new PNotify({
                    title: 'Échec!',
                    text: 'Veuillez vérifier votre connexion.',
                    type: 'error'
                });
            }
        } catch (err) {
            document.getElementById("form-" + table + "-error").className = "alert alert-danger";
            document.getElementById("form-" + table + "-error-msg").innerHTML = err;
            new PNotify({
                title: 'Échec!',
                text: 'Veuillez vérifier votre connexion.',
                type: 'error'
            });
        }
    }

    dismissModal();
    afterModalRequest();
}

/**
 * Send a post request to server and handle it
 */
async function postEditRow(table, callback){
    let request = getRequest(table);
    if(!request) return false;
    let rowID = request.split("&").filter(entry => entry.includes('id='))[0].replace("id=", "");
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let postURL = baseURL + "/api/edit/?";
    let myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body: request
    };
    beforeModalRequest();
    console.log('[EDIT]', myInit);

    try {
        await navigator.serviceWorker.ready
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_table = db.table('update_queue');
        db_table.put({
            url:postURL,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: table,
            init:myInit,
            type:'Editer',
            elemId: rowID,
            status:'En attente',
            details:myInit
        });

        document.getElementById("form-" + table + "-error").className = "alert alert-danger hidden"; // hide old msg
        indexDBModify(table, rowID);
        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
    } catch (e) {
        try {
            let networkResponse = await fetch(postURL,myInit)
            if (!networkResponse.ok) {
                console.log("POST error on new element");
                document.getElementById("form-" + table + "-error").className = "alert alert-danger";
                document.getElementById("form-" + table + "-error-msg").innerHTML = await networkResponse.statusText;
                new PNotify({
                    title: 'Échec!',
                    text: 'Veuillez vérifier votre connexion.',
                    type: 'error'
                });
            }
            else {
                document.getElementById("form-" + table + "-error").className = "alert alert-danger hidden"; // hide old msg
                new PNotify({
                    title: 'Succès!',
                    text: 'Élément édité avec succès',
                    type: 'success'
                });
            }
        }  catch (err) {
            console.log('[EDIT]',"POST error on new element");
            document.getElementById("form-" + table + "-error").className = "alert alert-danger";
            document.getElementById("form-" + table + "-error-msg").innerHTML = err;
            new PNotify({
                title: 'Échec!',
                text: 'Veuillez vérifier votre connexion.',
                type: 'error'
            });
        }
    }

    dismissModal();
    afterModalRequest();
    if (table === 'payment') {
        let consumerID = request.split("&").filter(entry => entry.includes('id_consumer='))[0].replace("id_consumer=", "");
        await drawDataTable(table, parseInt(consumerID));
    }
    else await drawDataTable(table);
}

/**
 * French translation of DataTable functions
 * @returns config object
 */
function getDataTableFrenchTranslation(){
    return {
        "sProcessing": "Chargement...",
        "sSearch": "",
        "sLengthMenu": "_MENU_ &eacute;l&eacute;ments",
        "sInfo": "", //"Affichage de l'&eacute;lement _START_ &agrave; _END_ sur _TOTAL_ &eacute;l&eacute;ments",
        "sInfoEmpty": "Affichage de l'&eacute;lement 0 &agrave; 0 sur 0 &eacute;l&eacute;ments",
        "sInfoFiltered": "(filtr&eacute; de _MAX_ &eacute;l&eacute;ments au total)",
        "sInfoPostFix": "",
        "sLoadingRecords": "Chargement en cours...",
        "sZeroRecords": "Aucun &eacute;l&eacute;ment &agrave; afficher",
        "sEmptyTable": "Aucune donn&eacute;e disponible dans le tableau",
        "oPaginate": {
            "sFirst": '<i class="fas fa-angle-double-left fa-lg"></i>',
            "sPrevious": '<i class="fas fa-angle-left fa-lg"></i>',
            "sNext": '<i class="fas fa-angle-right fa-lg"></i>',
            "sLast": '<i class="fas fa-angle-double-right fa-lg"></i>'
        },
        "oAria": {
            "sSortAscending": ": activer pour trier la colonne par ordre croissant",
            "sSortDescending": ": activer pour trier la colonne par ordre d&eacute;croissant"
        },
        buttons: {
            pageLength: {
                _: "Afficher %d éléments <i class='fas fa-angle-down'></i>",
                '-1': "Tout afficher <i class='fas fa-angle-down'></i>"
            }
        },
    }
}

/**
 * Executed before a send. Acts as a modal lock to prevent multi-sending and let user know it's loading
 */
function beforeModalRequest(){
    //Disable the button to avoid multiple send and put loading spinner
    let button = $('.modal-confirm');
    if (button.is('li')){ // Wizard Modal
        button.addClass('disabled');
    } else { // Classic modal
        button.prop('disabled', true);
    }
    button.append('<i class="loader fas fa-spinner fa-spin"></i>');
    button.addClass('loading');
}

/**
 * Restore modal to origin state
 */
function afterModalRequest(){
    let button = $('.modal-confirm');
    if (button.is('li')){ // Wizard Modal
        button.removeClass('disabled');
    } else { // Classic modal
        button.prop('disabled', false);
    }
    button.find('.loader').remove();
}

/**
 * Get the value of
 * @param cookieName a cookie
 * @returns {string} the value
 */
function getCookie(cookieName)
{
    if (document.cookie.length > 0)
    {
        let cookieStart = document.cookie.indexOf(cookieName + "=");
        if (cookieStart !== -1)
        {
            cookieStart = cookieStart + cookieName.length + 1;
            let cookieEnd = document.cookie.indexOf(";", cookieStart);
            if (cookieEnd === -1) cookieEnd = document.cookie.length;
            return unescape(document.cookie.substring(cookieStart,cookieEnd));
        }
    }
    return "";
}

/**
 * Set a new URL for a datatable, useful for live changes of DataTable URL logic
 * @param table the table name
 * @param optional additional parameters
 */
function setTableURL(table, optional){
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let dataURL = baseURL + "/api/table/?name=" + table + optional;
    $('#datatable-'+table).DataTable().ajax.url(dataURL).load();
}

async function indexDBModify(table, rowID, isAdd = false) {
    try {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        console.log("[IDB_MODIFY]", table);
        switch (table) {
            case "payment":
                if (isAdd) {
                    console.log('[IDB_MODIFY]', rowID)
                    await db.table('consumer').where('id').equals(parseInt(rowID)).modify(data => {
                        data.sync += 1;
                    });
                } else {
                    let consumerID = undefined;
                    await db.table('payment').where('id').equals(parseInt(rowID)).modify(data => {
                        data.sync += 1;
                        consumerID = data.user_id;
                    });
                    await db.table('consumer').where('id').equals(consumerID).modify(data => {
                        data.sync += 1;
                    });
                }
                break;
            case "manager":
                db.table(table).where('id').equals(rowID).modify(data => {
                    data.sync += 1;
                });
                break;
            default:
                db.table(table).where('id').equals(parseInt(rowID)).modify(data => {
                    data.sync += 1;
                });
                break;
        }
    } catch (e) {
        consolo.log('[INDEX_DB_MODIFY]', e);
    }
}

async function reloadTable(table) {
    new BroadcastChannel('sw-messages').postMessage({
        title:'updateDB',
        db:table
    })
    console.log('[RELOAD_TABLE]',table)
}

async function addLastUpdateToTitle(tableName) {
    try {
        let title = $('#' + tableName + '-title')
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let table = db.table('editable');
        table.where('table').equals(tableName).first().then(result => {
            if(result.last_sync !== null && result.last_sync !== undefined && localStorage.getItem('offlineMode') === 'true') {
                title.append("   " + result.last_sync.toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23'
                }).fontsize(2))
            }
        })
    } catch (e) {
        console.log('[LAST_UPDATE_TITLE]', e);
    }
}