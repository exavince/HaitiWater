function validateForm() {
    let form = document.forms["form-add-ticket"];

    let id = form["input-id"].value;
    let type = form["select-type"].value;
    let urgency = form["select-urgency"].value;
    let idOutet = form["select-outlet"].value;
    let comment = form["input-comment"].value;
    let state = form["select-state"].value;
    try {
        let reader = new FileReader();
        let picture = reader.readAsText(form["input-picture"].files[0]);
    } catch (ignored) {
        //Continue
    }


    // Construct an object with selectors for the fields as keys, and
    // per-field validation functions as values like so
    const fieldsToValidate = {
        '#select-type': value => value.trim() !== 'none',
        '#select-urgency': value => value !== 'none',
        '#input-comment': value => value.trim() !== '',
        '#select-outlet': value => value.trim() !== 'none',
    };

    const invalidFields = Object.entries(fieldsToValidate)
        .filter(entry => {
            // Extract field selector and validator for this field
            const fieldSelector = entry[0];
            const fieldValueValidator = entry[1];
            const field = form.querySelector(fieldSelector);

            if (!fieldValueValidator(field.value)) {
                // For invalid field, apply the error class
                let fieldErrorSelector = '#' + field.id + '-error';
                form.querySelector(fieldErrorSelector).className = 'error';
                return true;
            }

            return false;
        });

    // If invalid field length is greater than zero, this signifies
    // a form state that failed validation
    return invalidFields.length < 1
}

function readURL(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            $('#preview')
                .attr('src', e.target.result)
                .width(200);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function buildRequest(id, type, urgency, idOutlet, comment, state, picture) {
    let request = "table=ticket";
    request += "&id=" + id;
    request += "&type=" + type;
    request += "&urgency=" + urgency;
    request += "&id_outlet" + idOutlet;
    request += "&comment=" + comment;
    request += "&state=" + state;
    request += "&picture=" + picture;

    return request;
}

function setupTicketModalAdd() {
    //Show add components
    $('#modal-title-add').removeClass("hidden");
    $('#modal-submit-add').removeClass("hidden");

    //Hide edit components
    $('#modal-title-edit').addClass("hidden");
    $('#modal-submit-edit').addClass("hidden");
    $('#form-id-component').addClass("hidden");

    //Authorize element modification
    $('#select-outlet').removeAttr('disabled');

    //Hide useless state selector (always unresolved when ticket opened)
    $('#select-state-group').addClass('hidden');

    showModal('#show-ticket-modal');
}

function setupModalEdit(data) {
    //Show add components
    $('#modal-title-add').addClass("hidden");
    $('#modal-submit-add').addClass("hidden");

    //Hide edit components
    $('#modal-title-edit').removeClass("hidden");
    $('#modal-submit-edit').removeClass("hidden");
    $('#form-id-component').removeClass("hidden");

    //Do not authorize element modification
    $('#select-outlet').prop('disabled', 'disabled');

    //Show state modificator to mark problem as resolved
    $('#select-state-group').removeClass('hidden');

    showModal('#show-ticket-modal');


    let form = document.forms["form-add-ticket"];

    form["input-id"].value = data[0].innerText;

    //Set value for problem type
    let typeOption = $("#select-type option").filter(function () {
        if (this.text.trim() === data[3].innerText.trim()) {
            return this;
        }
    });
    form['select-type'].value = typeOption[0].value;

    //Set value for problem urgency
    let urgencyOption = $("#select-urgency option").filter(function () {
        if (this.text.trim() === data[1].innerText.trim()) {
            return this;
        }
    });
    form['select-urgency'].value = urgencyOption[0].value;

    //Set value for problem outlet
    let outletOption = $("#select-outlet option").filter(function () {
        if (this.text.trim() === data[2].innerText.trim()) {
            return this;
        }
    });
    form['select-outlet'].value = outletOption[0].value;

    form["input-comment"].value = data[4].innerText;

    //Set value for problem outlet
    let stateOption = $("#select-state option").filter(function () {
        if (this.text.trim() === data[5].innerText.trim()) {
            return this;
        }
    });
    form['select-state'].value = stateOption[0].value;

}

/**
 * Hide the modal and reset the fields
 */
function dismissTicketModal() {
    $.magnificPopup.close();
    $('.error').addClass('hidden');
    let form = document.forms["form-add-ticket"];

    form["input-id"].value = "";
    form["select-type"].value = "none";
    form["select-urgency"].value = "none";
    form["select-outlet"].value = "none";
    form["input-comment"].value = "";
    form["input-picture"].value = "";
    form["select-state"].value = "unresolved";
}

async function sendTicket(addOrEdit) {
    if (!validateForm())
        return;
    let form = document.forms["form-add-ticket"];

    let body = "table" + "=" + "ticket" + "&" +
    "id" + "=" + form["input-id"].value + "&"+
    "type" + "=" + form["select-type"].value + "&"+
    "urgency" + "=" + form["select-urgency"].value + "&"+
    "id_outlet" + "=" + form["select-outlet"].value + "&"+
    "comment" + "=" + form["input-comment"].value + "&"+
    "state" + "=" + form["select-state"].value + "&"+
    "picture" + "=" + form["input-picture"].files[0];

    let baseURL = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');
    let postURL = baseURL + "/api/" + addOrEdit + "/";

    var myInit = {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
            'X-CSRFToken':getCookie('csrftoken')
        },
        body: body
    };
    beforeModalRequest();

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
            table: 'IssueTable',
            init:myInit,
            type:(addOrEdit === 'add' ? "Ajouter" : "Editer"),
            elemId: (addOrEdit === 'add' ? "?" : "0"),
            status:"En attente",
            details:myInit
        });

        document.getElementById("form-ticket-error").className = "alert alert-danger hidden"; // hide old msg
        if (addOrEdit !== 'add') indexedDBModify('ticket', form["input-id"].value);
        postMessage({title:'pushData'});
        console.log('[REPORT_sendTicket]', 'ticket sent');
    } catch (e) {
        console.error('[REPORT_sendTicket]', e);
        try {
            let response = await fetch(postURL, myInit)
            if(response.ok) {
                document.getElementById("form-ticket-error").className = "alert alert-danger hidden"; // hide old msg
                dismissModal();
                new PNotify({
                    title: 'Succès!',
                    text: "Opération effectuée",
                    type: 'success'
                });
                console.error('[REPORT_sendTicket]', 'sent without SW');
            } else {
                document.getElementById("form-ticket-error").className = "alert alert-danger";
                document.getElementById("form-ticket-error-msg").innerHTML = err;
                new PNotify({
                    title: 'Echec!',
                    text: "Le serveur a refusé !",
                    type: 'error'
                });
                console.error('[REPORT_sendTicket]', response.statusText);
            }
        } catch (e) {
            console.error('[REPORT_sendTicket]', e);
        }
    }

    dismissModal();
    afterModalRequest();
    await drawDataTable('ticket');
}

