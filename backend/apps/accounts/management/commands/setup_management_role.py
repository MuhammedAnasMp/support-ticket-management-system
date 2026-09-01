from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from apps.accounts.models import Role

class Command(BaseCommand):
    help = "Creates the 'Management' role and group if they do not exist, and assigns all GET/VIEW permissions."

    def handle(self, *args, **options):
        # 1. Create/Get Role "Management"
        role, role_created = Role.objects.get_or_create(role_name="Management")
        if role_created:
            self.stdout.write(self.style.SUCCESS("Created Role: Management"))
        else:
            self.stdout.write(self.style.SUCCESS("Role 'Management' already exists."))

        # 2. Create/Get Group "Management"
        group, group_created = Group.objects.get_or_create(name="Management")
        if group_created:
            self.stdout.write(self.style.SUCCESS("Created Group: Management"))
        else:
            self.stdout.write(self.style.SUCCESS("Group 'Management' already exists."))

        # 3. Collect ALL GET/VIEW permissions across system
        # Include view_*, can_view_*, can_filter_*, switch_to_card_view, can_generate_report, can_see_device_info, etc.
        view_perms = Permission.objects.filter(
            codename__startswith='view_'
        ) | Permission.objects.filter(
            codename__startswith='can_view_'
        ) | Permission.objects.filter(
            codename__in=[
                'can_filter_worker_ticket',
                'switch_to_card_view',
                'can_generate_report',
                'can_see_device_info',
                'can_view_my_instruction',
                'can_view_all_instruction',
                'view_all_department_tickets'
            ]
        )

        # Filter out any edit/create/delete/approve/reject/move/update codenames just in case
        excluded_keywords = [
            'create', 'add', 'change', 'delete', 'approve', 'reject',
            'complete', 'move', 'update'
        ]
        
        allowed_perms = []
        for p in view_perms:
            c = p.codename.lower()
            # If codename starts with view_ or can_view_, make sure it doesn't contain destructive actions
            if any(kw in c for kw in ['create_ticket', 'add_ticket', 'approve_ticket', 'reject_ticket', 'complete_ticket', 'can_move_', 'can_update_ticket', 'update_']):
                continue
            allowed_perms.append(p)

        # Clear existing permissions and add all GET/VIEW permissions
        group.permissions.set(allowed_perms)
        
        self.stdout.write(self.style.SUCCESS(
            f"Assigned {len(allowed_perms)} GET/VIEW permissions to 'Management' group."
        ))

        # 4. Sync any existing users with role 'Management' to the 'Management' group
        for u in role.users.all():
            u.groups.add(group)
            self.stdout.write(self.style.SUCCESS(f"Added user '{u.username}' to 'Management' group."))
