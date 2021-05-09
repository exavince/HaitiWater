$(document).ready(function() {
    //Show only relevant form component to the desired user type

    $('#select-manager-type').on('change', function(){
        $('#form-group-select-zone').addClass('hidden');
        $('#form-group-multiselect-outlets').addClass('hidden');
        setupFountainOrZoneManagerDisplay(this.value, null);

    });

    $('#modal-manager-submit-add').on('click', postNewManager);
    $('#modal-manager-submit-edit').on('click', postEditManager);
});

function postNewManager(){
    postNewRow('manager')
}

function postEditManager(){
    postEditRow('manager')
}

function setupFountainOrZoneManagerDisplay(value, preSelection){
    if(value === 'fountain-manager'){
        requestAvailableWaterElements(preSelection);

        $('#form-group-multiselect-outlets').removeClass('hidden');
    }
    else if (value === 'zone-manager'){
        requestAvailableZones(preSelection);
        $('#form-group-select-zone').removeClass('hidden');
    }
}

async function getOutletsData() {
    let dexie = await new Dexie('user_db');
    let db = await dexie.open();
    let table = db.table('outlets');
    let result = [];

    await table.each(row => {
        result.push([
            row.id,
            row.name,
        ]);
    });

    return result;
}

function requestAvailableZones(preSelection){
    let select = $('#select-manager-zone');
    select.html("");
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let postURL = baseURL + "/api/table/?name=zone&indexDB=true";

    fetch(postURL).then(networkResponse => networkResponse.json()
        .then(result => {
            for (let zone of result.data) {
                select.append('<option value="' + zone[0] + '">' + zone[1] + '</option>')
            }
            let idZoneOption = select.find('option').filter(function () { return $(this).html() === preSelection; }).val();
            select.val(idZoneOption);
        })
    ).catch(err => {
        console.log(err);
        getZoneData().then(zones => {
            zones.forEach(zone => {
                select.append('<option value="' + zone[0] + '">' + zone[1] + '</option>')
            });
            // Pre-select data from edition
            let idZoneOption = select.find('option').filter(function () { return $(this).html() === preSelection; }).val();
            select.val(idZoneOption);
        })
    })
}

function requestAvailableWaterElements(preSelection){
    // Instantiate the select2 object and make sure it is empty from previous requests
    let multiselect = $('#multiselect-manager-outlets');
    multiselect.empty();
    multiselect.select2({
        dropdownParent: $('#modalManager'),
        width: '100%',
        data: null,
    }).trigger('change');

    // AJAX request
    let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
    let postURL = baseURL + "/api/outlets/";

    fetch(postURL).then(networkResponse => networkResponse.json()
        .then(result => {
            for (let zone of result.data) {
                multiselect.append('<option value="' + zone[0] + '">' + zone[1] + '</option>')
            }
            multiselect.val(preSelection).change();
        })
    ).catch(err => {
        console.log(err)
        getOutletsData().then(outlets => {
            outlets.forEach(outlet => {
                multiselect.append('<option value="' + outlet[0] + '">' + outlet[1] + '</option>')
            })
            multiselect.val(preSelection).change();
        })
    })
}

/**
 * Check the validity of an email
 * @param email the email to test
 * @returns {*|boolean} true if email is a valid email address
 */
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Validate (check if valid) the form.
 * If not valid, display messages
 */
