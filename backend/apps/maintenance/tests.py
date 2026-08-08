from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from apps.stores.models import Department, SubDepartment, Store, Area
from apps.accounts.models import Role, CustomUser
from apps.maintenance.models import Priority, Status, WorkNature, Ticket, TicketChatMessage
from apps.common.models import MediaCategory, Media
from apps.finance.models import ExpenseType, Expense
from apps.maintenance.serializers import TicketWriteSerializer
from apps.common.serializers import MediaWriteSerializer
from apps.finance.serializers import ExpenseWriteSerializer, ExpenseTypeWriteSerializer
from rest_framework.exceptions import ValidationError


class DepartmentWiseValidationTestCase(TestCase):
    def setUp(self):
        # Create roles
        self.role_mgr = Role.objects.create(role_name="Store Manager")
        self.role_tech = Role.objects.create(role_name="Technician")

        # Create departments
        self.dept_it = Department.objects.create(department_name="Information Technology")
        self.dept_maint = Department.objects.create(department_name="Maintenance")

        # Create sub-departments
        self.subdept_it = SubDepartment.objects.create(
            department=self.dept_it, sub_department_name="Software Systems"
        )
        self.subdept_maint = SubDepartment.objects.create(
            department=self.dept_maint, sub_department_name="Electrical"
        )

        # Create areas and stores
        self.area = Area.objects.create(area_name="Capital Area")
        self.store = Store.objects.create(store_id="S-001", store_name="Store-001", area=self.area)

        # Create users
        self.manager = CustomUser.objects.create_user(
            username="manager1", email="m1@test.com", password="pwd",
            full_name="Mgr One", role=self.role_mgr
        )
        self.manager.accessible_stores.add(self.store)
        self.worker = CustomUser.objects.create_user(
            username="worker1", email="w1@test.com", password="pwd",
            full_name="Worker One", role=self.role_tech
        )

        # Create Priorities
        self.priority_it_high = Priority.objects.create(
            department=self.dept_it, priority_name="High", level=2
        )
        self.priority_maint_high = Priority.objects.create(
            department=self.dept_maint, priority_name="High", level=2
        )

        # Create Statuses
        self.status_it_open = Status.objects.create(
            status_name="Open"
        )
        self.status_maint_open = self.status_it_open


        # Create Work Natures
        self.nature_it = WorkNature.objects.create(
            nature_name="Database Connections", sub_department=self.subdept_it,
            default_priority=self.priority_it_high
        )
        self.nature_maint = WorkNature.objects.create(
            nature_name="Generator Fault", sub_department=self.subdept_maint,
            default_priority=self.priority_maint_high
        )

        # Create a ticket (valid IT ticket)
        self.ticket_it = Ticket.objects.create(
            work_order_no="WO-IT-001", store=self.store, department=self.dept_it,
            nature=self.nature_it, priority=self.priority_it_high, status=self.status_it_open,
            title="Database Connection Lag", description="Lagging severely",
            created_by=self.manager
        )

        # Create Media Categories
        self.cat_it_issue = MediaCategory.objects.create(
            department=self.dept_it, category_name="Issue Screenshot"
        )
        self.cat_maint_issue = MediaCategory.objects.create(
            department=self.dept_maint, category_name="Issue Photo"
        )

        # Create Expense Types
        self.exp_type_it = ExpenseType.objects.create(
            department=self.dept_it, expense_name="Software license"
        )
        self.exp_type_maint = ExpenseType.objects.create(
            department=self.dept_maint, expense_name="Spare parts"
        )

    def test_valid_ticket_serializer(self):
        data = {
            "work_order_no": "WO-IT-002",
            "store": self.store.store_id,
            "department": self.dept_it.department_id,
            "nature": self.nature_it.nature_id,
            "priority": self.priority_it_high.priority_id,
            "status": self.status_it_open.status_id,
            "title": "Another IT issue",
            "description": "Details",
            "created_by": self.manager.user_id
        }
        serializer = TicketWriteSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_ticket_priority_department(self):
        data = {
            "work_order_no": "WO-IT-003",
            "store": self.store.store_id,
            "department": self.dept_it.department_id,
            "nature": self.nature_it.nature_id,
            "priority": self.priority_maint_high.priority_id, # Wrong department priority
            "status": self.status_it_open.status_id,
            "title": "Invalid Priority Ticket",
            "description": "Details",
            "created_by": self.manager.user_id
        }
        serializer = TicketWriteSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['priority'].department, self.dept_it)

    def test_status_creation(self):
        # Placeholder since status is global
        pass

    def test_invalid_ticket_nature_department(self):
        data = {
            "work_order_no": "WO-IT-005",
            "store": self.store.store_id,
            "department": self.dept_it.department_id,
            "nature": self.nature_maint.nature_id, # Wrong department nature
            "priority": self.priority_it_high.priority_id,
            "status": self.status_it_open.status_id,
            "title": "Invalid Nature Ticket",
            "description": "Details",
            "created_by": self.manager.user_id
        }
        serializer = TicketWriteSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("nature", serializer.errors)

    def test_media_category_department_validation(self):
        # Create SimpleUploadedFiles for test upload
        file_valid = SimpleUploadedFile("it_screenshot.png", b"file_content_1", content_type="image/png")
        file_invalid = SimpleUploadedFile("maint_photo.png", b"file_content_2", content_type="image/png")

        # Test valid Media (matching IT ticket and IT category)
        media_valid_data = {
            "ticket": self.ticket_it.ticket_id,
            "uploaded_by": self.manager.user_id,
            "category": self.cat_it_issue.category_id,
            "file_name": "it_screenshot.png",
            "file_url": file_valid
        }
        serializer = MediaWriteSerializer(data=media_valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # Test invalid Media (matching IT ticket with Maintenance category)
        media_invalid_data = {
            "ticket": self.ticket_it.ticket_id,
            "uploaded_by": self.manager.user_id,
            "category": self.cat_maint_issue.category_id,
            "file_name": "maint_photo.png",
            "file_url": file_invalid
        }
        serializer = MediaWriteSerializer(data=media_invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)

    def test_expense_type_department_validation(self):
        # Test valid Expense
        expense_valid_data = {
            "ticket": self.ticket_it.ticket_id,
            "worker": self.worker.user_id,
            "expense_type": self.exp_type_it.expense_type_id,
            "amount": "120.00",
            "expense_date": "2026-07-16"
        }
        serializer = ExpenseWriteSerializer(data=expense_valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # Test invalid Expense (matching IT ticket with Maintenance expense type)
        expense_invalid_data = {
            "ticket": self.ticket_it.ticket_id,
            "worker": self.worker.user_id,
            "expense_type": self.exp_type_maint.expense_type_id,
            "amount": "120.00",
            "expense_date": "2026-07-16"
        }
        serializer = ExpenseWriteSerializer(data=expense_invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("expense_type", serializer.errors)

    def test_expense_type_parent_department_validation(self):
        # Try to make a parent expense type of one department the parent of a sub-type of another department
        data = {
            "department": self.dept_maint.department_id,
            "expense_name": "Maint Sub Type",
            "parent": self.exp_type_it.expense_type_id # Different department
        }
        serializer = ExpenseTypeWriteSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parent", serializer.errors)


class TicketStatusFilteringAPITests(APITestCase):
    def setUp(self):
        # Create standard test setup
        self.role_mgr = Role.objects.create(role_name="Store Manager")
        self.dept_maint = Department.objects.create(department_name="Maintenance")
        self.area = Area.objects.create(area_name="Capital Area")
        self.store = Store.objects.create(store_id="S-001", store_name="Store-001", area=self.area)
        
        self.user = CustomUser.objects.create_user(
            username="manager1", email="m1@test.com", password="pwd",
            full_name="Mgr One", role=self.role_mgr
        )
        self.user.accessible_stores.add(self.store)
        
        self.priority = Priority.objects.create(
            department=self.dept_maint, priority_name="High", level=2
        )
        
        self.status_open = Status.objects.create(status_name="Open")
        self.status_progress = Status.objects.create(status_name="In Progress")
        self.status_completed = Status.objects.create(status_name="Completed")
        
        self.subdept_maint = SubDepartment.objects.create(
            department=self.dept_maint, sub_department_name="Electrical"
        )
        self.user.sub_departments.add(self.subdept_maint)
        self.nature = WorkNature.objects.create(
            nature_name="Generator Fault", sub_department=self.subdept_maint,
            default_priority=self.priority
        )

        self.ticket_open = Ticket.objects.create(
            work_order_no="WO-001", store=self.store, department=self.dept_maint,
            nature=self.nature, priority=self.priority, status=self.status_open,
            title="Open Ticket", description="Desc", created_by=self.user
        )
        self.ticket_progress = Ticket.objects.create(
            work_order_no="WO-002", store=self.store, department=self.dept_maint,
            nature=self.nature, priority=self.priority, status=self.status_progress,
            title="In Progress Ticket", description="Desc", created_by=self.user
        )
        self.ticket_completed = Ticket.objects.create(
            work_order_no="WO-003", store=self.store, department=self.dept_maint,
            nature=self.nature, priority=self.priority, status=self.status_completed,
            title="Completed Ticket", description="Desc", created_by=self.user
        )

        ticket_ct = ContentType.objects.get_for_model(Ticket)
        self.perm_view_open = Permission.objects.get(codename='can_view_open_ticket', content_type=ticket_ct)
        self.perm_view_progress = Permission.objects.get(codename='can_view_in_progress_ticket', content_type=ticket_ct)
        self.perm_view_completed = Permission.objects.get(codename='can_view_completed_ticket', content_type=ticket_ct)
        
        self.client.force_authenticate(user=self.user)

    def test_no_status_permissions_returns_nothing(self):
        url = '/api/maintenance/ticket/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 0)

    def test_only_open_status_permission_returns_only_open(self):
        self.user.user_permissions.add(self.perm_view_open)
        url = '/api/maintenance/ticket/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['ticket_id'], self.ticket_open.ticket_id)

    def test_multiple_status_permissions(self):
        self.user.user_permissions.add(self.perm_view_open, self.perm_view_progress)
        url = '/api/maintenance/ticket/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)
        ticket_ids = [t['ticket_id'] for t in response.data['results']]
        self.assertIn(self.ticket_open.ticket_id, ticket_ids)
        self.assertIn(self.ticket_progress.ticket_id, ticket_ids)
        self.assertNotIn(self.ticket_completed.ticket_id, ticket_ids)

    def test_superuser_bypass(self):
        self.user.is_superuser = True
        self.user.save()
        url = '/api/maintenance/ticket/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 3)


from apps.maintenance.models import StatusChangeRule, Allocation
from apps.maintenance.utils import get_value_from_path, compare_values, change_status
from django.core.exceptions import ValidationError

class StatusChangeRuleTestCase(TestCase):
    def setUp(self):
        self.area = Area.objects.create(area_name="Test Area")
        self.store = Store.objects.create(store_id="S-002", store_name="Store-002", area=self.area)
        self.dept = Department.objects.create(department_name="Test Dept")
        self.subdept = SubDepartment.objects.create(department=self.dept, sub_department_name="Sub-Dept")
        self.user = CustomUser.objects.create_user(username="testuser2", email="t2@test.com", password="pwd", full_name="Test User 2")
        self.priority = Priority.objects.create(department=self.dept, priority_name="Normal", level=1)
        self.priority_high = Priority.objects.create(department=self.dept, priority_name="High", level=2)
        
        self.status_open = Status.objects.create(status_name="Open")
        self.status_progress = Status.objects.create(status_name="In Progress")
        self.status_completed = Status.objects.create(status_name="Completed")
        
        self.nature = WorkNature.objects.create(nature_name="Test Nature", sub_department=self.subdept, default_priority=self.priority)
        
        self.ticket = Ticket.objects.create(
            work_order_no="WO-TEST-999",
            store=self.store,
            department=self.dept,
            nature=self.nature,
            priority=self.priority,
            status=self.status_open,
            title="Broken Light",
            description="Office light is flickering",
            created_by=self.user
        )

    def test_get_value_from_path_simple(self):
        self.assertEqual(get_value_from_path(self.ticket, "title"), "Broken Light")
        self.assertEqual(get_value_from_path(self.ticket, "store.store_name"), "Store-002")
        self.assertEqual(get_value_from_path(self.ticket, "created_by.username"), "testuser2")

    def test_get_value_from_path_related_manager(self):
        allocations_manager = get_value_from_path(self.ticket, "allocations")
        self.assertFalse(allocations_manager.exists())
        
        alloc = Allocation.objects.create(ticket=self.ticket, worker=self.user, planned_hours=2)
        self.assertTrue(allocations_manager.exists())

    def test_get_value_from_path_nested_related(self):
        Allocation.objects.create(ticket=self.ticket, worker=self.user, planned_hours=2)
        self.assertEqual(get_value_from_path(self.ticket, "allocations.worker.username"), ["testuser2"])

    def test_compare_values(self):
        self.assertTrue(compare_values("Store-002", "Store-002"))
        self.assertFalse(compare_values("Store-002", "Store-003"))
        self.assertTrue(compare_values(["Active", "Pending"], "Active"))
        self.assertFalse(compare_values(["Active", "Pending"], "Closed"))

    def test_check_rule_validation_field_success(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="check",
            type="field",
            path="priority.priority_name",
            value="High",
            message="Priority must be High"
        )
        with self.assertRaisesMessage(ValidationError, "Priority must be High"):
            self.ticket.status = self.status_progress
            self.ticket.clean()
            
        self.ticket.priority = self.priority_high
        self.ticket.status = self.status_progress
        self.ticket.clean()
        self.ticket.save()
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, self.status_progress)

    def test_check_rule_validation_field_empty(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="check",
            type="field",
            path="closed_by",
            value="",
            message="Closed by user required"
        )
        with self.assertRaisesMessage(ValidationError, "Closed by user required"):
            self.ticket.status = self.status_progress
            self.ticket.clean()
            
        self.ticket.closed_by = self.user
        self.ticket.status = self.status_progress
        self.ticket.clean()

    def test_check_rule_validation_related_empty(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="check",
            type="related",
            path="allocations",
            value="",
            message="At least one worker must be allocated"
        )
        with self.assertRaisesMessage(ValidationError, "At least one worker must be allocated"):
            self.ticket.status = self.status_progress
            self.ticket.clean()
            
        Allocation.objects.create(ticket=self.ticket, worker=self.user, planned_hours=1)
        self.ticket.status = self.status_progress
        self.ticket.clean()

    def test_delete_rule_cleanup(self):
        alloc = Allocation.objects.create(ticket=self.ticket, worker=self.user, planned_hours=1)
        
        rule = StatusChangeRule.objects.create(
            from_status=self.status_progress,
            to_status=self.status_completed,
            mode="delete",
            type="related",
            path="allocations",
            message="Clean allocations"
        )
        
        self.ticket.status = self.status_progress
        self.ticket.save()
        
        self.ticket.status = self.status_completed
        self.ticket.save()
        
        self.assertFalse(Allocation.objects.filter(pk=alloc.pk).exists())

    def test_set_rule_field_execution(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="set",
            type="field",
            path="title",
            value="Status has been set!"
        )
        self.ticket.status = self.status_progress
        self.ticket.clean()
        self.assertEqual(self.ticket.title, "Status has been set!")

    def test_set_rule_relation_execution(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="set",
            type="field",
            path="priority",
            value="Normal"
        )
        self.ticket.priority = self.priority_high
        self.ticket.save()
        
        self.ticket.status = self.status_progress
        self.ticket.clean()
        self.assertEqual(self.ticket.priority, self.priority)

    def test_warning_rule_execution(self):
        rule = StatusChangeRule.objects.create(
            from_status=self.status_open,
            to_status=self.status_progress,
            mode="warning",
            type="field",
            path="priority.priority_name",
            value="High",
            message="Warning: Priority is not High!"
        )
        self.ticket.status = self.status_progress
        self.ticket.save()
        self.assertEqual(self.ticket.status, self.status_progress)
        self.assertIn("Warning: Priority is not High!", self.ticket._deleted_warnings)


class TicketChatMessageAPITests(APITestCase):
    def setUp(self):
        self.role_mgr = Role.objects.create(role_name="Store Manager")
        self.dept_maint = Department.objects.create(department_name="Maintenance")
        self.area = Area.objects.create(area_name="Capital Area")
        self.store = Store.objects.create(store_id="S-001", store_name="Store-001", area=self.area)
        
        self.user = CustomUser.objects.create_user(
            username="manager1", email="m1@test.com", password="pwd",
            full_name="Mgr One", role=self.role_mgr
        )
        self.user.accessible_stores.add(self.store)
        self.client.force_authenticate(user=self.user)
        
        self.priority = Priority.objects.create(
            department=self.dept_maint, priority_name="High", level=2
        )
        
        self.status_open = Status.objects.create(status_name="Open")
        self.subdept_maint = SubDepartment.objects.create(
            department=self.dept_maint, sub_department_name="Electrical"
        )
        self.nature = WorkNature.objects.create(
            nature_name="Generator Fault", sub_department=self.subdept_maint,
            default_priority=self.priority
        )

        self.ticket = Ticket.objects.create(
            work_order_no="WO-001", store=self.store, department=self.dept_maint,
            nature=self.nature, priority=self.priority, status=self.status_open,
            title="Open Ticket", description="Desc", created_by=self.user
        )

    def test_create_chat_message(self):
        url = "/api/maintenance/ticketchat/"
        data = {
            "ticket": self.ticket.ticket_id,
            "sender": self.user.user_id,
            "message_text": "Hello team!"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["message_text"], "Hello team!")
        self.assertEqual(response.data["sender"]["user_id"], self.user.user_id)

    def test_list_chat_messages(self):
        msg = TicketChatMessage.objects.create(
            ticket=self.ticket,
            sender=self.user,
            message_text="Test message"
        )
        url = f"/api/maintenance/ticketchat/?ticket={self.ticket.ticket_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["message_text"], "Test message")



