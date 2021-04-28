let MAP_CENTER = new L.latLng(18.579916, -72.294903); // Port-au-Prince airport

// Frequently accessed page elements
let gisMap = 'undefined';
let waterElementTable = 'undefined';
let detailTable = 'undefined';
let latLongDetail = 'undefined';
let errorDetailTable = 'undefined';
let drawLayer = 'undefined';

// Current element selection shared variables
let currentElementType = 'undefined';
let currentElementAddress = 'undefined';
let currentElementID = 'undefined';
let geoData = 'undefined';


$(document).ready(function() {
    //Setup water tables first
    drawWaterElementTable(false, true, true).then(() => {
        waterElementTable = $("#datatable-water_element").DataTable();
        detailTable = $("#detail-table");
        errorDetailTable = $('#error-detail-table');
        latLongDetail = $('#element-details-lat-lon');

        //Request details on element click
        $('#datatable-water_element tbody').on( 'click', 'tr', function () {
            let data = waterElementTable.row(this).data();
            requestWaterElementDetails(data[0]);
        });

        //Init Leaflet map
        waterGISInit(
            L.map('map-water-network',
            {
                zoomControl: false //Set as fale to instantiate custom zoom control
            })
        );

        displayDetailTableError('Sélectionnez un élément du réseau dans la table ou sur la carte.');
        if(localStorage.getItem('mapDrawer')!=='closed'){
            toggleDrawer();
        }

        //Populate map with known elements
        requestAllElementsPosition();
        });
});

/**
 * Populates the Leaflet map with the positions from the server
 */
function waterGISPopulate(elementPosition){
    if( !elementPosition ){
        // Request failed
        return; //Maybe hide map, or use cached data, update as needed
    }
    for(let id in elementPosition){
        let tooltip = elementPosition[id][0];
        let geoJSON = jQuery.parseJSON(elementPosition[id][1]);

        let drawElement = L.geoJSON(geoJSON).addTo(drawLayer);
        drawElement.id = id;
        drawElement.bindTooltip(tooltip, {
            sticky:true
        });
        drawElement.on('click', function(e){
            console.log(drawElement.id)
            requestWaterElementDetails(drawElement.id);
        });
    }
}

async function getGisData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('water_element_details');

    let geoData = {}

    await table.each(element => {
        geoData[element.id.toString()] = [element.localization, element.geoJSON]
    })

    return geoData
}


/**
 * Request all known element positions from the server
 * @return {[JSONArray]} [The positions as a list of GeoJSON]
 */
function requestAllElementsPosition(){
    if (localStorage.getItem("offlineMode") === "true") {
       getGisData().then(data => {
           waterGISPopulate(data)
       })
    }
    else {
        let requestURL = "../api/gis?marker=all";
        fetch(requestURL).then(networkResponse => networkResponse.json()
            .then(result => {
                waterGISPopulate(result)
            })
        ).catch(err => {
            console.log(err);
            new PNotify({
                title: 'Erreur',
                text: 'Les positions ne peuvent être téléchargées',
                type: 'error'
            });
            waterGISPopulate(false);
        })
    }
}

/**
 * Initialize the water element GIS map
 * @param  {[L.map]} map [An instantiated leaflet map]
 */
function waterGISInit(map) {
    gisMap = map;
    // Set map center to haiti
    map.setView(MAP_CENTER, 8);

    // Custom zoom control to allow french language
    L.control.zoom({
        position:'topleft',
        zoomInTitle:'Agrandir',
        zoomOutTitle:'Réduire',
    }).addTo(map);

    // Open Street maps layer
    let osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let osm = L.tileLayer(osmUrl, {maxZoom: 18, attribution: 'Open Street Maps' });

    // Google sattelite layer
    let googleUrl = 'https://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}';
    let google = L.tileLayer(googleUrl, {attribution: 'Google'});

    // Draw layer
    let waterElement = L.featureGroup().addTo(map);
    drawLayer = waterElement;

    // Setup layers
    L.control.layers(
        { // Base layers
            'Carte': osm.addTo(map), // default layer
            'Sattelite': google
        },
        { // Overlays
            'Réseau': waterElement
        },
        { // Options
            position: 'topleft',
            collapsed: false
        }).addTo(map);

    // Control to collapse details panel
    map.addControl(new drawerControl());
}

/**
 * The drawer control is displayed on the map to expand/retract the details panel
 * @type {L.Control}
 */
var drawerControl = L.Control.extend({
    options: {
        position: 'topright'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar clickable leaflet-drawer-control fas fa-question');
        container.style.backgroundColor = 'white';
        container.style.width = '35px';
        container.style.height = '35px';
        container.style.paddingLeft = '9px';
        container.style.paddingTop = '5px';
        container.onclick = function(){
            toggleDrawer();
        };
        return container;
    }

});

