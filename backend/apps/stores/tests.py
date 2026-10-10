from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.stores.models import Store, StoreType

User = get_user_model()


class StoreManagerSignalTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="manager1",
            employee_no="EMP001",
            full_name="Manager One"
        )
        self.user2 = User.objects.create_user(
            username="manager2",
            employee_no="EMP002",
            full_name="Manager Two"
        )
        self.store1 = Store.objects.create(
            store_id="ST001",
            store_name="Store One",
            type=StoreType.SUPER_MARKET
        )
        self.store2 = Store.objects.create(
            store_id="ST002",
            store_name="Store Two",
            type=StoreType.HYPER_MARKET
        )
        self.other_store = Store.objects.create(
            store_id="ST003",
            store_name="Other Store",
            type=StoreType.SUPER_MARKET
        )

    def test_assign_manager_adds_to_accessible_stores(self):
        self.store1.manager = self.user1
        self.store1.save()

        self.assertIn(self.store1, self.user1.accessible_stores.all())

    def test_change_manager_removes_old_store_keeps_other_accessible_stores(self):
        # Setup: user1 manages store1 and also has manual access to other_store
        self.store1.manager = self.user1
        self.store1.save()
        self.user1.accessible_stores.add(self.other_store)

        self.assertIn(self.store1, self.user1.accessible_stores.all())
        self.assertIn(self.other_store, self.user1.accessible_stores.all())

        # Change store1 manager to user2
        self.store1.manager = self.user2
        self.store1.save()

        # store1 must be removed from user1.accessible_stores
        self.assertNotIn(self.store1, self.user1.accessible_stores.all())
        # other_store must remain in user1.accessible_stores
        self.assertIn(self.other_store, self.user1.accessible_stores.all())

        # user2 should now have store1
        self.assertIn(self.store1, self.user2.accessible_stores.all())

    def test_reassign_manager_to_another_store(self):
        # User1 manages store1 and has access to other_store
        self.store1.manager = self.user1
        self.store1.save()
        self.user1.accessible_stores.add(self.other_store)

        # Move user1 to manage store2
        self.store2.manager = self.user1
        self.store2.save()

        # store1 (previous store) removed from user1.accessible_stores
        self.assertNotIn(self.store1, self.user1.accessible_stores.all())
        # store2 (new store) added to user1.accessible_stores
        self.assertIn(self.store2, self.user1.accessible_stores.all())
        # other_store preserved in user1.accessible_stores
        self.assertIn(self.other_store, self.user1.accessible_stores.all())


from rest_framework.test import APITestCase
from apps.accounts.models import Role, CustomUser
from apps.stores.models import Department, SubDepartment, StoreDepartmentThrottle


class ThrottleSettingsAPITests(APITestCase):
    def setUp(self):
        self.role_admin = Role.objects.create(role_name="Administrator")
        self.role_office = Role.objects.create(role_name="Office Administrator")

        self.dept_it = Department.objects.create(department_name="IT Support", location_approval_throttle=5)
        self.dept_maint = Department.objects.create(department_name="Maintenance", location_approval_throttle=5)

        self.subdept_it = SubDepartment.objects.create(department=self.dept_it, sub_department_name="IT Helpdesk")
        self.subdept_maint = SubDepartment.objects.create(department=self.dept_maint, sub_department_name="Electrical")

        self.store = Store.objects.create(store_id="ST100", store_name="Store 100")

        self.admin = CustomUser.objects.create_user(
            username="admin_user", email="admin@test.com", password="pwd",
            full_name="Admin", role=self.role_admin
        )
        self.office_admin_it = CustomUser.objects.create_user(
            username="office_it", email="office_it@test.com", password="pwd",
            full_name="Office Admin IT", role=self.role_office
        )
        self.office_admin_it.sub_departments.add(self.subdept_it)

    def test_admin_can_update_any_department_throttle(self):
        self.client.force_authenticate(user=self.admin)
        url = "/api/stores/throttle-settings/"

        # Admin updates IT
        resp = self.client.post(url, {"type": "department", "department_id": self.dept_it.department_id, "throttle_limit": 8})
        self.assertEqual(resp.status_code, 200)

        # Admin updates Maintenance
        resp2 = self.client.post(url, {"type": "department", "department_id": self.dept_maint.department_id, "throttle_limit": 12})
        self.assertEqual(resp2.status_code, 200)

        self.dept_it.refresh_from_db()
        self.dept_maint.refresh_from_db()
        self.assertEqual(self.dept_it.location_approval_throttle, 8)
        self.assertEqual(self.dept_maint.location_approval_throttle, 12)

    def test_office_admin_can_update_their_own_department_throttle(self):
        self.client.force_authenticate(user=self.office_admin_it)
        url = "/api/stores/throttle-settings/"

        # Office Admin IT updates IT department -> Allowed
        resp = self.client.post(url, {"type": "department", "department_id": self.dept_it.department_id, "throttle_limit": 7})
        self.assertEqual(resp.status_code, 200)
        self.dept_it.refresh_from_db()
        self.assertEqual(self.dept_it.location_approval_throttle, 7)

    def test_office_admin_cannot_update_other_department_throttle(self):
        self.client.force_authenticate(user=self.office_admin_it)
        url = "/api/stores/throttle-settings/"

        # Office Admin IT attempts to update Maintenance department -> 403 Forbidden
        resp = self.client.post(url, {"type": "department", "department_id": self.dept_maint.department_id, "throttle_limit": 15})
        self.assertEqual(resp.status_code, 403)
        self.assertIn("own assigned department", resp.data.get("error", ""))

    def test_office_admin_cannot_set_global_store_throttle(self):
        self.client.force_authenticate(user=self.office_admin_it)
        url = "/api/stores/throttle-settings/"

        # Office Admin attempts to set global store throttle -> 403 Forbidden
        resp = self.client.post(url, {"type": "store", "store_id": self.store.store_id, "throttle_limit": 20})
        self.assertEqual(resp.status_code, 403)

    def test_office_admin_can_set_store_department_throttle_for_their_department(self):
        self.client.force_authenticate(user=self.office_admin_it)
        url = "/api/stores/throttle-settings/"

        # Office Admin sets store override for IT department -> Allowed
        resp = self.client.post(url, {
            "type": "store_department",
            "store_id": self.store.store_id,
            "department_id": self.dept_it.department_id,
            "throttle_limit": 10
        })
        self.assertEqual(resp.status_code, 200)

        # But not for Maintenance department -> 403 Forbidden
        resp_maint = self.client.post(url, {
            "type": "store_department",
            "store_id": self.store.store_id,
            "department_id": self.dept_maint.department_id,
            "throttle_limit": 10
        })
        self.assertEqual(resp_maint.status_code, 403)

