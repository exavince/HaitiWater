var monthlyReport = {}; // Complete on validation
const CUBICMETER_GALLON_RATIO = 264.172;

$(document).ready(function() {

	let wizardReport = $('#wizardMonthlyReport');
	let wizardForm = $('#wizardMonthlyReport form');

    // Enable hours and days logging (step 1)
	let checkboxActiveService = $('#checkbox-active-service');
	checkboxActiveService.on('change', function(){
		// Elements to enable/disable if the checkbox is checked/unchecked
		let dependentElements = [
			$("#input-hours"),
			$("#input-days")
		];
		if (this.checked){
			dependentElements.forEach(function(element){
				element.removeAttr('disabled');
			});
		} else {
			dependentElements.forEach(function(element){
				element.attr('disabled', 'disabled');
			});
		}
	});

    /**
	 * Wizard form key events
     */
    // This listener is to disable default enter key to prevent any false submission
	wizardForm.on('keypress', function(event){
	    if(event.keyCode === 13)
		    event.preventDefault();
	});

    /**
	*	Wizard Controller
	*/
	let $wizardMonthlyReportfinish = wizardReport.find('ul.pager li.finish');
	let $wizardMonthlyReportSave = wizardReport.find('ul.pager li.save');

	$wizardMonthlyReportfinish.on('click', async function( ev ) {
		ev.preventDefault();
		var validated = validate();
		if (validated) {
			beforeModalRequest();
			let baseURL = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
			let postURL = baseURL + "/api/report/";
			var myInit = {
				method: 'post',
				headers: {
					"Content-type": "application/json",
					'X-CSRFToken':getCookie('csrftoken')
				},
				body: JSON.stringify(monthlyReport)
			};

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
					table: 'MonthlyReport',
					init:myInit,
					type:'Ajouter',
					elemId: '?',
					status:"En attente",
					details:myInit
				});

				localStorage.removeItem("monthlyReport");
				drawDataTable('report');
				dismissModal();
				afterModalRequest();
				postMessage({title:'pushData'});
				console.log('[REPORT_ready]', 'Monthly report')
			} catch (e) {
				console.error('[REPORT_ready]', e);
				try {
					let response = await fetch(postURL, myInit)
					if(response.ok) {
						new PNotify({
							title: 'Succès!',
							text: 'Le rapport mensuel a été envoyé !',
							type: 'success'
						});
						localStorage.removeItem("monthlyReport");
						drawDataTable('report');
						dismissModal();
						afterModalRequest();
					} else {
						new PNotify({
							title: 'Échec!',
							text: "Le rapport mensuel n'a pas pu être envoyé",
							type: 'error'
						});
						$('#form-monthly-report-error-msg').html(response.statusText);
						$('#form-monthly-report-error').removeClass('hidden');
						afterModalRequest();
						console.error('[REPORT_ready]', response.statusText)
					}
				} catch (e) {
					console.error('[REPORT_ready]', e);
				}
			}
		}
		else {
			return false;
		}
	});

	$wizardMonthlyReportSave.on('click', function ( ev ) {
		ev.preventDefault();
		const validated = validate();
		if (validated) {
			localStorage.setItem('monthlyReport', JSON.stringify(monthlyReport));
			new PNotify({
				title: 'Succès!',
				text: 'Le rapport mensuel a été sauvegardé !',
				type: 'success'
			});
			dismissModal();
		} else {
			return false;
		}
    });

	let savedData = JSON.parse(localStorage.getItem('monthlyReport'));
	setupStepOne(savedData);

	wizardReport.bootstrapWizard({
		tabClass: 'wizard-steps',
		nextSelector: 'ul.pager li.next',
		previousSelector: 'ul.pager li.previous',
		firstSelector: null,
		lastSelector: null,
		onNext: function( tab, navigation, index, newindex ) {
			var validated = validate(index, savedData);
			if( !validated ) {
				return false; // Do not switch tab if form is not valid
			}
		},
		onTabClick: function( tab, navigation, index, newindex ) {
			return false; // Prevent switching tab by clicking on tab
		},
		onTabChange: function( tab, navigation, index, newindex ) {
			var $total = navigation.find('li').size() - 1;
			$wizardMonthlyReportfinish[ location.pathname === '/offline/' || newindex !== $total ?
				'addClass' : 'removeClass' ]( 'hidden' );
			$wizardMonthlyReportSave[ newindex !== $total ? 'addClass' : 'removeClass' ]( 'hidden' );
			wizardReport.find(this.nextSelector)[ newindex === $total ? 'addClass' : 'removeClass' ]( 'hidden' );
		},
		onTabShow: function( tab, navigation, index ) {
			var $total = navigation.find('li').length - 1;
			var $current = index;
			var $percent = Math.floor(( $current / $total ) * 100);
			wizardReport.find('.progress-indicator').css({ 'width': $percent + '%' });
			tab.prevAll().addClass('completed');
			tab.nextAll().removeClass('completed');
		}
	});


    $('#multiselect-outlets').multiselect({
        maxHeight: 300,
        buttonText: function(options, select) {
            // Note that &#9660 = caret down
            if (options.length === 0) {
                return '0 sélectionné &#9660;';
            }
            else if (options.length === 1) {
                return '1 sélectionné &#9660';
            }
            else if (options.length > 1) {
                return options.length + ' sélectionnés &#9660';
            }
        }
    });

    /*
	Multi Select: Toggle All Button
	*/
	function multiselect_selected($el) {
		var ret = true;
		$('option', $el).each(function(element) {
			if (!!!$(this).prop('selected')) {
				ret = false;
			}
		});
		return ret;
	}

	function multiselect_selectAll($el) {
		$('option', $el).each(function(element) {
			$el.multiselect('select', $(this).val());
		});
	}

	function multiselect_deselectAll($el) {
		$('option', $el).each(function(element) {
			$el.multiselect('deselect', $(this).val());
		});
	}

	function multiselect_toggle($el, $btn) {
		if (multiselect_selected($el)) {
			multiselect_deselectAll($el);
			$btn.text("Tout sélectionner");
		}
		else {
			multiselect_selectAll($el);
			$btn.text("Remise à zéro");
		}
	}

	$("#multiselect-outlets-toggle").click(function(e) {
		e.preventDefault();
		multiselect_toggle($("#multiselect-outlets"), $(this));
	});

    /**
	 * Listener to compute the total in the billing area
     */
    let totalInput = $('#input-total-billing');
    let fountainInput = $('#input-fountain-billing');
    let kioskInput = $('#input-kiosk-billing');
    let individualInput = $('#input-individual-billing');
    let computeTotal = function(){
    	let total = (parseFloat(fountainInput.val()) || 0)
						+ (parseFloat(kioskInput.val()) || 0)
						+ (parseFloat(individualInput.val()) || 0);
    	totalInput.val(total)
	};

    fountainInput.on('input', computeTotal);
    kioskInput.on('input', computeTotal);
    individualInput.on('input', computeTotal);
});