/**
 * Toggle the detail drawer
 */
function toggleDrawer(){
    let mapContainer = $('#map-container');
    let controlContainer = $('.leaflet-drawer-control');

    if (mapContainer.hasClass('col-md-8')){
        localStorage.setItem('mapDrawer','closed'); // Local storage to retain drawer position
        mapContainer.removeClass('col-md-8');
        mapContainer.addClass('col-md-12');
        controlContainer.addClass('fa-question');
        controlContainer.removeClass('fa-times');
    }
    else {
        localStorage.removeItem('mapDrawer');
        mapContainer.addClass('col-md-8');
        mapContainer.removeClass('col-md-12');
        controlContainer.removeClass('fa-question');
        controlContainer.addClass('fa-times');

    }
    $('#details').collapse('toggle');
}

async function getWaterElementDetailsData(elementID) {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('water_element_details');
    let result = await table.where('id').equals(parseInt(elementID)).first();
    console.log(result);
    return result;
}

/**
 * Requests the details of an element to the server
 * @param  {int} elementID
 */
function requestWaterElementDetails(elementID){
    if (localStorage.getItem('offlineMode') === 'true') {
        getWaterElementDetailsData(elementID).then(result => {
            setupWaterElementDetails(result);
        });
    }
    else {
        let requestURL = "../api/details?table=water_element&id="+elementID;
        fetch(requestURL).then(networkResponse => networkResponse.json()
            .then(result => {
                setupWaterElementDetails(result)
            })
        ).catch(err => {
            console.log(err)
            let msg = "Une erreur est survenue:<br>" + networkReponse.status + ": " + err;
            displayDetailTableError(msg);
        })
    }
}

function displayDetailTableError(errorMsg){
    errorDetailTable.html(errorMsg);
    return setupWaterElementDetails(false);
}

/**
 * Setup the display for the selected element details
 * @param  {JSON} response The element details
 */
function setupWaterElementDetails(response){
    if (!response){
        detailTable.addClass('hidden');
        errorDetailTable.removeClass('hidden');
        return;
    }
    detailTable.removeClass('hidden');
    errorDetailTable.addClass('hidden');

    $("#element-details-id").html(response.id);
    $("#element-details-type").html(response.type);
    $("#element-details-localization").html(response.localization);
    $("#element-details-manager").html(response.manager);
    $("#element-details-users").html(response.users);
    $("#element-details-state").html(response.state);
    $("#element-details-current-month-cubic").html(response.currentMonthCubic);
    $("#element-details-average-month-cubic").html(response.averageMonthCubic);
    $("#element-details-total-cubic").html(response.totalCubic);


    currentElementID = response.id;
    currentElementType = response.type;
    currentElementAddress = response.localization;

    let hasLocalization = response.geoJSON !== null;

    let latLongDetail = $("#element-details-lat-lon");
    if (hasLocalization){
        let draw = jQuery.parseJSON(response.geoJSON);
        let latlng;
        if (!isMarker(response.type)){
            latLongDetail.html('Pas affichable');
            latlng = L.latLng(draw.geometry.coordinates[0][1], draw.geometry.coordinates[0][0]);
        } else {
            latlng = L.latLng(draw.geometry.coordinates[1], draw.geometry.coordinates[0]);
            latLongDetail.html(latlng.lat + "," + latlng.lng);
        }
        gisMap.flyTo(latlng);
    } else {
        latLongDetail.html('N/A');
    }
    readyMapDrawButtons(response.type, hasLocalization);
}

/**
 * Display the buttons accordingly
 * @param  {string}  type        type of the water element
 * @param  {Boolean} hasPosition true if the element already is on the map
 */
function readyMapDrawButtons(type, hasPosition){
    resetMapDrawButtons();
    let drawButton = $('#button-draw');
    let editButton = $('#button-edit');
    let removeButton = $('#button-remove');

    //You can only create non-existing positions, or edit/delete existing ones
    drawButton.prop('disabled', hasPosition);
    editButton.prop('disabled', !isMarker(type) || hasPosition);
    removeButton.prop('disabled', !hasPosition);

    //Attach the handlers
    if(!hasPosition){
        drawButton.on('click', drawHandler);
        editButton.on('click', editHandler);
    } else {
        removeButton.on('click', removeHandler)
    }
}

function resetMapDrawButtons(){
    let map = gisMap;
    let drawButton = $('#button-draw');
    let editButton = $('#button-edit');
    let removeButton = $('#button-remove');

    map.off(L.Draw.Event.CREATED, saveDraw);
    drawButton.off();
    editButton.off();
    removeButton.off();
}

