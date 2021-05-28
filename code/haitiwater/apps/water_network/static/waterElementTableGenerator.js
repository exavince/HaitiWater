
// TODO : offline month selection
async function setWaterDataTableURL(month){
    if (localStorage.getItem("offlineMode") === "true") {
        let table = $('#datatable-water_element');
        table.clear();
        table.rows.add(await getWaterElementData(month));
        table.draw();
    }
    else {
        let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
        let dataURL = baseURL + "/api/table/?name=water_element&month=" + month;
        $('#datatable-water_element').DataTable().ajax.url(dataURL).load();
    }
}

async function drawWaterElementTable(withManagers, withActions, gis){
    let configuration;
    let offline = localStorage.getItem("offlineMode") === "true";
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let dataURL = baseURL + "/api/table/?name=water_element&month=none";

    if (offline) {
        if(gis) configuration = await getWaterDatatableGISOfflineConfiguration(withManagers, withActions);
        else configuration = await getWaterDatatableOfflineConfiguration(withManagers, withActions);
        addLastUpdateToTitle('waterElement');
    }
    else {
        if(gis) configuration = getWaterDatatableGISConfiguration(dataURL, withManagers, withActions);
        else configuration = getWaterDatatableConfiguration(dataURL, withManagers, withActions);
    }

    let table = $('#datatable-water_element').DataTable(configuration);
    let dataTable = $('#datatable-water_element tbody');

    dataTable.on( 'click', 'tr', function () {
        if ( $(this).hasClass('selected') ) $(this).removeClass('selected');
        else {
            table.$('tr.selected').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    dataTable.on( 'click', '.remove-row', function () {
        let data = table.row($(this).closest('tr')).data();
        if (confirm("Voulez-vous supprimer: " + data[1] + ' ' + data[2] + ' ?')) removeElement("water_element", data[0]);
    });

    dataTable.on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        editElement(data);
    });

    attachMonthSelectorHandler();
    prettifyHeader('water_element');
}

function getWaterDatatableConfiguration(dataURL, withManagers, withActions){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7],
                },
            },
            {
                text: 'Volume total',
                attr: {
                    id: 'water-element-month-selector',
                }
            },
            'pageLength',

        ],
        sortable: true,
        processing: true,
        serverSide: true,
        responsive: true,
        autoWidth: true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        columnDefs: [
            {
                targets: -1, // Actions column
                data: null,
                sortable: false,
                defaultContent: getActionButtonsHTML('modalWaterElement'),
            },
            {
                targets: -2, // Zone column
                visible: true,
                defaultContent: 'Pas de zone',

            },
            {
                targets: -3, // Manager column
                defaultContent: 'Pas de gestionnaire',
                visible: withManagers,
            }
        ],
        language: getDataTableFrenchTranslation(),
        ajax: getAjaxController(dataURL),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
        },
        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument
            console.log(json['editable']);
            if (!withActions || !(json.hasOwnProperty('editable') && json['editable'])) {
                $('#datatable-water_element').DataTable().column(-1).visible(false);

            }
        }
    };
}

async function getWaterElementData() {
    try {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let table = db.table('water_element');
        let result = [];

        await table.each(row => {
            result.push([
                row.id,
                row.type,
                row.place,
                row.users,
                row.state,
                row.m3,
                row.gallons,
                row.gestionnaire,
                row.zone_up,
                row.sync
            ]);
        });

        return result;
    } catch (e) {
        console.error('[WATER_NETWORK_getWaterElementData]', e);
        throw e;
    }

}

async function getWaterElementMonthData() {
    try {
        let dexie = await new Dexie('user_db');
        let db = await dexie.open();
        let table = db.table('water_element').where('');
        let result = [];

        await table.each(row => {
            result.push([
                row.id,
                row.type,
                row.place,
                row.users,
                row.state,
                row.m3,
                row.gallons,
                row.gestionnaire,
                row.zone_up,
                row.sync
            ]);
        });

        return result;
    } catch (e) {
        console.error('[WATER_NETWORK_getWaterElementData]', e);
        throw e;
    }

}