/**
 * Hide all the error messages in the form
 */
function hideErrorsMsgs(){
    let buttons = $(".error");
    buttons.each(function(index){
    	$(this).addClass('hidden');
	});
}

function validate(step, savedData){
    switch(step){
        case 1:
        	setupStepTwo(savedData);
            return validateStepOne();
        case 2:
        	if (validateStepTwo()){
             	setupStepThree(savedData);
				return true;
			}
			return false;
		case 3:
			setupConfirmation();
			return validateStepThree();
        default:
            return validateStepOne() &&
            		validateStepTwo() &&
					 validateStepThree();
    }
}

/**
 * Validate data entry for Wizard step 1 - General state
 */
function validateStepOne(){
    hideErrorsMsgs();
    let isValid = true;

    // Selected outlets
    let multiselectOutlets = $('#multiselect-outlets');
    if (!multiselectOutlets.val()){
        $('#input-multiselect-error').removeClass('hidden');
        isValid = false;
    }
    else {
    	// Save in report
    	this.monthlyReport.selectedOutlets = multiselectOutlets.val();
	}

    // Activity stats
	let checkboxActiveService = $('#checkbox-active-service');
	let inputDays = $('#input-days');
	let inputHours = $('#input-hours');

	if (checkboxActiveService.is(':checked')){
		if((inputDays.val() < 1) || (inputDays.val() > 31) || (inputDays.val() === "")){
			$('#input-days-error').removeClass('hidden');
			isValid = false;
		}
		if((inputHours.val() <= 0) || (inputHours.val() > 24) || (inputHours.val() === "")){
			$('#input-hours-error').removeClass('hidden');
			isValid = false;
		}

		// Save in report
		this.monthlyReport.isActive = true;
		this.monthlyReport.inputDays = inputDays.val();
		this.monthlyReport.inputHours = inputHours.val();
	} else {
	    this.monthlyReport.isActive = false; // Save in report
	}
	// Todo modify once control to change month is done
	monthlyReport.month = $('#wizardMonthlyReport').find('.panel-title')[0].innerText.replace('Rapport mensuel : ','');
	return isValid;

}

