import re
from datetime import date, timedelta

from django.http import HttpResponse
from django.core.mail import send_mail

from ..water_network.models import Element, ElementType, Zone
from ..consumers.models import Consumer
from ..report.models import Report, Ticket
from ..financial.models import Invoice, Payment
from django.contrib.auth.models import User, Group
from django.contrib.auth.models import Group
from ..water_network.models import ElementType
from ..api.get_table import *

from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
import json

success_200 = HttpResponse(status=200)


def add_consumer_element(request):
    first_name = request.POST.get("firstname", None)
    last_name = request.POST.get("lastname", None)
    gender = request.POST.get("gender", None)
    address = request.POST.get("address", None)
    sub = request.POST.get("subconsumer", None)
    phone = request.POST.get("phone", None)
    outlet_id = request.POST.get("mainOutlet", None)
    outlet = Element.objects.filter(id=outlet_id)
    if len(outlet) > 0:
        outlet = outlet[0]
    else:
        return HttpResponse("La sortie d'eau spécifiée n'a pas été trouvée, impossible " +
                            "d'ajouter le consommateur", status=404)
    new_c = Consumer(last_name=last_name, first_name=first_name,
                          gender=gender, location=address, phone_number=phone,
                          email="", household_size=sub, water_outlet=outlet) #Creation
    new_c.save()
    if outlet.type != ElementType.INDIVIDUAL.name:
        price, duration = outlet.get_price_and_duration()
        creation = date.today()
        expiration = creation + timedelta(days=duration*30)  # TODO each month
        invoice = Invoice(consumer=new_c, water_outlet=outlet, creation=creation, expiration=expiration, amount=price)
        invoice.save()
    return success_200


def add_network_element(request):
    type = request.POST.get("type", None).upper()
    loc = request.POST.get("localization", None)
    state = request.POST.get("state", None).upper()
    string_type = ElementType[type].value
    zone = request.user.profile.zone
    e = Element(name=string_type+" "+loc, type=type, status=state,
                location=loc, zone=zone) #Creation
    e.save()
    return success_200


def add_report_element(request):
    values = json.loads(request.body.decode("utf-8"))
    for index, elem in enumerate(values["selectedOutlets"]):
        outlets = Element.objects.filter(id=elem)
        if len(outlets) < 1:
            return HttpResponse("La sortie d'eau concernée par ce rapport n'a pas été trouvée", status=404)
        else:
            outlet = outlets[0]
        active = values["isActive"]
        meters_distr = values["details"][index]["cubic"]
        value_meter = values["details"][index]["perCubic"]
        month = values["month"]
        year = 2018 #TODO : Temporary
        recette = values["details"][index]["bill"]
        report_line = Report(water_outlet=outlet, was_active=active,
                             quantity_distributed=meters_distr, price=value_meter,
                             month=month, year=year, recette=recette)
        report_line.save()
        if outlet.type == ElementType.INDIVIDUAL.name:  # Create an invoice for individual outlets
            consumer = Consumer.objects.filter(water_outlet=outlet)[0]
            amount = int(meters_distr) * int(value_meter)
            creation = date.today()
            expiration = creation + timedelta(days=30)
            invoice = Invoice(consumer=consumer, water_outlet=outlet, creation=creation, expiration=expiration, amount=amount)
            invoice.save()
    return success_200


def add_zone_element(request):
    name = request.POST.get("name", None)
    fountain_price = request.POST.get("fountain-price", 0)
    fountain_duration = request.POST.get("fountain-duration", 1)
    kiosk_price = request.POST.get("kiosk-price", 0)
    kiosk_duration = request.POST.get("kiosk-duration", 1)
    print(fountain_price, fountain_duration, kiosk_price, kiosk_duration)
    if request.user and request.user.profile.zone: #If user is connected and zone manager
        result = Zone.objects.filter(name=request.user.profile.zone)
        if len(result) == 1:
            super = result[0]
            to_add = Zone(name=name, superzone=super, subzones=[name],
                          fountain_price=fountain_price, fountain_duration=fountain_duration,
                          kiosk_price=kiosk_price, kiosk_duration=kiosk_duration)
            up = True
            while up:
                super.subzones.append(name)
                super.save()
                super = super.superzone
                if super == None:
                    up = False
            to_add.save()
            return success_200
        else:
            return HttpResponse("Impossible de trouver la zone gérée pas l'utilisateur", status=404)
    else:
        return HttpResponse("Impossible d'ajouter la zone. Etes-vous sûr d'être connecté ?", status=500)


def add_collaborator_element(request):
    first_name = request.POST.get("firstname", None)
    last_name = request.POST.get("lastname", None)
    username = request.POST.get("id", None)
    password = User.objects.make_random_password() #New random password
    email = request.POST.get("email", None)
    new_user = User.objects.create_user(username=username, email=email, password=password,
                                    first_name=first_name, last_name=last_name)
    type = request.POST.get("type", None)
    if type == "fountain-manager":
        water_out = request.POST.get("outlets", None)
        water_out = water_out.split(',')
        if len(water_out) < 1:
            return HttpResponse("Vous n'avez pas choisi de fontaine a attribuer !", status=500)
        elif len(water_out) > 1:
            res = Element.objects.filter(id__in=water_out)
        else:
            res = Element.objects.filter(id=water_out[0])
        if len(res) > 0:
            for outlet in res:
                new_user.profile.outlets.append(outlet.id)
        else:
            return HttpResponse("Impossible d'attribuer cette fontaine au gestionnaire", status=404)
        my_group = Group.objects.get(name='Gestionnaire de fontaine')
        my_group.user_set.add(new_user)
    elif type == "zone-manager":
        zone = request.POST.get("zone", None)
        res = Zone.objects.filter(id=zone)
        if len(res) == 1:
            new_user.profile.zone = res[0]
        else:
            return HttpResponse("Impossible d'attribuer cette zone au gestionnaire", status=404)
        my_group = Group.objects.get(name='Gestionnaire de zone')
        my_group.user_set.add(new_user)
    else:
        new_user.delete()
        return HttpResponse("Impossible d'ajouter l'utilisateur", status=500)
    send_mail(
        'Bienvenue sur haitiwater !',
        'Bienvenue sur haitiwater. Voici votre mot de passe autogénéré : ' + password +
        '\nVeuillez vous connecter pour le modifier.\nPour rappel, ' +
        'votre identifiant est : ' + username,
        '',
        [email],
        fail_silently=False,
    )
    new_user.save()
    return success_200


def add_ticket_element(request):
    id = request.POST.get("id_outlet", None)
    outlets = Element.objects.filter(id=id)
    if len(outlets) < 1:
        return HttpResponse("Impossible de trouver la sortie d'eau correspondante au ticket", status=404)
    else:
        outlet = outlets[0]
        typeR = request.POST.get("type", None).upper()
        comment = request.POST.get("comment", None)
        urgency = request.POST.get('urgency', None).upper()
        image = request.FILES.get("picture", None)
        ticket = Ticket(water_outlet=outlet, type=typeR, comment=comment,
                        urgency=urgency, image=image)
        ticket.save()
    return success_200


def add_payment_element(request):
    id_consumer = request.POST.get("id_consumer", None)
    consumer = Consumer.objects.get(id=id_consumer)
    if not consumer:
        return HttpResponse("Impossible de trouver l'utilisateur", status=404)
    outlet = consumer.water_outlet
    amount = request.POST.get("amount", None)
    payment = Payment(consumer=consumer, water_outlet=outlet, amount=amount)
    payment.save()
    return success_200
