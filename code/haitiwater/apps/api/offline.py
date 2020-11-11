from ..api.add_table import *
from ..api.edit_table import *
from ..log.utils import *
from ..utils.get_data import is_user_zone, is_user_fountain, get_outlets

success_200 = HttpResponse(status=200)

def check_authentication(request):
    if not request.user.is_authenticated:
        return HttpResponse("notConnected", status=403)
    else:
        return HttpResponse("connected", status=200)


def get_zone(request):
    if not request.user.is_authenticated:
        return HttpResponse("Vous n'êtes pas connecté", status=403)

    table_name = request.GET.get('name', None)

    if table_name == "water_element":
        result = get_water_elements(request)
    elif table_name == "consumer":
        result = get_consumer_elements(request)
    elif table_name == "zone":
        if is_user_fountain(request):
            return HttpResponse("Vous ne pouvez pas accéder à ces informations", status=403)
        result = get_zone_elements(request)
    elif table_name == "manager":
        if is_user_fountain(request):
            return HttpResponse("Vous ne pouvez pas accéder à ces informations", status=403)
        result = get_manager_elements(request)
    elif table_name == "report":
        if is_user_zone(request):
            return HttpResponse("Vous ne pouvez pas accéder à ces informations", status=403)
        result = get_last_reports(request)
    elif table_name == "ticket":
        result = get_ticket_elements(request)
    elif table_name == "logs":
        result = get_logs_elements(request, archived=False)
    elif table_name == "logs_history":
        result = get_logs_elements(request, archived=True)
    elif table_name == "payment":
        result = get_payment_elements(request)
        if result is None:
            return success_200
    else:
        return HttpResponse("Impossible de charger la table demandée (" + table_name + ").", status=404)

    if result is None:
        return HttpResponse("Problème à la récupération des données", status=400)

    json_object = {"data": result}

    return HttpResponse(json.dumps(json_object), status=200)

def get_consumers(request):
    if not request.user.is_authenticated:
        return HttpResponse("Vous n'êtes pas connecté", status=403)

    result = get_all_details_consumers(request)
    json_object = {"data": result}

    return HttpResponse(json.dumps(json_object), status=200)


def get_payments(request):
    if not request.user.is_authenticated:
        return HttpResponse("Vous n'êtes pas connecté", status=403)

    result = get_all_payments(request)
    json_object = {"data": result}

    return HttpResponse(json.dumps(json_object), status=200)






