from django.http import multipartparser
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.apps import apps


class Command(BaseCommand):
    help = "Create/add/remove custom permission to/from a group"

    def add_arguments(self, parser):

        parser.add_argument(
            "group_name",
            type=str,
            help="Group name"
        )

        parser.add_argument(
            "codename",
            type=str,
            help="Permission codename"
        )

        parser.add_argument(
            "model_name",
            type=str,
            nargs="?",
            default="",
            help="Model name"
        )

        parser.add_argument(
            "permission_name",
            type=str,
            nargs="?",
            default="",
            help="Optional permission name"
        )

        parser.add_argument(
            "--app",
            type=str,
            required=False,
            help="App label (required when creating)"
        )

        parser.add_argument(
            "-d",
            "--delete",
            action="store_true",
            help="Remove permission from group"
        )

    def generate_permission_name(self, codename):

        words = codename.split("_")

        # Fix common spelling mistakes
        replacements = {
            "expence": "expense",
        }

        words = [
            replacements.get(word, word)
            for word in words
        ]

        name = " ".join(words)

        return f"Can {name}".capitalize()

    def handle(self, *args, **options):

        group_name = options["group_name"]
        codename = options["codename"]

        group, _ = Group.objects.get_or_create(
            name=group_name
        )

        # ==========================
        # DELETE PERMISSION
        # ==========================

        if options["delete"]:

            try:
                permission = Permission.objects.get(
                    codename=codename
                )

                group.permissions.remove(permission)

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Removed '{codename}' from group '{group_name}'"
                    )
                )

            except Permission.DoesNotExist:

                self.stdout.write(
                    self.style.ERROR(
                        f"Permission '{codename}' does not exist"
                    )
                )

            return

        # ==========================
        # CREATE / ADD PERMISSION
        # ==========================

        permission_name = options["permission_name"]
        model_name = options["model_name"]
        app_label = options["app"]

        # Generate permission name automatically
        if not permission_name:
            permission_name = self.generate_permission_name(
                codename
            )

        try:

            # If permission already exists
            permission = Permission.objects.get(
                codename=codename
            )

            self.stdout.write(
                self.style.WARNING(
                    f"Permission '{codename}' already exists"
                )
            )

        except Permission.DoesNotExist:

            # Need model information for new permission
            if not model_name or not app_label:

                self.stdout.write(
                    self.style.ERROR(
                        "Model name and --app are required for new permission"
                    )
                )

                return

            model = apps.get_model(
                app_label,
                model_name
            )

            if not model:

                self.stdout.write(
                    self.style.ERROR(
                        f"Model '{model_name}' not found in '{app_label}'"
                    )
                )

                return

            content_type = ContentType.objects.get_for_model(
                model
            )

            permission = Permission.objects.create(
                codename=codename,
                name=permission_name,
                content_type=content_type
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Created permission '{codename}'"
                )
            )

        # Add permission to group
        group.permissions.add(permission)

        self.stdout.write(
            self.style.SUCCESS(
                f"Added '{codename}' to group '{group_name}'"
            )
        )
# E:\Code\Maintenancde Tracker\backend>python manage.py add_permission_to_group technician can_change_my_log_time Ticket --app maintenance

# can_change_others_log_time

# can_chanage_my_log_time


# change_others_expence
# change_my_expence


# assign_worker // add_allocation


# update_before_repair

# update_after_repair