/**
 * Handles a click on the draw button
 * @param  {Event} e the click event
 */
function drawHandler( e ){
    let type = currentElementType;
    let map = gisMap;
    let drawer;
    if( isMarker(type) ){
        drawer = new L.Draw.Marker(map);
    }
    else if ( isLine(type) ){
        drawer = new L.Draw.Polyline(map);
    }
    else {
        console.log("Implement further options if required");
        // A polygon for zones would be a good example
    }
    drawer.enable();
    map.on(L.Draw.Event.CREATED,saveDraw);
}

/**
 * Allow to create a point by its coordinates
 * @param e button click event
 */
function editHandler( e ){
    let input = prompt('Entrez les coordonnées du point à ajouter:\n'
                        + 'Formats acceptés:\n'
                        + 'DMS (e.g.: 50°06\'41.5\"N 4°57\'46.2\"E)\n'
                        + 'DD (e.g.: 50.111528, 4.962827)\n'
                        + 'UTM (e.g.: 31:U, 640339.54, 5552875.82)'

                );
    if (input == null) return;
    let inputArray = input.split(',');

    let coords = undefined;
    console.log(inputArray);
    try {
        if (inputArray.length < 3){
            // Bi-coord system (DMS, DD)
            coords = parseCoordinates(input);
        } else {
            // Tri-coord system (UTM)
            coords = parseUTM(inputArray[0], inputArray[1], inputArray[2]);
        }
    }catch(e){
        alert('Coordonnées illisibles: '+e.toString());
        return;
    }

    if(!isValidCoordinate(coords)){
        alert('Coordonnées invalides');
        return;
    }

    let position = {
        type: "Feature",
        properties:{
            name: currentElementType + " " + currentElementAddress
        },
        geometry: {
            type: "Point",
            coordinates: [coords.lon, coords.lat]
        }
    };

    let marker = L.geoJSON(position).addTo(drawLayer);
    marker.bindTooltip(currentElementType + " " + currentElementAddress, {
        sticky:true
    });
    marker.on('click', function(e){
       requestWaterElementDetails(currentElementID)
    });
    let draw = marker.toGeoJSON().features[0];
    let latlng = L.latLng(draw.geometry.coordinates[1], draw.geometry.coordinates[0]);
    gisMap.flyTo(latlng);
    marker.id = currentElementID;
    sendDrawToServer(draw); //Default type is collection (feature array)
    readyMapDrawButtons(currentElementType, true);
    latLongDetail.html(coords.lat + "," + coords.lon);
}

/**
 * Save a draw on the layer and send it to server
 * @param  {L.Draw.CREATED} event
 */
function saveDraw(event){
    // Save it on the map
    let layer = event.layer;
    layer.bindTooltip(currentElementType + " " + currentElementAddress, {
        sticky:true
    });

    if (!isMarker(currentElementType)){
        latLongDetail.html('Pas affichable');
    } else {
        let coords = layer.toGeoJSON().geometry.coordinates;
        latLongDetail.html(coords[1] + "," + coords[0]);
    }

    layer.id = currentElementID;
    layer.on('click', function(e){
        requestWaterElementDetails(layer.id);
    });
    drawLayer.addLayer(layer);

    // Save it on the server
    sendDrawToServer(layer.toGeoJSON());
    readyMapDrawButtons(currentElementType, true);
}

/**
 * Save a position on the server
 * @param  {GeoJSON} geoJSON of the object to save
 */
function sendDrawToServer(geoJSON){
    let requestURL = "../api/gis/?action=add&id=" + currentElementID;
    let myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/json",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body: JSON.stringify(geoJSON)
    };

    navigator.serviceWorker.ready.then(async () => {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_queue = db.table('update_queue');
        db_queue.put({
            url:requestURL,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: 'Carte',
            init:myInit,
            type:'Modifier',
            elemId: currentElementID,
            status:"En attente",
            details:myInit
        });

        new PNotify({
            title: 'Succès!',
            text: 'Votre demande de modification est bien enregitrée. Les changements seront validés une fois de retour en ligne.',
            type: 'success'
        })

        await indexDBModify('water_element', currentElementID);
        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
    }).catch(() => {
        fetch(postURL, myInit)
            .then(response => {
                if(response.ok) {
                    new PNotify({
                        title: 'Succès!',
                        text: 'Élément ajouté avec succès',
                        type: 'success'
                    });
                } else {
                    let msg = "Une erreur est survenue:<br>" + response.status + ": " + response.statusText;
                    errorDetailTable.html(msg);
                }
            })
            .catch(err => {
                let msg = "Une erreur est survenue:<br>" + response.status + ": " + err;
                errorDetailTable.html(msg);
            })
    });
}