function validateManagerForm() {
    console.log("validating");
    let form = document.forms["form-add-manager"];

    let id = form["input-manager-id"].value;
    let lastName = form["input-manager-last-name"].value;
    let firstName = form["input-manager-first-name"].value;
    let email = form["input-manager-email"].value;
    let phone = form["input-manager-phone"].value;
    let type = form["select-manager-type"].value;
    let zone = form["select-manager-zone"].value;

    let outlets = $('#multiselect-manager-outlets').val();


    // Construct an object with selectors for the fields as keys, and
    // per-field validation functions as values like so
    const fieldsToValidate = {
      '#input-manager-last-name' : value => value.trim() !== '',
      '#input-manager-first-name' : value => value.trim() !== '',
      '#input-manager-id' : value => value.trim() !== '',
      '#input-manager-email' : value => validateEmail(value),
      '#input-manager-phone' : value => value.length === 0 ||value.length === 8 || value.length === 10,
      '#select-manager-type' : value => value.trim() !== 'none',
    };

    const invalidFields = Object.entries(fieldsToValidate)
    .filter(entry => {
        // Extract field selector and validator for this field
        const fieldSelector = entry[0];
        const fieldValueValidator = entry[1];
        const field = form.querySelector(fieldSelector);

        if(!fieldValueValidator(field.value)) {
            // For invalid field, apply the error class
            let fieldErrorSelector = '#' + field.id + '-error';
            form.querySelector(fieldErrorSelector).className = 'error';
            return true;
        }

        return false;
    });

    if (type === 'fountain-manager'){
        if (outlets == null){
            console.log('no fountain');
            $('#multiselect-manager-outlets-error').removeClass('hidden');
            return false;
        }
    }
    if (type === 'zone-manager'){
        if (zone === 'none'){
            console.log('no zone');
            $('#select-manager-zone-error').removeClass('hidden');
            return false;
        }
    }

    // If invalid field length is greater than zero, this signifies
    // a form state that failed validation
    if(invalidFields.length > 0){
        console.log('invalid');
        return false
    } else {
        return buildManagerRequest(id,
            lastName,
            firstName,
            email,
            padPhone(phone),
            type,
            zone,
            outlets);
    }

}

function buildManagerRequest(id, lastName, firstName, email, phone, type, zone, outlets){
    let request = "table=manager";
    request += "&id=" + id;
    request += "&lastname=" + lastName;
    request += "&firstname=" + firstName;
    request += "&email=" + email;
    request += "&phone=" + phone;
    request += "&type=" + type;
    request += "&zone=" + zone;
    request += "&outlets=" + outlets;

    return request;
}

function setupModalManagerAdd(){
    //Show add components
    $('#modal-manager-title-add').removeClass("hidden");
    $('#modal-manager-submit-add').removeClass("hidden");

    //Hide edit components
    $('#modal-manager-title-edit').addClass("hidden");
    $('#modal-manager-submit-edit').addClass("hidden");

    //Enable personal information modification
    disableModalElements(false);

    $('form').find('input').val('');
    $('form').find('select').val('none');
    $('#select-manager-type').change();

    showManagerModal();
}

function disableModalElements(bool){
    $('#input-manager-id').prop('disabled', bool);
    $('#input-manager-first-name').prop('disabled', bool);
    $('#input-manager-last-name').prop('disabled', bool);
    $('#input-manager-email').prop('disabled', bool);
}

function setupModalManagerEdit(data){
    //Show add components
    $('#modal-manager-title-add').addClass("hidden");
    $('#modal-manager-submit-add').addClass("hidden");

    //Hide edit components
    $('#modal-manager-title-edit').removeClass("hidden");
    $('#modal-manager-submit-edit').removeClass("hidden");

    //Disable the modification of personal information
    disableModalElements(true);

    //Setup elements
    $('#input-manager-id').val(data[0]);
    $('#input-manager-last-name').val(data[1]);
    $('#input-manager-first-name').val(data[2]);
    $('#input-manager-phone').val(data[3]);
    $('#input-manager-email').val(data[4]);
    if(data[5].includes('zone')) {
        $('#select-manager-type option[value="zone-manager"]').prop('selected', true);
        setupFountainOrZoneManagerDisplay("zone-manager", data[6]);
    } else if(data[5].includes('fontaine')) {
        $('#select-manager-type option[value="fountain-manager"]').prop('selected', true);
        setupFountainOrZoneManagerDisplay("fountain-manager", data[7]);

    }
    showManagerModal();

}

function showManagerModal(){
    $('#plus-manager').magnificPopup({
        type: 'inline',
        preloader: false,
        focus: '#name',
        modal: true,

        // Do not zoom on mobile
        callbacks: {
            beforeOpen: function() {
                if($(window).width() < 700) {
                    this.st.focus = false;
                } else {
                    this.st.focus = '#name';
                }
            }
        }
    }).magnificPopup('open');
}

/**
 * Hide the modal and empty the values
 */
function dismissManagerModal() {
    $.magnificPopup.close();
    $('form').find('input').val('');
    $('form').find('select').val('none');
    $('#select-manager-type').change();

}
