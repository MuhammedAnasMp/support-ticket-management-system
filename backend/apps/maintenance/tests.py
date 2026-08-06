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
from apps.maintenance.utils import validate_ticket_required_fields, clear_ticket_fields

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


from apps.maintenance.forms import StatusRequiredFieldForm
from apps.maintenance.models import StatusRequiredField

class StatusRequiredFieldFormTestCase(TestCase):
    def setUp(self):
        self.status = Status.objects.create(status_name="In Progress")
        self.status_to = Status.objects.create(status_name="Completed")

    def test_empty_form(self):
        form = StatusRequiredFieldForm()
        self.assertIn("target", form.fields)
        self.assertIn("optional_key", form.fields)
        self.assertTrue(len(form.fields["target"].choices) > 0)
        self.assertEqual(form.fields["optional_key"].choices, [("", "---------")])

    def test_bound_form_relation_target(self):
        data = {
            "from_status": self.status.pk,
            "to_status": self.status_to.pk,
            "target": "relation:created_by",
            "optional_key": "full_name",
            "can_or_cant": "can"
        }
        form = StatusRequiredFieldForm(data=data)
        choices_keys = [c[0] for c in form.fields["optional_key"].choices]
        self.assertIn("full_name", choices_keys)
        self.assertIn("username", choices_keys)
        self.assertTrue(form.is_valid(), form.errors)

    def test_bound_form_field_target(self):
        data = {
            "from_status": self.status.pk,
            "to_status": self.status_to.pk,
            "target": "field:title",
            "optional_key": "",
            "can_or_cant": "can"
        }
        form = StatusRequiredFieldForm(data=data)
        self.assertEqual(form.fields["optional_key"].choices, [("", "---------")])
        self.assertTrue(form.is_valid(), form.errors)
        instance = form.save(commit=False)
        self.assertEqual(instance.target_type, "field")
        self.assertEqual(instance.target_name, "title")
        self.assertIsNone(instance.optional_key)

    def test_bound_form_foreign_key_field_target(self):
        data = {
            "from_status": self.status.pk,
            "to_status": self.status_to.pk,
            "target": "field:store",
            "optional_key": "",
            "can_or_cant": "can"
        }
        form = StatusRequiredFieldForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        instance = form.save(commit=False)
        self.assertEqual(instance.target_type, "field")
        self.assertEqual(instance.target_name, "store")
        self.assertIsNone(instance.optional_key)

    def test_bound_form_foreign_key_field_target_with_optional_value(self):
        data = {
            "from_status": self.status.pk,
            "to_status": self.status_to.pk,
            "target": "field:store",
            "optional_key": "store_name",
            "can_or_cant": "can"
        }
        form = StatusRequiredFieldForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        instance = form.save(commit=False)
        self.assertEqual(instance.target_type, "relation")
        self.assertEqual(instance.target_name, "store")
        self.assertEqual(instance.optional_key, "store_name")


from apps.maintenance.forms import StatusClearFieldForm
from apps.maintenance.models import StatusClearField

class StatusClearFieldFormTestCase(TestCase):
    def setUp(self):
        self.status1 = Status.objects.create(status_name="In Progress")
        self.status2 = Status.objects.create(status_name="Completed")

    def test_empty_form(self):
        form = StatusClearFieldForm()
        self.assertIn("target", form.fields)
        self.assertTrue(len(form.fields["target"].choices) > 0)

    def test_bound_form(self):
        data = {
            "from_status": self.status1.pk,
            "to_status": self.status2.pk,
            "target": "field:title",
            "can_or_cant": "can"
        }
        form = StatusClearFieldForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        instance = form.save(commit=False)
        self.assertEqual(instance.target_type, "field")
        self.assertEqual(instance.target_name, "title")


