async function getData() {
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
        ]);
    });

    return result;
}

function setWaterDataTableURL(month){
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let dataURL = baseURL + "/api/table/?name=water_element&month=" + month;
    $('#datatable-water_element').DataTable().data(getData());
}

async function drawWaterElementTable(withManagers, withActions, gis){
    let configuration;

    if(gis){
        configuration = await getWaterDatatableGISConfiguration(withManagers, withActions);
    }
    else {
        configuration = await getWaterDatatableConfiguration(withManagers, withActions);
    }
    console.log(configuration);

    $('#datatable-water_element').DataTable(configuration);

    let table = $('#datatable-water_element').DataTable();
    $('#datatable-water_element tbody').on( 'click', 'tr', function () {
        if ( $(this).hasClass('selected') ) {
            $(this).removeClass('selected');
        }
        else {
            table.$('tr.selected').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    $('#datatable-water_element tbody').on( 'click', '.remove-row', function () {
        let data = table.row($(this).closest('tr')).data();
        if (confirm("Voulez-vous supprimer: " + data[1] + ' ' + data[2] + ' ?')){
            removeElement("water_element", data[0]);
        } else {}
    } );
    $('#datatable-water_element tbody').on( 'click', '.edit-row', function () {
        let data = table.row($(this).closest('tr')).data();
        editElement(data);
    } );

    await attachMonthSelectorHandler();
    prettifyHeader('water_element');
}

async function getWaterDatatableConfiguration(withManagers, withActions){
    let config = {
        lengthMenu: [
            [ 10, 25, 50, -1 ],
            [ '10', '25', '50', 'Tout afficher' ]
        ],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'print',
                exportOptions: {
                    columns: [0,1,2,3,4,5,6,7],
                },
            },
            {
                text: 'Volume total',
                attr:{
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
        scrollX:        true,
        scrollCollapse: true,
        paging:         true,
        pagingType: 'full_numbers',
        fixedColumns:   {
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
        data: await getData(),

        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")){
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
        },
        "initComplete": function(settings, json){
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument
            if(!withActions){
                $('#datatable-water_element').DataTable().column(-1).visible(false);

            }
        }
    };
    return config;
}

async function getWaterDatatableGISConfiguration(withManagers, withActions){
    let config = {
        lengthMenu: [
            [ 10, 25, 50, -1 ],
            [ '10', '25', '50', 'Tout afficher' ]
        ],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'print',
                exportOptions: {
                    columns: [0,1,2,3,4,5,6,7],
                },
            },
            {
                text: 'Volume total',
                attr:{
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
        scrollX:        true,
        scrollCollapse: true,
        paging:         true,
        pagingType: 'full_numbers',
        fixedColumns:   {
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
                targets: [3,4,5,6,7], // User count
                visible: false,
            }
            ],
        language: getDataTableFrenchTranslation(),
        data: await getData(),
        //Callbacks on fetched data
        "createdRow": function (row, data, index) {
            $('td', row).eq(5).addClass('text-center');
            $('td', row).eq(6).addClass('text-center');
            //Hide actions if column hidden
            if ($("#datatable-water_element th:last-child, #datatable-ajax td:last-child").hasClass("hidden")){
                $('td', row).eq(8).addClass('hidden');
            }
            if (withManagers) {
                $('td', row).eq(7).addClass('text-center');
            }
        },
        "initComplete": function(settings, json){
            // Removes the last column (both header and body) if we cannot edit or if required by withAction argument
            if(!withActions){
                $('#datatable-water_element').DataTable().column(-1).visible(false);

            }
        }
    };
    return config;
}

function attachMonthSelectorHandler(){
    console.log("attach month handler");
    let button = $('#water-element-month-selector');
    button.datepicker({
        format: "mm-yyyy",
        startView: "months",
        minViewMode: "months",
    });
    button.on('changeDate', function (e) {
        console.log("click");
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
        setWaterDataTableURL(month);
    });
}

function formatButton(monthYear){
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    let params = monthYear.split("-");
    let yearInt = params[1];
    let monthInt = parseInt(params[0]) - 1;
    return monthNames[monthInt]+ " " + yearInt;
}
