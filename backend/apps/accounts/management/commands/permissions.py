import os
import json

from django.conf import settings
from django.contrib.auth.models import Permission, Group
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Generates or updates default_permissions.json from Django permissions and groups"

    def add_arguments(self, parser):
        parser.add_argument(
            "-e",
            "--employee",
            type=str,
            help="Employee number to display details, role, and permissions"
        )
        parser.add_argument(
            "-c",
            action="store_true",
            help="Display only custom permissions across the system"
        )

    def handle(self, *args, **options):
        employee_no = options.get("employee")
        custom_only = options.get("custom_only")

        # Standard Django action prefixes to filter out standard permissions
        standard_prefixes = ("add_", "change_", "delete_", "view_")

        # Fetch all permissions with content types
        perms = (
            Permission.objects.select_related("content_type")
            .all()
            .order_by("content_type__app_label", "codename")
        )

        # Handle custom permissions listing if requested or by default layout
        custom_perms = [
            p for p in perms
            if not p.codename.startswith(standard_prefixes)
        ]

        if custom_only:
            self.stdout.write(self.style.WARNING(
                f"\n--- Custom Permissions List ({len(custom_perms)}) ---"))
            for p in custom_perms:
                self.stdout.write(
                    f" - {p.content_type.app_label}.{p.codename} ({p.name})")
            self.stdout.write("")
            return

        if employee_no:
            from apps.accounts.models import CustomUser
            try:
                user = CustomUser.objects.select_related(
                    "role").get(employee_no=employee_no)
                self.stdout.write(self.style.WARNING(
                    f"\n--- User Details for {employee_no} ---"))
                self.stdout.write(f"Username: {user.username}")
                self.stdout.write(f"Full Name: {user.full_name}")
                self.stdout.write(
                    f"Role: {user.role.role_name if user.role else 'No Role'}")
                self.stdout.write(f"Email: {user.email}")
                self.stdout.write(f"Active: {user.active}")

                # Fetch and print permissions
                perms_list = sorted(list(user.get_all_permissions()))
                self.stdout.write(self.style.WARNING(
                    f"\nActive Permissions ({len(perms_list)}):"))
                for p in perms_list:
                    self.stdout.write(f" - {p}")

                # Filter user's active custom permissions
                user_custom_perms = [
                    p for p in perms_list
                    if not any(p.split('.')[-1].startswith(prefix) for prefix in standard_prefixes)
                ]
                self.stdout.write(self.style.WARNING(
                    f"\nActive Custom Permissions for User ({len(user_custom_perms)}):"))
                for cp in user_custom_perms:
                    self.stdout.write(f" - {cp}")

                self.stdout.write("")
                return
            except CustomUser.DoesNotExist:
                self.stdout.write(self.style.ERROR(
                    f"Error: User with employee number '{employee_no}' does not exist."))
                return

        # Print system-wide custom permissions count & list on standard command run
        self.stdout.write(self.style.SUCCESS(
            f"\nFound {len(custom_perms)} custom permission(s):"))
        for p in custom_perms:
            self.stdout.write(
                f" * {p.content_type.app_label}.{p.codename} -> {p.name}")
        self.stdout.write("")

        # JSON file path
        root_dir = r"E:\Code\Maintenancde Tracker"
        file_path = os.path.join(root_dir, "frontend",
                                 "src", "hooks", "default_permissions.json")

        # Load existing JSON (to preserve descriptions/UI text)
        existing_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except Exception:
                existing_data = {}

        existing_defs = existing_data.get("permission_definitions", {})
        existing_groups = existing_data.get("default_groups", {})

        # ------------------------------------------------------------------
        # Build permission definitions
        # ------------------------------------------------------------------
        new_defs = {}

        for p in perms:
            key = f"{p.content_type.app_label}.{p.codename}"

            if key in existing_defs:
                # Keep existing description
                new_defs[key] = existing_defs[key]
            else:
                # Default description
                new_defs[key] = f"Allows {p.name.lower()}."

        all_permissions = sorted(new_defs.keys())

        # ------------------------------------------------------------------
        # Build groups dynamically
        # ------------------------------------------------------------------
        groups_output = {}

        # Admin always gets every permission
        admin_old = existing_groups.get("admin", {})

        groups_output["admin"] = {
            "display_name": admin_old.get("display_name", "Administrator"),
            "ui_privileges": admin_old.get(
                "ui_privileges",
                "Full complete access to all system features."
            ),
            "permissions": all_permissions,
        }

        # Read all other Django groups
        groups = Group.objects.prefetch_related(
            "permissions__content_type"
        ).order_by("name")

        for group in groups:
            if group.name.lower() == "admin":
                continue

            permission_keys = sorted(
                f"{perm.content_type.app_label}.{perm.codename}"
                for perm in group.permissions.all()
            )

            old = existing_groups.get(group.name, {})

            groups_output[group.name] = {
                "display_name": old.get(
                    "display_name",
                    group.name.replace("_", " ").title(),
                ),
                "ui_privileges": old.get("ui_privileges", ""),
                "permissions": permission_keys,
            }

        # ------------------------------------------------------------------
        # Save JSON
        # ------------------------------------------------------------------
        output = {
            "permission_definitions": new_defs,
            "default_groups": groups_output,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully generated permissions JSON: {file_path}"
            )
        )
