import os
import sys
import json
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from apps.accounts.models import CustomUser
from apps.reports.views import export_report
from apps.reports.templates_registry import get_prebuilt_templates

user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first()
templates = get_prebuilt_templates()
tpl = templates[0]

factory = APIRequestFactory()

request_payload = {
    "data_source": tpl['data_source'],
    "definition": tpl['definition'],
    "format": "pdf",
}

print("Testing export_report API endpoint directly...", flush=True)
request = factory.post('/api/reports/export/', data=json.dumps(request_payload), content_type='application/json')
request.user = user

response = export_report(request)
if hasattr(response, 'render') and callable(response.render):
    response.render()

print("Response status code:", response.status_code, flush=True)
if response.status_code != 200:
    print("Response content:", response.content.decode('utf-8'), flush=True)
else:
    print("PDF Export SUCCESS! Length:", len(response.content), "bytes", flush=True)
