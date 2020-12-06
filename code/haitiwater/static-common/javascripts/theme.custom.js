'use strict';
$( document ).ready(function() {

    //Get local storage value or true (as it is default to be open)
    const channel = new BroadcastChannel('sw-messages');
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

    $('#db-parent').on('click', () => {
        channel.postMessage({
            title:'updateDB',
            db:'all'
        });
    })

    $('#offline-parent').on('click', () => {
        channel.postMessage({
            title: 'setOfflineMode',
        });
    });

    $('[data-toggle="tooltip"]').tooltip();

    channel.onmessage = event => {
        switch (event.data.title) {
            case 'updateInfos':
                setupOfflineMode(event.data.offlineMode);
                setupNotifications(event.data.toPush);
                if (event.data.date !== null && event.data.date !== undefined) {
                    $('#last-update').html(event.data.date.toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23'
                    }));
                }
                break

            case 'getOfflineMode':
                setupOfflineMode(event.data.offlineMode);
                break
            case 'updateStatus':
                switch (event.data.status) {
                    case 'loaded':
                        if (event.data.date !== null && event.data.date !== undefined) {
                            date = event.data.date;
                            $('#last-update').html(date.toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hourCycle: 'h23'
                            }));
                        }
                        new PNotify({
                            title: 'Félicitations !',
                            text: 'Vos données ont bien été chargées localement',
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
                            text: 'Vos données sont en cours de chargement',
                            type: 'info'
                        });
                        break
                }
                break
            case 'toPush':
                setupNotifications(event.data.toPush);
                if (event.data.toPush > 0) {
                    new PNotify({
                        title: 'Attention !',
                        text: "Certaines de vos modifications n'ont pas été envoyées.",
                        type: 'error'
                    });
                } else {
                    new PNotify({
                        title: 'Félicitations !',
                        text: 'Toutes vos modifications ont été envoyées.',
                        type: 'success'
                    });
                }
                break
            case 'resetNavigation':
                break
        }
    }
    channel.postMessage({title:'getInfos', username:localStorage.getItem('username')})
});

/**
 * Requests notification computings and modifies the counters to alert the user
 */
async function setupNotifications(toPush){
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
    return '<a href="#" onclick="syncData()" id="notif-sync" class="clearfix">' +
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
    localStorage.setItem("offlineMode", offlineMode.toString());

    if (offlineMode){
        alertOffline.css('background-color', "red");
        offlineBadge.html("Offline");
        alertOffline.html("X");
    }
    else {
        offlineBadge.html("Online");
        alertOffline.html("V");
        alertOffline.css('background-color', "green");
    }
}

function syncData() {
    new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
}