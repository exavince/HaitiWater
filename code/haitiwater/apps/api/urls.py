from django.conf.urls import url

from . import exports

urlpatterns = [
    url(r'graph/$', exports.graph, name='graph'),
    url(r'table/$', exports.table, name='table'),
    url(r'add/$', exports.add_network_element, name='add'),
]
