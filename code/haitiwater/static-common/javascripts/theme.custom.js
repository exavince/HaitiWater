'use strict';
$( document ).ready(function() {

    //Get local storage value or true (as it is default to be open)
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

    const channel = new BroadcastChannel('sw-messages');
    if(localStorage.getItem('offlineMode') === null) {
        localStorage.setItem('offlineMode', 'false');
    }

    channel.onmessage = event => {
        if (event.data.title === 'updateIndexDB') {
            if (event.data.date !== null) {
                date = event.data.date;
                $('#last-update').html(
                    date.day.toString() + "-" +
                    date.month.toString() + "-" +
                    date.year.toString() + "  " +
                    date.hours.toString() + ":" +
                    date.minutes.toString()
                );
            }
        }
    }

    setupNotifications();
    setupOfflineMode(channel);

});

/**
 * Requests notification computings and modifies the counters to alert the user
 */
function setupNotifications(){
    let notificationList = $('#notification-content');
    let alertBadge = $('#alert-badge');
    let classicBadge = $('#classic-badge');

    let notificationCounter = 0;
    if (notificationMonthlyReport(notificationList)) notificationCounter += 1;

    classicBadge.html(notificationCounter);
    alertBadge.html(notificationCounter);

    if (notificationCounter > 0){
        alertBadge.removeClass('hidden');
    }
    else {
        alertBadge.addClass('hidden');
    }

}

function setupOfflineMode(channel){
    let offlineParent = $('#offline-parent');
    let alertOffline = $('#alert-offline');
    let offlineBadge = $('#offline-badge');

    if (localStorage.getItem('offlineMode') === 'true'){
        alertOffline.css('background-color', "red");
        offlineBadge.html("Offline");
        alertOffline.html("X");
        $('#flavoured-part').css('background-color', 'red');
    }
    else {
        offlineBadge.html("Online");
        alertOffline.html("V");
        alertOffline.css('background-color', "green");
        $('flavoured-part').css('background-color', '#293241');
    }

    offlineParent.on('click', () => {
        if (localStorage.getItem('offlineMode') === 'false'){
            localStorage.setItem('offlineMode', 'true');
            alertOffline.css('background-color', "red");
            offlineBadge.html("Offline");
            alertOffline.html("X");
        }
        else {
            localStorage.setItem('offlineMode', 'false');
            offlineBadge.html("Online");
            alertOffline.html("V");
            alertOffline.css('background-color', "green");
        }
        channel.postMessage({
            title: 'navigationMode',
            offlineMode: localStorage.getItem('offlineMode'),
        });
        channel.postMessage({
            title: 'updatedDB',
        });

    });

    channel.postMessage({
            title: 'updatedDB',
        });
}

/**
 * Adds a monthly report notification if one is waiting
 * @return {boolean} true if a notification has been set, false otherwise
 */
function notificationMonthlyReport(notificationList){
    let hasMonthlyReport = (localStorage.getItem('monthlyReport') !== null);
    if (hasMonthlyReport){
        let title = 'Rapport en attente';
        let msg = 'Un rapport est en attente, visitez la page des rapports pour l\'envoyer.'
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
    return '<a href="../rapport" class="clearfix">' +
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
