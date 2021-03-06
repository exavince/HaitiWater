from django.http import HttpResponse
from django.template import loader
from haitiwater.settings import PROJECT_VERSION, PROJECT_NAME
from django.contrib.auth.decorators import login_required


@login_required(login_url='/login/')
def index(request):
    template = loader.get_template('logs.html')
    context = {
        'project_version': PROJECT_VERSION,
        'project_name': PROJECT_NAME,
    }
    return HttpResponse(template.render(context, request))

