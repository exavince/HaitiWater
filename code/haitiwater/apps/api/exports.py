from django.http import HttpResponse


def graph(request):
    export_format = request.GET.get('type', None)
    if export_format == "json1":
        export_format = """{
               "jsonarray": [{
                  "name": "Joe",
                  "age": 12
               }, {
                  "name": "Tom",
                  "age": 14
               }]}"""
    if export_format == "json2":
        export_format = """{
               "jsonarray": [{
                  "name": "Joe",
                  "age": 16
               }, {
                  "name": "Tom",
                  "age": 14
               }]}"""
    return HttpResponse(export_format)


def table(request):
    # Todo backend https://datatables.net/manual/server-side
    table_name = request.GET.get('name', None)
    print(table_name)
    if table_name == "water_element":
        print("true")
        export = """{
                  "draw": 1,
                  "recordsTotal": 1,
                  "recordsFiltered": 1,
                  "data": [
                    [
                      "Fontaine",
                      "Centre machin truc",
                      "600",
                      "En service",
                      "60 m³"
                    ]
                  ]
                }"""
    return HttpResponse(export)