/**
 * Validate data entry for Wizard step 2 - Details
 */
function validateStepTwo(){
	let isValid = true;
    let individualReports = $('#wizardMonthlyReport-details .water-outlet');

    this.monthlyReport.details = [];

    individualReports.each(function(index){
		let cubicValue = 'none';
		let perCubicValue = 'none';
		let outletID = $(this).attr('id').replace('volume-', '');

		// If we have data, use it, otherwise keep none
		if($(this).find('.element-activity')[0].checked){
	      	cubicValue = $(this).find('.cubic input').val();
	      	let gallonValue = $(this).find('.gallon input').val();

			if ((cubicValue < 0 || cubicValue === '') || (gallonValue < 0 || gallonValue ==='')){
				isValid = false;
				$(this).find('label.volume.error').removeClass('hidden');
			}

			perCubicValue = $(this).find('.per-cubic input').val();
	      	let perGallonValue = $(this).find('.per-gallon input').val();

			if ((perCubicValue < 0 || perCubicValue === '') || (perGallonValue < 0 || perGallonValue ==='')){
				isValid = false;
				$(this).find('label.cost.error').removeClass('hidden');
			}
		}

		monthlyReport.details.push(
			{
				id: outletID,
				cubic: cubicValue,
				perCubic: perCubicValue,
			}
		)
    });
    return isValid;
}

/**
 * Validate data entry for Wizard step 3 - Billing
 */
function validateStepThree(){
	let valid = true;

	let billValues = $('#wizardMonthlyReport-billing');
	billValues.find('.error').addClass('hidden');
	billValues.find('.bill').each(function(e){
		if (monthlyReport.details[e].cubic === "none"){
			//Skip the current loop if we are in a fountain without data
			return true; // Equal to "continue"
		}
		let id = $(this).attr('id').replace('bill-','');
		let value = $(this).find('.real-bill').val();
		if (value < 0 || value === ''){
			$(this).find('.error').removeClass('hidden');
			valid = false;
		} else{
			let obj = monthlyReport.details[e];

			if(obj.id !== id)
				throw 'Something really bad happened';
			obj.bill = value;
		}
	});
	return valid;
}

/**
 * complete form values depending on the saved data
 */
function setupStepOne(savedData){
	const outlets = JSON.parse(localStorage.getItem("outlets"));

	if (location.pathname === '/offline/') {
		$("#multiselect-outlets").html();
		if (outlets) {
			for (let i = 0; i < outlets.length; i++) {
				const outlet = outlets[i];
				const option = "<option value='" + outlet[0] + "'>" + outlet[1] + "</option>";
				$("#multiselect-outlets").append(option);
			}
		}
	}

	if (savedData) {
		if (savedData.selectedOutlets) {
			savedData.selectedOutlets.forEach(function (value) {
				$("#multiselect-outlets option[value='" + value + "']").prop("selected", true);
			});
		}

		if (savedData.isActive) {
			$('#checkbox-active-service').prop("checked", true);
			$('#input-days').removeAttr("disabled");
			$('#input-hours').removeAttr("disabled");
		}

		if (savedData.inputDays) {
			$('#input-days').val(savedData.inputDays)
		}

		if (savedData.inputHours) {
			$('#input-hours').val(savedData.inputHours)
		}
	}
}

/**
 * Dynamically set the content of step 2 according to selected water outlets in step 1
 */
