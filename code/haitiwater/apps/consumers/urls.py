from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('offline', views.offline, name='offline'),
]
