from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from apps.maintenance.models import Ticket

class Command(BaseCommand):
    help = "Creates area_manager and store_manager Django groups and assigns view_all_department_tickets and create_ticket_all_departments permissions."

    def handle(self, *args, **options):
        content_type = ContentType.objects.get_for_model(Ticket)
        
        # Ensure permissions exist
        perm_view_all, _ = Permission.objects.get_or_create(
            codename='view_all_department_tickets',
            content_type=content_type,
            defaults={'name': 'Can view all department tickets'}
        )
        perm_create_all, _ = Permission.objects.get_or_create(
            codename='create_ticket_all_departments',
            content_type=content_type,
            defaults={'name': 'Can create ticket under all departments'}
        )

        ticket_perms = Permission.objects.filter(content_type=content_type)

        group_names = ['area_manager', 'store_manager']
        for g_name in group_names:
            group, created = Group.objects.get_or_create(name=g_name)
            action = "Created" if created else "Updated"
            # Add permissions to group
            for perm in ticket_perms:
                group.permissions.add(perm)
            group.permissions.add(perm_view_all, perm_create_all)
            self.stdout.write(self.style.SUCCESS(f"{action} group '{g_name}' with ticket permissions."))

        self.stdout.write(self.style.SUCCESS("Successfully configured area_manager and store_manager groups and permissions."))
