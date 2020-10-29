from django.urls import path
from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url('offline', views.index_offline, name='offline'),
    url('gis', views.gis, name='gis'),
]