function setupStepTwo(savedData){
	// Panel body containing the data
	function createPanelBody(outlet) {
		let data;
		if (savedData) {
			savedData.details.forEach(function (detail) {
				if (detail.id == outlet)
					data = detail;
			});
		}
		return '' +
			'<div class="panel-body">' +
			  '<div class="checkbox"><label>' +
			  '<input type="checkbox" class="element-activity" ' + (data && data.cubic === 'none' && data.perCubic === 'none' ? '' : 'checked') + '>' +
			  'Je dispose de données pour cet élément</label></div>' +
				'<div class="row">' +
					'<div class="col-sm-6">' +
						'<h5>Volume d\'eau distribué</h5>' +
						'<div class="row">' +
							'<div class="col-sm-6 cubic">' +
								'<input class="form-control" type="number"'
									+ (data && data.cubic !== 'none' ? 'value="' + data.cubic + '"' : '')
									+ (data && data.cubic === 'none' && data.perCubic === 'none' ? 'disabled' : 'enabled') + '>' +
							'</div>' +
							'<div class="col-sm-6 gallon">' +
								'<input class="form-control" type="number"'
									+ (data && data.cubic !== 'none' ? 'value="' + (data.cubic * CUBICMETER_GALLON_RATIO).toFixed(3) + '"' : '')
									+ (data && data.cubic === 'none' && data.perCubic === 'none' ? 'disabled' : 'enabled') + '>' +
							'</div>' +
						'</div>' +
						'<label class="volume error">Valeurs de volume incorrectes</label>' +
					'</div>' +
					'<div class="col-sm-6">' +
						'<h5>Coût au volume (HTG)</h5>' +
						'<div class="row">' +
							'<div class="col-sm-6 per-cubic">' +
								'<input class="form-control" type="number"'
									+ (data && data.perCubic !== 'none' ? 'value="' + data.perCubic + '"' : '')
									+ (data && data.cubic === 'none' && data.perCubic === 'none' ? 'disabled' : 'enabled') + '>' +
							'</div>' +
							'<div class="col-sm-6 per-gallon">' +
								'<input class="form-control" type="number"'
									+ (data && data.perCubic !== 'none' ? 'value="' + (data.perCubic / CUBICMETER_GALLON_RATIO).toFixed(3) + '"' : '')
									+ (data && data.cubic === 'none' && data.perCubic === 'none' ? 'disabled' : 'enabled') + '>' +
							'</div>' +
						'</div>' +
						'<label class="cost error">Valeurs de coût incorrectes</label>' +
					'</div>' +
				'</div>' +
			'</div>';
	}

	// For each selected outlet, setup the data section
	let selectedOutlets = $('#multiselect-outlets option:selected');
	let detailsWindow = $('#wizardMonthlyReport-details');
	detailsWindow.empty(); // Flush old content

	let checkboxActiveService = $('#checkbox-active-service');
	if (checkboxActiveService.is(':checked')){
		// Service was active, ask user to input details
		selectedOutlets.each(function(index){
			let name = this.text; // Displayed name
			let id = this.value; // ID of the fountain to send back to server

			let sectionHeader = '<section class="panel water-outlet volume" id="volume-'+ id +'">' +
									'<header class="panel-heading">' +
										'<h2 class="panel-title">' + name + '</h2>' +
									'</header>';
			detailsWindow.append(sectionHeader + createPanelBody(selectedOutlets[index].value));
			detailsWindow.append('</section>');
		});
	} else {
		detailsWindow.html("<div class=\"well info text-center\">" +
			"Vous n'avez aucun détail de volume à entrer puisque le service n'a pas été en activité.<br>" +
			"Si vous avez des détails à entrer, cochez la case de service à l'étape 1.<br>" +
			"Si c'est correct, passez à l'étape suivante.</div>");
	}
	attachCubicGallonConverter();
}

/**
 * Get the volumes distributed by the water network, multiply them by the cost and put the computed total
 * inside the suggestion field for the billing step
 */