async function getWaterDatatableOfflineConfiguration(withManagers, withActions){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7],
                },
            },
            {
                text: 'Volume total',
                attr: {
                    id: 'water-element-month-selector',
                }
            },
            'pageLength',
        ],
        sortable: true,
        processing: true,
        serverSide: false,
        responsive: true,
        autoWidth: true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        columnDefs: [
            {
                targets: -1, // Actions column
                data: null,
                sortable: false,
                defaultContent: getActionButtonsHTML('modalWaterElement'),
            },
            {
                targets: -2, // Zone column
                visible: true,
                defaultContent: 'Pas de zone',

            },
            {
                targets: -3, // Manager column
                defaultContent: 'Pas de gestionnaire',
                visible: withManagers,
            }
        ],
        language: getDataTableFrenchTranslation(),
        data: await getWaterElementData(),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
            if (data[9] > 0) {
                console.log('The data: ', data[4]);
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument
            if (!withActions) {
                $('#datatable-water_element').DataTable().column(-1).visible(false);

            }
        }
    };
}

function getWaterDatatableGISConfiguration(dataURL, withManagers, withActions){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7],
                },
            },
            {
                text: 'Volume total',
                attr: {
                    id: 'water-element-month-selector',
                }
            },
            'pageLength',

        ],
        sortable: true,
        processing: true,
        serverSide: true,
        responsive: true,
        autoWidth: true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        columnDefs: [
            {
                targets: -1, // Actions column
                data: null,
                sortable: false,
                defaultContent: getActionButtonsHTML('modalWaterElement'),
            },
            {
                targets: -2, // Zone column
                visible: true,
                defaultContent: 'Pas de zone',

            },
            {
                targets: -3, // Manager column
                defaultContent: 'Pas de gestionnaire',
                visible: false,
            },
            {
                targets: [3, 4, 5, 6, 7], // User count
                visible: false,
            }
        ],
        language: getDataTableFrenchTranslation(),
        ajax: getAjaxController(dataURL),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
        },
        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument
            console.log(json['editable']);
            if (!withActions || !(json.hasOwnProperty('editable') && json['editable'])) {
                $('#datatable-water_element').DataTable().column(-1).visible(false);

            }
        }
    };
}

async function getWaterDatatableGISOfflineConfiguration(withManagers, withActions){
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
                    columns: [0, 1, 2, 3, 4, 5, 6, 7],
                },
            },
            {
                text: 'Volume total',
                attr: {
                    id: 'water-element-month-selector',
                }
            },
            'pageLength',

        ],
        sortable: true,
        processing: true,
        serverSide: false,
        responsive: true,
        autoWidth: true,
        scrollX: true,
        scrollCollapse: true,
        paging: true,
        pagingType: 'full_numbers',
        fixedColumns: {
            leftColumns: 1,
            rightColumns: 1
        },
        columnDefs: [
            {
                targets: -1, // Actions column
                data: null,
                sortable: false,
                defaultContent: getActionButtonsHTML('modalWaterElement'),
            },
            {
                targets: -2, // Zone column
                visible: true,
                defaultContent: 'Pas de zone',

            },
            {
                targets: -3, // Manager column
                defaultContent: 'Pas de gestionnaire',
                visible: false,
            },
            {
                targets: [3, 4, 5, 6, 7], // User count
                visible: false,
            }
        ],
        language: getDataTableFrenchTranslation(),
        data: await getWaterElementData(),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")) {
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
            if (data[9] > 0) {
                $(row).css('background-color', '#4B0082');
                $(row).css('color', 'white');
            }
        },
        "initComplete": function (settings, json) {
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument

        }
    };
}

// TODO : Month selector for offline mode
function attachMonthSelectorHandler(){
    let button = $('#water-element-month-selector');
    button.datepicker({
        format: "mm-yyyy",
        startView: "months",
        minViewMode: "months",
    });
    button.on('changeDate', async function (e) {
        let month = e.format();
        if (month.length < 1) {
            // Month de-selected
            month = 'none';
            console.log(button);
            button[0].innerText = 'Volume total';
        }
        else {
            button[0].innerText = formatButton(month);
        }
        await setWaterDataTableURL(month);
    });
}

function formatButton(monthYear){
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    let params = monthYear.split("-");
    let yearInt = params[1];
    let monthInt = parseInt(params[0]) - 1;
    return monthNames[monthInt]+ " " + yearInt;
}

