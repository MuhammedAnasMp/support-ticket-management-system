from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.accounts.models import Role
from apps.stores.models import Store, Department, SubDepartment
from apps.maintenance.models import Ticket, Status, Priority, WorkNature, Allocation, WorkLog
from apps.reports.metrics_engine import get_dashboard_metrics

User = get_user_model()

class DashboardMetricsEngineTest(TestCase):
    def setUp(self):
        self.role_admin = Role.objects.create(role_name='Administrator')
        self.role_tech = Role.objects.create(role_name='Technician')
        self.role_office = Role.objects.create(role_name='Office Administrator')

        self.admin_user = User.objects.create_user(
            username='admin_user',
            password='password123',
            employee_no='E101',
            role=self.role_admin,
            active=True
        )

        self.tech_user = User.objects.create_user(
            username='tech_user',
            password='password123',
            employee_no='E102',
            role=self.role_tech,
            active=True
        )

        self.dept = Department.objects.create(department_name='Maintenance Dept')
        self.subdept = SubDepartment.objects.create(department=self.dept, sub_department_name='HVAC')
        self.store = Store.objects.create(store_name='Central Store', active=True)
        self.status_open = Status.objects.create(status_name='Open', order=1)
        self.status_completed = Status.objects.create(status_name='Completed', order=2)
        self.priority = Priority.objects.create(department=self.dept, priority_name='High', level=2)
        self.nature = WorkNature.objects.create(nature_name='HVAC Repair', sub_department=self.subdept)

        self.ticket = Ticket.objects.create(
            store=self.store,
            department=self.dept,
            nature=self.nature,
            priority=self.priority,
            status=self.status_open,
            title='AC Unit Leak',
            description='Fix water leakage',
            created_by=self.admin_user
        )

        self.alloc = Allocation.objects.create(
            ticket=self.ticket,
            worker=self.tech_user,
            assigned_by=self.admin_user,
            planned_hours=4.0
        )

        self.worklog = WorkLog.objects.create(
            ticket=self.ticket,
            worker=self.tech_user,
            allocation=self.alloc,
            work_date='2026-09-01',
            hours=3.5,
            hourly_rate=15.0,
            labour_amount=52.5,
            work_done='Repaired drainage pipe'
        )

    def test_get_dashboard_metrics_for_admin(self):
        metrics = get_dashboard_metrics(self.admin_user)
        self.assertIn('summary', metrics)
        self.assertEqual(metrics['summary']['total_tickets'], 1)
        self.assertEqual(metrics['summary']['open'], 1)
        self.assertEqual(metrics['worklog_summary']['total_logged_hours'], 3.5)
        self.assertEqual(metrics['worklog_summary']['total_planned_hours'], 4.0)

    def test_get_dashboard_metrics_for_technician(self):
        metrics = get_dashboard_metrics(self.tech_user)
        self.assertIn('summary', metrics)
        self.assertEqual(metrics['summary']['total_tickets'], 1)
        self.assertEqual(len(metrics['worker_performance']), 1)
        self.assertEqual(metrics['worker_performance'][0]['planned_hours'], 4.0)
        self.assertEqual(metrics['worker_performance'][0]['logged_hours'], 3.5)
        self.assertGreater(metrics['worker_performance'][0]['efficiency_pct'], 100.0)
