'use strict';
$( document ).ready(function() {

    postMessage({title:'getUsername', username:localStorage.getItem('username')});
    const channel = new BroadcastChannel('sw-messages')


    // Handle offline mode
    if (localStorage.getItem("offlineMode") === null) {
        localStorage.setItem("offlineMode", "false");
        setupOfflineMode(false);
    }
    else if (localStorage.getItem("offlineMode") === "false") setupOfflineMode(false);
    else setupOfflineMode(true);

    // Handle lastUpdate rendering
    if (localStorage.getItem("lastUpdate") !== null && localStorage.getItem("lastUpdate") !== 'null' && localStorage.getItem("lastUpdate") !== 'undefined') $('#last-update').html(localStorage.getItem("lastUpdate"));
    else $('#last-update').html("Pas encore de données");

    // Handle notification rendering
    if (localStorage.getItem("dataToSend") === null) localStorage.setItem("dataToSend", "0");
    setupNotifications(parseInt(localStorage.getItem("dataToSend")));

    // Handle menu rendering
    let localMenu = localStorage.getItem('isMenuOpen');
    let isMenuOpen = (localMenu === 'true' || localMenu === null);
    if(!isMenuOpen){
        $('html').addClass('sidebar-left-collapsed')
    }

    //Toggle menu position on localstorage to save collapsed state
    $('.sidebar-toggle').on('click', function (){
        isMenuOpen = !isMenuOpen;
        localStorage.setItem('isMenuOpen', isMenuOpen.toString());
    });
    $('[data-toggle="tooltip"]').tooltip();

    //Ask for updating all the DB
    $('#db-parent').on('click', () => {
        postMessage({
            title: 'updateDB',
            db: 'all'
        });
    });

    //Ask for changing the utilisation mode
    $('#offline-parent').on('click', () => {
        if (localStorage.getItem("offlineMode") === "false") {
            localStorage.setItem("offlineMode", "true");
            setupOfflineMode(true);
        }
        else {
            localStorage.setItem("offlineMode", "false");
            setupOfflineMode(false);
        }
    });

    //Listener for all the incoming message from SW
    channel.onmessage = event => {
        switch (event.data.title) {
            case 'updateInfos':
                localStorage.setItem("dataToSend", event.data.toPush);
                setupNotifications(event.data.toPush);
                if (event.data.date !== null && event.data.date !== undefined) {
                    localStorage.setItem("lastUpdate", event.data.date.toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23'
                    }));
                    $('#last-update').html(localStorage.getItem("lastUpdate"));
                }
                break
            case 'updateStatus':
                switch (event.data.status) {
                    case 'loaded':
                        if (event.data.date !== null && event.data.date !== undefined) {
                            localStorage.setItem("lastUpdate", event.data.date.toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hourCycle: 'h23'
                            }));
                            $('#last-update').html(localStorage.getItem("lastUpdate"));
                        }
                        new PNotify({
                            title: 'Félicitations !',
                            text: 'Vos données ont bien été chargées localement !',
                            type: 'success'
                        });
                        break
                    case 'failed':
                        new PNotify({
                            title: 'Echec !',
                            text: "Vos données n'ont pas pu être chargée, vérifier votre connexion !",
                            type: 'error'
                        });
                        break
                    case 'loading':
                        new PNotify({
                            title: 'Veuillez patienter',
                            text: 'Vos données sont en cours de chargement !',
                            type: 'info'
                        });
                        break
                }
                break
            case 'toPush':
                localStorage.setItem("dataToSend", event.data.toPush);
                setupNotifications(event.data.toPush);
                let success = event.data.success;
                if (!event.data.silent) {
                    new PNotify({
                        title: success ? 'Réussite !':'Échec !',
                        text: success ? "L'envoi a réussi !" : "L'envoi a échoué ! <br> Vous pouvez réessayer depuis la page - A synchroniser",
                        type: success ? 'success' : 'error'
                    });
                }
                break
            case 'resetNavigation':
                localStorage.setItem('offlineMode', 'false')
                localStorage.setItem('dataToSend', 0)
                localStorage.setItem('lastUpdate', null)
                break
            case 'reloadTable':
                console.log('[THEME]', event.data.table)
                if (event.data.consumerID) drawDataTable(event.data.table, event.data.consumerID)
                else drawDataTable(event.data.table)
                break
        }
    }
});

function postMessage(message) {
    navigator.serviceWorker.ready.then( registration => {
        registration.active.postMessage(message);
    });
}

/**
 * Requests notification computings and modifies the counters to alert the user
 */
function setupNotifications(toPush){
    let notificationList = $('#notification-content');
    let alertBadge = $('#alert-badge');
    let classicBadge = $('#classic-badge');
    notificationList.html('');

    notificationMonthlyReport(notificationList, toPush);

    classicBadge.html(toPush);
    classicBadge.html(toPush);
    alertBadge.html(toPush);

    if (toPush > 0){
        alertBadge.removeClass('hidden');
    }
    else {
        alertBadge.addClass('hidden');
    }
}

/**
 * Adds a monthly report notification if one is waiting
 * @return {boolean} true if a notification has been set, false otherwise
 */
function notificationMonthlyReport(notificationList, toPush){
    if (toPush > 0){
        let title = 'Données non-synchronisées';
        let msg = 'Cliquez pour essayer de synchroniser les données'
        let monthlyReportNotification = formatNotification(title, msg)
        appendNotification(notificationList, monthlyReportNotification);
        return true;
    }
    return false;
}

/**
 * Appends the notification to the list
 * @param  {[type]} notificationList the list to which append the notification
 * @param  {[type]} notification     a notification (use the format for better visuals)
 */
function appendNotification(notificationList, notification){
    let wrappedNotification = '<li>' + notification + '</li>';
    notificationList.append(wrappedNotification);
}

/**
 * Format a notification to keep same visuals
 * @param  {String} title The title (most visible) information
 * @param  {String} msg   Message content
 * @return {String}       The notification with its theme format
 */
function formatNotification(title, msg){
    return '<a href="/modifications/" id="notif-sync" class="clearfix">' +
        '<div class="image">' + // available for a small picture or icon
        '</div>' +
        '<span class="title">'+ title +'</span>' +
        '<span class="message">' + msg + '</span>' +
    '</a>';
}

/**
 * Intro.JS page tour start
 */
function startPageTour(){
    introJs().setOptions({
        nextLabel: 'Suivant',
        prevLabel: 'Précédent',
        skipLabel: 'Passer',
        doneLabel: 'Terminer',
    }).start();
}

function setupOfflineMode(offlineMode){
    let alertOffline = $('#alert-offline');
    let offlineBadge = $('#offline-badge');

    if (offlineMode){
        alertOffline.css('background-color', "#293241");
        $('#flavoured-part').css('background-color', '#8B0000');
        offlineBadge.html("Offline");
        alertOffline.html("X");
    }
    else {
        offlineBadge.html("Online");
        $('#flavoured-part').css('background-color', '#293241');
        alertOffline.html("V");
        alertOffline.css('background-color', "green");
    }
}

function syncData() {
    new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
}