class StatusRequiredFieldValidationTestCase(TestCase):
    def setUp(self):
        self.status = Status.objects.create(status_name="In Progress")
        self.area = Area.objects.create(area_name="Capital Area")
        self.store = Store.objects.create(store_id="M1", store_name="Main Store", area=self.area)
        self.dept = Department.objects.create(department_name="IT")
        self.subdept = SubDepartment.objects.create(department=self.dept, sub_department_name="Software Systems")
        self.user = CustomUser.objects.create(username="testuser", full_name="Test User", active=True)
        self.priority = Priority.objects.create(department=self.dept, priority_name="High", level=2)
        self.nature = WorkNature.objects.create(
            nature_name="Hardware",
            sub_department=self.subdept,
            default_priority=self.priority
        )
        self.ticket = Ticket.objects.create(
            work_order_no="WO123",
            store=self.store,
            department=self.dept,
            nature=self.nature,
            priority=self.priority,
            status=self.status,
            title="Fix Router",
            description="Router is broken",
            created_by=self.user,
        )

    def test_simple_field_validation_success(self):
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="field",
            target_name="title",
        )
        self.assertIsNone(req.validate_ticket(self.ticket))

    def test_simple_field_validation_failure(self):
        # approved_by is None initially on the ticket
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="field",
            target_name="approved_by",
            message="Ticket must be approved before moving to this status."
        )
        error = req.validate_ticket(self.ticket)
        self.assertEqual(error, "Ticket must be approved before moving to this status.")

    def test_relation_key_validation_success(self):
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="relation",
            target_name="created_by",
            optional_key="full_name",
        )
        self.assertIsNone(req.validate_ticket(self.ticket))

    def test_relation_key_validation_failure(self):
        self.user.full_name = ""
        self.user.save()
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="relation",
            target_name="created_by",
            optional_key="full_name",
        )
        self.assertIsNotNone(req.validate_ticket(self.ticket))

    def test_option_value_match_success(self):
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="relation",
            target_name="created_by",
            optional_key="username",
            option_value="testuser"
        )
        self.assertIsNone(req.validate_ticket(self.ticket))

    def test_option_value_match_failure(self):
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="relation",
            target_name="created_by",
            optional_key="username",
            option_value="differentuser"
        )
        self.assertIsNotNone(req.validate_ticket(self.ticket))

    def test_cant_condition_validation(self):
        # ticket.title is "Fix Router" (available)
        # can_or_cant="cant" and only target -> should fail because it IS available!
        req = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="field",
            target_name="title",
            can_or_cant="cant",
            message="Title must be blank"
        )
        error = req.validate_ticket(self.ticket)
        self.assertEqual(error, "Title must be blank")

        # approved_by is None (not available). can_or_cant="cant" -> should pass!
        req2 = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status,
            target_type="field",
            target_name="approved_by",
            can_or_cant="cant"
        )
        self.assertIsNone(req2.validate_ticket(self.ticket))


class StatusClearFieldValidationTestCase(TestCase):
    def setUp(self):
        self.status = Status.objects.create(status_name="In Progress")
        self.status_to = Status.objects.create(status_name="Completed")
        self.area = Area.objects.create(area_name="Capital Area")
        self.store = Store.objects.create(store_id="M1", store_name="Main Store", area=self.area)
        self.dept = Department.objects.create(department_name="IT")
        self.subdept = SubDepartment.objects.create(department=self.dept, sub_department_name="Software Systems")
        self.user = CustomUser.objects.create(username="testuser", full_name="Test User", active=True)
        self.priority = Priority.objects.create(department=self.dept, priority_name="High", level=2)
        self.nature = WorkNature.objects.create(
            nature_name="Hardware",
            sub_department=self.subdept,
            default_priority=self.priority
        )
        self.ticket = Ticket.objects.create(
            work_order_no="WO123",
            store=self.store,
            department=self.dept,
            nature=self.nature,
            priority=self.priority,
            status=self.status,
            title="Fix Router",
            description="Router is broken",
            created_by=self.user,
        )

    def test_clear_field_can_available(self):
        # can_or_cant="can" and target title is available -> should clear!
        rule = StatusClearField.objects.create(
            from_status=self.status,
            to_status=self.status_to,
            target_type="field",
            target_name="title",
            can_or_cant="can"
        )
        self.assertTrue(rule.should_clear(self.ticket))
        success, msg = rule.clear_ticket_field(self.ticket)
        self.assertTrue(success)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "")

    def test_clear_field_cant_available(self):
        # can_or_cant="cant" and target title is available -> should NOT clear!
        rule = StatusClearField.objects.create(
            from_status=self.status,
            to_status=self.status_to,
            target_type="field",
            target_name="title",
            can_or_cant="cant"
        )
        self.assertFalse(rule.should_clear(self.ticket))
        success, msg = rule.clear_ticket_field(self.ticket)
        self.assertFalse(success)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "Fix Router")

    def test_validate_ticket_required_fields_utility(self):
        # 1. Create a validation rule: when status goes from self.status to self.status_to,
        # 'approved_by' field is required.
        rule = StatusRequiredField.objects.create(
            from_status=self.status,
            to_status=self.status_to,
            target_type="field",
            target_name="approved_by",
            can_or_cant="can",
            message="Required approved_by"
        )
        # Ticket approved_by is None, so it should return the error message
        errors = validate_ticket_required_fields(self.ticket, self.status, self.status_to)
        self.assertEqual(errors, ["Required approved_by"])

    def test_clear_ticket_fields_utility(self):
        # 1. Create a clear field rule
        rule = StatusClearField.objects.create(
            from_status=self.status,
            to_status=self.status_to,
            target_type="field",
            target_name="title",
            can_or_cant="can",
            message="Cleared title"
        )
        messages = clear_ticket_fields(self.ticket, self.status, self.status_to)
        self.assertEqual(messages, ["Cleared title"])
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "")