function setupStepThree(savedData){
	// Panel body containing the data
	function createPanelBody(outlet) {
		let data;
		if (savedData) {
			savedData.details.forEach(function (detail) {
				if (detail.id == outlet)
					data = detail;
			});
		}
		return '' +
			'<div class="panel-body">' +
				'<div class="row">' +
					'<div class="col-sm-6">' +
						'<h5>Réelles (HTG)</h5>' +
						'<input class="real-bill form-control" type="number" '
							+ (data ? 'value="' + data.bill + '"' : '') + '">' +
						'<label class="billing error hidden">Valeur incorrecte</label>' +
					'</div>' +
					'<div class="col-sm-6">' +
						'<h5>Calculées (HTG)</h5>' +
						'<input class="computed-bill form-control" type="number" readonly="readonly">' +
					'</div>' +
				'</div>' +
			'</div>';
	}


	// For each selected outlet, setup the data section
	let selectedOutlets = $('#multiselect-outlets option:selected');
	let billingWindow = $('#wizardMonthlyReport-billing');
	billingWindow.empty(); // Flush old content

	let checkboxActiveService = $('#checkbox-active-service');
	if (checkboxActiveService.is(':checked')){
		// Service was active, ask user to input details
		selectedOutlets.each(function(index){
			let name = this.text; // Displayed name
			let id = this.value; // ID of the fountain to send back to server

			let sectionHeader = '<section class="panel water-outlet bill" id="bill-'+ id +'">' +
									'<header class="panel-heading">' +
										'<h2 class="panel-title"> Recettes : ' + name + '</h2>' +
									'</header>';
			billingWindow.append(sectionHeader + createPanelBody(selectedOutlets[index].value));
			billingWindow.append('</section>');
		});

		let details = monthlyReport.details;
		for(var i = 0; i < details.length; i++){
			let id = details[i].id;
			let perCubic = details[i].perCubic;
			let cubic = details[i].cubic;
			if (cubic === 'none'){
				$('#bill-' + id).remove(); // Do not display if no volume data
			} else {
				$('#bill-'+id).find('.computed-bill').val(cubic*perCubic);
			}
		}
	} else {
		billingWindow.html("<div class=\"well info text-center\">" +
			"Vous n'avez aucun détail de recette à entrer puisque le service n'a pas été en activité.<br>" +
			"Si vous avez des détails à entrer, cochez la case de service à l'étape 1.<br>" +
			"Si c'est correct, passez à l'étape suivante.</div>");
	}
	// Display text if we have no data for any element
	if ($('.bill').length < 1){
		console.error("empty");
		billingWindow.html("<div class=\"well info text-center\">" +
			"Vous n'avez aucun détail de recette à entrer puisque aucune donnée de volume n'a été collectée.<br>" +
			"Si vous avez des volumes à entrer, revenez à l'étape 2.<br>" +
			"Si c'est correct, passez à l'étape suivante.</div>");
	}
}

/**
 * List the water outlets that will have their information pushed to the server
 */
function setupConfirmation(){
	let selectedOutlets = $('#multiselect-outlets option:selected');
	let selectionAsHTMLList = "";

	selectedOutlets.each(function() {
        let name = this.text;
        selectionAsHTMLList += "<li>" + name +"</li>"
    });

	$("#confirmation-generated-content").html("<div class=\"well info\">" +
			"Vous allez soumettre les informations de :" +
			"<ul>" +
			selectionAsHTMLList +
			"</ul>"+
			"Cette opération est irréversible, cliquez sur \"Envoyer\" pour confirmer l'envoi. <br>" +
			"</div>");
}

/**
 * Dismiss modal (but keep values)
 */
function dismissModal() {
    $.magnificPopup.close();
}

function attachCubicGallonConverter(){
	/**
     * Listener to convert cubic to gallons and vice-versa, and to check if has data
     */
    $('.water-outlet').each(function(i){
		// Cubic-gallon conversion
        let cubic = $('.cubic input', this);
        let gallon = $('.gallon input', this);

        cubic.on('input', function(){
            gallon.val((cubic.val() * CUBICMETER_GALLON_RATIO).toFixed(3));
        });

        gallon.on('input', function(){
            cubic.val((gallon.val() / CUBICMETER_GALLON_RATIO).toFixed(3));
        });

        let perCubic = $('.per-cubic input', this);
        let perGallon = $('.per-gallon input', this);

        perCubic.on('input', function(){
            perGallon.val((perCubic.val() / CUBICMETER_GALLON_RATIO).toFixed(3));
        });

        perGallon.on('input', function(){
            perCubic.val((perGallon.val() * CUBICMETER_GALLON_RATIO).toFixed(3));
        });

		// Has data or not
		let hasData = $('.element-activity', this);
		let inputs = [cubic, gallon, perCubic, perGallon, $('.real-gains input', $(this))];
		hasData.on('click', function(){
			if (this.checked){
				inputs.forEach(function(input){
					input.prop('disabled', false);
				})
			}
			else {
				inputs.forEach(function(input){
					input.prop('disabled', true);
					input.val('');
				})
			}
		});
		//hasData.prop('checked', true); // Start as checked
    });
}
