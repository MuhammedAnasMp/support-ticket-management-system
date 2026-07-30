from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from apps.stores.models import Department, SubDepartment, Store, Area
from apps.accounts.models import Role, CustomUser
from apps.maintenance.models import Priority, Status, WorkNature, Ticket
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
            department=self.dept_it, status_name="Open"
        )
        self.status_maint_open = Status.objects.create(
            department=self.dept_maint, status_name="Open"
        )

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
        self.assertFalse(serializer.is_valid())
        self.assertIn("priority", serializer.errors)

    def test_invalid_ticket_status_department(self):
        data = {
            "work_order_no": "WO-IT-004",
            "store": self.store.store_id,
            "department": self.dept_it.department_id,
            "nature": self.nature_it.nature_id,
            "priority": self.priority_it_high.priority_id,
            "status": self.status_maint_open.status_id, # Wrong department status
            "title": "Invalid Status Ticket",
            "description": "Details",
            "created_by": self.manager.user_id
        }
        serializer = TicketWriteSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("status", serializer.errors)

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
        url = '/api/maintenance/tickets/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_only_open_status_permission_returns_only_open(self):
        self.user.user_permissions.add(self.perm_view_open)
        url = '/api/maintenance/tickets/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ticket_id'], self.ticket_open.ticket_id)

    def test_multiple_status_permissions(self):
        self.user.user_permissions.add(self.perm_view_open, self.perm_view_progress)
        url = '/api/maintenance/tickets/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        ticket_ids = [t['ticket_id'] for t in response.data]
        self.assertIn(self.ticket_open.ticket_id, ticket_ids)
        self.assertIn(self.ticket_progress.ticket_id, ticket_ids)
        self.assertNotIn(self.ticket_completed.ticket_id, ticket_ids)

    def test_superuser_bypass(self):
        self.user.is_superuser = True
        self.user.save()
        url = '/api/maintenance/tickets/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)

