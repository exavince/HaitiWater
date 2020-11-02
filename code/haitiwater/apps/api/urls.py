from django.conf.urls import url

from . import exports, offline

urlpatterns = [
    url(r'graph/$', exports.graph, name='graph'),
    url(r'table/$', exports.table, name='table'),
    url(r'add/$', exports.add_element, name='add'),
    url(r'remove/$', exports.remove_element, name='remove'),
    url(r'gis/$', exports.gis_infos, name='network_gis'),
    url(r'edit/$', exports.edit_element, name='edit'),
    url(r'report/$', exports.add_report_element, name='report_add'),
    url(r'log/$', exports.compute_logs, name='compute_logs'),
    url(r'details/$', exports.details, name="details"),
    url(r'outlets/', exports.outlets, name="outlets"),
    url(r'get-zone/', offline.get_zone, name="get-zone"),
    url(r'check-authentication', offline.check_authentication, name="check_authentication"),
]
