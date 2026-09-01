import os
import sys
import django

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import Role, CustomUser
from apps.stores.models import Store
from apps.stores.views import StoreViewSet
from rest_framework.test import APIRequestFactory

def main():
    print("=== VERIFYING STORE VIEWSET ALL STORES RETURN ===")
    factory = APIRequestFactory()

    total_stores_in_db = Store.objects.count()
    print(f"Total stores in database: {total_stores_in_db}")

    # 1. Test Office Administrator Role
    office_role, _ = Role.objects.get_or_create(role_name="Office Administrator")
    office_user, _ = CustomUser.objects.get_or_create(
        username="test_office_admin",
        defaults={"full_name": "Test Office Admin", "role": office_role}
    )
    office_user.role = office_role
    office_user.save()

    request = factory.get('/stores/store/?all=true')
    request.user = office_user

    view = StoreViewSet()
    view.request = request
    view.format_kwarg = None

    qs = view.get_queryset()
    print(f"StoreViewSet queryset count for Office Administrator with ?all=true: {qs.count()}")
    if qs.count() == total_stores_in_db:
        print("PASS: Office Administrator gets 100% of all stores!")
    else:
        print(f"FAIL: Expected {total_stores_in_db}, got {qs.count()}")

    # 2. Test Store Manager with ?all=true
    sm_role, _ = Role.objects.get_or_create(role_name="Store Manager")
    sm_user, _ = CustomUser.objects.get_or_create(
        username="test_store_manager",
        defaults={"full_name": "Test Store Manager", "role": sm_role}
    )
    sm_user.role = sm_role
    sm_user.save()

    request_sm = factory.get('/stores/store/?all=true')
    request_sm.user = sm_user

    view_sm = StoreViewSet()
    view_sm.request = request_sm
    view_sm.format_kwarg = None

    qs_sm = view_sm.get_queryset()
    print(f"StoreViewSet queryset count for Store Manager with ?all=true: {qs_sm.count()}")
    if qs_sm.count() == total_stores_in_db:
        print("PASS: Store Manager with ?all=true gets 100% of all stores for workforce allocation!")
    else:
        print(f"FAIL: Expected {total_stores_in_db}, got {qs_sm.count()}")

if __name__ == '__main__':
    main()