function removeHandler(e){
    let requestURL = "../api/gis/?action=remove&id=" + currentElementID;
    let myInit = {
        method: 'post',
        headers: {
            'X-CSRFToken':getCookie('csrftoken')
        },
    };

    navigator.serviceWorker.ready.then(async () => {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let db_queue = db.table('update_queue');
        db_queue.put({
            url:requestURL,
            date: new Date().toLocaleString('en-GB', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }),
            table: 'Carte',
            init:myInit,
            type:'Supprimer',
            elemId: currentElementID,
            status:"En attente",
            details:myInit
        });

        new PNotify({
            title: 'Succès!',
            text: 'Votre demande de suppression est bien enregitrée. Les changements seront validés une fois de retour en ligne.',
            type: 'success'
        })

        drawLayer.eachLayer(function (draw) {
            console.log(draw);
            if (draw.id === currentElementID) {
                drawLayer.removeLayer(draw);
                $('#element-details-lat-lon').html("N/A");
            }
        });
        readyMapDrawButtons(currentElementType, false);

        await indexDBModify('water_element', currentElementID);
        new BroadcastChannel('sw-messages').postMessage({title:'pushData'});
    }).catch(() => {
        fetch(postURL, myInit)
            .then(response => {
                if(response.ok) {
                    new PNotify({
                        title: 'Succès!',
                        text: 'Élément supprimé avec succès',
                        type: 'success'
                    });
                    drawLayer.eachLayer(function (draw) {
                        console.log(draw);
                        if (draw.id === currentElementID) {
                            drawLayer.removeLayer(draw);
                            $('#element-details-lat-lon').html("N/A");
                        }
                    });
                    readyMapDrawButtons(currentElementType, false);
                } else {
                    new PNotify({
                    title: 'Erreur',
                    text: "L'élément ne peut être supprimé: " + response.statusText,
                    type: 'error'
                });
                }
            })
            .catch(err => {
                new PNotify({
                    title: 'Erreur',
                    text: "L'élément ne peut être supprimé: " + err,
                    type: 'error'
                });
            })
    });




    xhttp.onreadystatechange = function(){
        if (this.readyState === 4) {
            if (this.status === 200) {
                drawLayer.eachLayer(function (draw) {
                    console.log(draw);
                    if (draw.id === currentElementID) {
                        drawLayer.removeLayer(draw);
                        $('#element-details-lat-lon').html("N/A");
                    }
                });
                readyMapDrawButtons(currentElementType, false);
            } else {
                new PNotify({
                    title: 'Erreur',
                    text: "L'élément ne peut être supprimé: " + this.statusText,
                    type: 'error'
                });
                return this;
            }
        }
    };

}

function isMarker(type){
    let markerElements = ['fontaine', 'kiosque', 'prise individuelle', 'source', 'réservoir'];
    return markerElements.indexOf(type.toLowerCase()) > -1;
}

function isLine(type){
    let lineElements = ['conduite'];
    return lineElements.indexOf(type.toLowerCase()) > -1;
}

function startPageTour(){
    if (!$('#details').hasClass('in')){
        console.log("collapsed");
        toggleDrawer();
    }
    let intro = introJs();
    intro.setOptions({
        nextLabel: 'Suivant',
        prevLabel: 'Précédent',
        skipLabel: 'Passer',
        doneLabel: 'Terminer',
        steps: [
            {
                element: document.getElementById('map-container'),
                position: "bottom",
                intro: "Voici une carte interactive. Vous pouvez visualiser les données de l'application géographiquement"
            },
            {
                element: document.querySelector('.leaflet-left'),
                position: "right",
                intro: "Vous pouvez zoomer sur la carte (aussi avec la molette de la souris), modifier le type de vue et afficher ou masquer le réseau."
            },
            {
                element: document.querySelector('.leaflet-right'),
                position: "left",
                intro: "Déroulez le panneau de détails pour en apprendre plus sur une fontaine et la placer sur la carte (manuellement ou via ses coordonnées)"
            },
            {
                element: document.getElementById('button-draw'),
                position: "left",
                intro: "Placez l'élément manuellement sur la carte.",
            },
            {
                element: document.getElementById('button-edit'),
                position: "left",
                intro: "Placez l'élément à l'aide de ses coordonnées géographiques.",
            },
            {
                element: document.getElementById('button-remove'),
                position: "left",
                intro: "Supprimez la position géographique de l'élément.",
            },
        ].filter(function(obj) { return $(obj.element).length; }) // Only show step if element exists (multi-menu)
    });
    intro.start();
}
