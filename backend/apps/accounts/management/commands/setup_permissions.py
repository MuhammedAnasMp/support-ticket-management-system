from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from apps.accounts.models import CustomUser, Role
from apps.maintenance.models import Ticket

class Command(BaseCommand):
    help = 'Setup Django Groups and assign explicit permissions for Office Admin, Store Manager, Technician, etc.'

    def handle(self, *args, **options):
        ticket_ct = ContentType.objects.get_for_model(Ticket)

        # Get relevant permissions
        approve_perm = Permission.objects.get(codename='approve_ticket', content_type=ticket_ct)
        reject_perm = Permission.objects.get(codename='reject_ticket', content_type=ticket_ct)
        complete_perm = Permission.objects.get(codename='complete_ticket', content_type=ticket_ct)
        create_perm = Permission.objects.get(codename='create_ticket', content_type=ticket_ct)
        view_open_perm = Permission.objects.get(codename='can_view_open_ticket', content_type=ticket_ct)
        view_reconciled_perm = Permission.objects.get(codename='can_view_reconciled_ticket', content_type=ticket_ct)
        view_all_dept_perm = Permission.objects.get(codename='view_all_department_tickets', content_type=ticket_ct)
        create_all_dept_perm = Permission.objects.get(codename='create_ticket_all_departments', content_type=ticket_ct)

        # 1. Main Administrator / Main Admin
        group_main_admin, _ = Group.objects.get_or_create(name='Main Administrator')
        group_main_admin.permissions.set(Permission.objects.filter(content_type__app_label='maintenance'))

        # 2. Office Administrator
        group_office_admin, _ = Group.objects.get_or_create(name='Office Administrator')
        group_office_admin.permissions.set([
            approve_perm, reject_perm, create_perm, view_all_dept_perm, view_open_perm, view_reconciled_perm
        ])

        # 3. Store Manager
        group_store_manager, _ = Group.objects.get_or_create(name='Store Manager')
        group_store_manager.permissions.set([
            create_perm, view_open_perm, view_reconciled_perm
        ])

        # 4. Area Manager
        group_area_manager, _ = Group.objects.get_or_create(name='Area Manager')
        group_area_manager.permissions.set([
            create_perm, create_all_dept_perm, view_all_dept_perm, view_open_perm, view_reconciled_perm
        ])

        # 5. Technician
        group_technician, _ = Group.objects.get_or_create(name='Technician')
        group_technician.permissions.set([
            complete_perm, view_open_perm
        ])

        # Sync all existing users to their corresponding Group based on user.role
        synced_count = 0
        for user in CustomUser.objects.all():
            if user.role:
                g, _ = Group.objects.get_or_create(name=user.role.role_name)
                user.groups.add(g)
                synced_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully configured Groups & Permissions. Synced {synced_count} users to groups."))
