
from ..consumers.models import Consumer
from ..report.models import Report, Ticket
from ..water_network.models import Element, Zone
from ..log.models import Transaction, Log
from django.contrib.auth.models import User


def add_with_search(parsed, values):
    result = []
    if parsed["search"] == "" and len(values) > 0:
        for elem in values:
            result.append(elem)
    else:
        for cols in parsed["searchable"]:
            if cols < len(values) and parsed["search"].lower() in str(values[cols]).lower():
                result.append(values)
                break
    return result


def get_water_elements(request, json, parsed):
    zone = request.user.profile.zone
    outlets = request.user.profile.outlets
    if zone: #If there is a zone, we have a zone manager
        target = Zone.objects.filter(name=zone.name)
        if len(target) == 1:
            target = target[0]
        else:
            return False
        all_water_element = [elem for elem in Element.objects.all() if elem.is_in_subzones(target)]
    else: #We have a fountain manager
        all_water_element = [elem for elem in Element.objects.all() if str(elem.id) in outlets]
    json["recordsTotal"] = len(all_water_element)
    all = []
    for elem in all_water_element:
        cust = Consumer.objects.filter(water_outlet=elem)
        distributed = Report.objects.filter(water_outlet=elem)
        quantity = 0
        for report in distributed:
            quantity += report.quantity_distributed
        tab = elem.network_descript()
        tab.insert(4, round(quantity, 2))
        tab.insert(5, round(quantity * 264.17, 2))  # TODO make sure this is correct
        total_consumers = 0
        for c in cust:
            total_consumers += c.household_size
        tab.insert(3, total_consumers)
        all.append(tab)
    return add_with_search(parsed, all)


def get_consumer_elements(request, json, parsed):
    zone = request.user.profile.zone
    all = []
    if zone: #Zone manager
        target = Zone.objects.filter(name=zone.name)
        if len(target) == 1:
            target = target[0]
        else:
            return False
        all_consumers = [elem for elem in Consumer.objects.all() if elem.water_outlet.is_in_subzones(target)]
        json["recordsTotal"] = len(all_consumers)
        for elem in all_consumers:
            if parsed["search"] == "":
                all.append(elem.descript())
            else:
                for cols in parsed["searchable"]:
                    tab = elem.descript()
                    if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                        all.append(tab)
                        break
    return all


def get_zone_elements(request, json, parsed):
    all = []
    if request.user.profile.zone: #Zone manager
        json["recordsTotal"] = len(request.user.profile.zone.subzones)
        for z in request.user.profile.zone.subzones:
            zone = Zone.objects.filter(name=z)
            if len(zone) == 1:
                if parsed["search"] == "":
                    all.append(zone[0].descript())
                else:
                    for cols in parsed["searchable"]:
                        tab = zone[0].descript()
                        if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                            all.append(tab)
                            break
    return all


def get_manager_elements(request, json, parsed):
    all = []
    if request.user.profile.zone:#Zone manager
        zone = request.user.profile.zone
        target = Zone.objects.filter(name=zone.name)
        if len(target) == 1:
            target = target[0]
        else:
            return False
        all_collab = User.objects.all()
        json["recordsTotal"] = len(all_collab) -1 #Remove the admin account
        for u in all_collab:
            group = u.groups.values_list('name', flat=True)
            if "Gestionnaire de zone" in group:
                if type(target) is Zone and u.profile.zone.name in target.subzones:
                    tab = [u.username, u.last_name, u.first_name, u.email,
                           "Gestionnaire de zone", u.profile.zone.name]
                    if parsed["search"] == "":
                        all.append(tab)
                    else:
                        for cols in parsed["searchable"]:
                            if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                                all.append(tab)
                                break
            if "Gestionnaire de fontaine" in group:
                for elem in u.profile.outlets:
                    out = Element.objects.filter(id=elem)
                    if len(out) == 1:
                        out = out[0]
                    if type(out) is Element and out.is_in_subzones(target):
                        tab = [u.username, u.last_name, u.first_name, u.email,
                               "Gestionnaire de fontaine", ""]
                        if parsed["search"] == "":
                            all.append(tab)
                        else:
                            for cols in parsed["searchable"]:
                                if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                                    all.append(tab)
                                    break

    return all


def get_ticket_elements(request, json, parsed):
    all = []
    if request.user.profile.zone: #Zone manager
        tot = 0
        for elem in Ticket.objects.all():
            if elem.water_outlet.zone.name in request.user.profile.zone.subzones:
                if parsed["search"] == "":
                    all.append(elem.descript())
                    tot += 1
                else:
                    for cols in parsed["searchable"]:
                        tab = elem.descript()
                        if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                            all.append(tab)
                            tot += 1
                            break
        json["recordsTotal"] = tot
    else: #Fountain manager
        tot = 0
        for elem in Ticket.objects.all():
            if str(elem.water_outlet.id) in request.user.profile.outlets:
                tot += 1
                if parsed["search"] == "":
                    all.append(elem.descript())
                else:
                    for cols in parsed["searchable"]:
                        tab = elem.descript()
                        if cols < len(tab) and parsed["search"].lower() in str(tab[cols]).lower():
                            all.append(tab)
                            break
        json["recordsTotal"] = tot
    return all


def get_logs_elements(request, json, parsed):
    transactions = Transaction.objects.filter(user__in=request.user.profile.get_subordinates())
    all = []
    tot = 0
    for t in transactions:
        logs = Log.objects.filter(transaction=t)
        item = {"id": t.id, "time": str(t.timestamp.date()),
                "type": logs[0].action, "user": t.user.username,
                "summary": logs[0].table_name, "details": "TODO"}
        if parsed["search"] == "":
            all.append(item)
            tot += 1
        else:
            for cols in parsed["searchable"]:
                if cols < len(item) and parsed["search"].lower() in item.keys() \
                        or parsed["search"].lower() in item.values():
                    all.append(item)
                    tot += 1
                    break
    json["recordsTotal"] = tot
    return all
