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
