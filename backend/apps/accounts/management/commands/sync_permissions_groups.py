import os

from dotenv import load_dotenv

from django.conf import settings
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction


load_dotenv()


class Command(BaseCommand):
    help = (
        "Synchronize ALL permissions and groups from local db.sqlite3 "
        "to production PostgreSQL."
    )

    SOURCE_DB = "permission_sync_source"
    TARGET_DB = "permission_sync_target"

    def handle(self, *args, **options):

        # ==========================================================
        # LOCAL SQLITE
        # ==========================================================

        local_db_path = os.path.join(
            settings.BASE_DIR,
            "db.sqlite3",
        )

        if not os.path.isfile(local_db_path):
            raise CommandError(
                f"Local SQLite database not found:\n"
                f"{local_db_path}"
            )

        # IMPORTANT:
        #
        # Do not copy PostgreSQL OPTIONS into SQLite.
        #
        # Also provide TIME_ZONE because Django's database wrapper
        # expects it for manually-created database aliases.

        source_db = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": local_db_path,
            "USER": "",
            "PASSWORD": "",
            "HOST": "",
            "PORT": "",
            "OPTIONS": {},
            "ATOMIC_REQUESTS": False,
            "AUTOCOMMIT": True,
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": False,
            "TIME_ZONE": getattr(
                settings,
                "TIME_ZONE",
                "UTC",
            ),
            "TEST": {
                "CHARSET": None,
                "COLLATION": None,
                "NAME": None,
                "MIRROR": None,
            },
        }

        connections.databases[
            self.SOURCE_DB
        ] = source_db

        # ==========================================================
        # PRODUCTION POSTGRESQL
        # ==========================================================

        required = [
            "DB_NAME",
            "DB_USER",
            "DB_PASSWORD",
            "DB_HOST",
        ]

        missing = [
            key
            for key in required
            if not os.getenv(key)
        ]

        if missing:
            raise CommandError(
                "Missing production database variables in .env:\n"
                + "\n".join(
                    f"  - {key}"
                    for key in missing
                )
            )

        target_db = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["DB_NAME"],
            "USER": os.environ["DB_USER"],
            "PASSWORD": os.environ["DB_PASSWORD"],
            "HOST": os.environ["DB_HOST"],
            "PORT": os.getenv("DB_PORT", "5432"),
            "OPTIONS": {},
            "ATOMIC_REQUESTS": False,
            "AUTOCOMMIT": True,
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": False,
            "TIME_ZONE": getattr(
                settings,
                "TIME_ZONE",
                "UTC",
            ),
            "TEST": {
                "CHARSET": None,
                "COLLATION": None,
                "NAME": None,
                "MIRROR": None,
            },
        }

        connections.databases[
            self.TARGET_DB
        ] = target_db

        # ==========================================================
        # HEADER
        # ==========================================================

        self.stdout.write("")

        self.stdout.write(
            self.style.WARNING(
                "=================================================="
            )
        )

        self.stdout.write(
            self.style.WARNING(
                "       LOCAL SQLITE -> PRODUCTION POSTGRES"
            )
        )

        self.stdout.write(
            self.style.WARNING(
                "=================================================="
            )
        )

        self.stdout.write("")

        self.stdout.write(
            f"Local source : {local_db_path}"
        )

        self.stdout.write(
            f"Production   : "
            f"{os.environ['DB_USER']}@"
            f"{os.environ['DB_HOST']}:"
            f"{os.getenv('DB_PORT', '5432')}/"
            f"{os.environ['DB_NAME']}"
        )

        # ==========================================================
        # TEST SQLITE
        # ==========================================================

        self.stdout.write("")
        self.stdout.write(
            "Testing local SQLite connection..."
        )

        try:
            connections[
                self.SOURCE_DB
            ].ensure_connection()

        except Exception as exc:
            raise CommandError(
                "Could not connect to local db.sqlite3:\n"
                f"{exc}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Local SQLite connection successful."
            )
        )

        # ==========================================================
        # TEST POSTGRES
        # ==========================================================

        self.stdout.write(
            "Testing production PostgreSQL connection..."
        )

        try:
            connections[
                self.TARGET_DB
            ].ensure_connection()

        except Exception as exc:
            raise CommandError(
                "Could not connect to production PostgreSQL:\n"
                f"{exc}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Production PostgreSQL connection successful."
            )
        )

        # ==========================================================
        # READ LOCAL PERMISSIONS
        # ==========================================================

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "Reading permissions from db.sqlite3..."
            )
        )

        local_permissions = {}

        permissions = (
            Permission.objects
            .using(self.SOURCE_DB)
            .select_related("content_type")
            .all()
            .order_by(
                "content_type__app_label",
                "content_type__model",
                "codename",
            )
        )

        for permission in permissions:

            content_type = permission.content_type

            key = (
                content_type.app_label,
                content_type.model,
                permission.codename,
            )

            local_permissions[key] = {
                "app_label": content_type.app_label,
                "model": content_type.model,
                "codename": permission.codename,
                "name": permission.name,
            }

        self.stdout.write(
            self.style.SUCCESS(
                f"Local permissions: "
                f"{len(local_permissions)}"
            )
        )

        # ==========================================================
        # READ LOCAL GROUPS
        # ==========================================================

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "Reading groups and assigned permissions "
                "from db.sqlite3..."
            )
        )

        local_groups = {}

        groups = (
            Group.objects
            .using(self.SOURCE_DB)
            .prefetch_related(
                "permissions__content_type"
            )
            .order_by("name")
        )

        for group in groups:

            permission_keys = []

            for permission in group.permissions.all():

                content_type = permission.content_type

                key = (
                    content_type.app_label,
                    content_type.model,
                    permission.codename,
                )

                permission_keys.append(key)

            local_groups[group.name] = sorted(
                permission_keys
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Local groups: "
                f"{len(local_groups)}"
            )
        )

        # ==========================================================
        # SHOW LOCAL ASSIGNMENTS
        # ==========================================================

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "LOCAL GROUP PERMISSIONS"
            )
        )

        total_local_assignments = 0

        for (
            group_name,
            permission_keys,
        ) in local_groups.items():

            self.stdout.write("")

            self.stdout.write(
                self.style.SUCCESS(
                    f"{group_name}: "
                    f"{len(permission_keys)} permissions"
                )
            )

            total_local_assignments += len(
                permission_keys
            )

            for (
                app_label,
                model,
                codename,
            ) in permission_keys:

                self.stdout.write(
                    f"    "
                    f"{app_label}."
                    f"{model}."
                    f"{codename}"
                )

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(
                f"Total local group-permission assignments: "
                f"{total_local_assignments}"
            )
        )

        # ==========================================================
        # SAFETY CHECK
        # ==========================================================

        if (
            local_groups
            and total_local_assignments == 0
        ):
            raise CommandError(
                "\n"
                "STOPPED.\n\n"
                "db.sqlite3 contains groups, but Django reports "
                "ZERO permissions assigned to those groups.\n\n"
                "Production was NOT modified."
            )

        # ==========================================================
        # SYNCHRONIZE PRODUCTION
        # ==========================================================

        try:

            with transaction.atomic(
                using=self.TARGET_DB
            ):

                # ==================================================
                # PERMISSIONS
                # ==================================================

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "Synchronizing permissions..."
                    )
                )

                production_permissions = {}

                created_permissions = 0
                updated_permissions = 0

                for (
                    key,
                    data,
                ) in local_permissions.items():

                    content_type = (
                        ContentType.objects
                        .using(self.TARGET_DB)
                        .filter(
                            app_label=data["app_label"],
                            model=data["model"],
                        )
                        .first()
                    )

                    if not content_type:
                        try:
                            from django.apps import apps
                            apps.get_model(data["app_label"], data["model"])
                            content_type, _ = (
                                ContentType.objects
                                .using(self.TARGET_DB)
                                .get_or_create(
                                    app_label=data["app_label"],
                                    model=data["model"],
                                )
                            )
                        except LookupError:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Skipping stale permission for deleted model: "
                                    f"{data['app_label']}.{data['model']}.{data['codename']}"
                                )
                            )
                            continue

                    permission, created = (
                        Permission.objects
                        .using(self.TARGET_DB)
                        .get_or_create(
                            content_type=content_type,
                            codename=data["codename"],
                            defaults={
                                "name": data["name"],
                            },
                        )
                    )

                    if created:

                        created_permissions += 1

                    elif permission.name != data["name"]:

                        permission.name = data["name"]

                        permission.save(
                            using=self.TARGET_DB,
                            update_fields=[
                                "name"
                            ],
                        )

                        updated_permissions += 1

                    production_permissions[
                        key
                    ] = permission

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Permissions created: "
                        f"{created_permissions}"
                    )
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Permissions updated: "
                        f"{updated_permissions}"
                    )
                )

                # ==================================================
                # GROUPS
                # ==================================================

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "Synchronizing groups..."
                    )
                )

                production_groups = {}

                groups_created = 0
                groups_existing = 0

                for group_name in local_groups:

                    group, created = (
                        Group.objects
                        .using(self.TARGET_DB)
                        .get_or_create(
                            name=group_name
                        )
                    )

                    production_groups[
                        group_name
                    ] = group

                    if created:
                        groups_created += 1
                    else:
                        groups_existing += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Groups created: "
                        f"{groups_created}"
                    )
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Groups already existed: "
                        f"{groups_existing}"
                    )
                )

                # ==================================================
                # EXACT GROUP PERMISSION COPY
                # ==================================================

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "Copying group permissions..."
                    )
                )

                copied_assignments = 0

                for (
                    group_name,
                    permission_keys,
                ) in local_groups.items():

                    production_group = (
                        production_groups[
                            group_name
                        ]
                    )

                    production_permission_objects = []

                    for permission_key in (
                        permission_keys
                    ):

                        production_permission = (
                            production_permissions.get(
                                permission_key
                            )
                        )

                        if not production_permission:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  Skipping missing/stale permission assignment: {permission_key} for group '{group_name}'"
                                )
                            )
                            continue

                        production_permission_objects.append(
                            production_permission
                        )

                    # EXACT COPY
                    #
                    # This is the critical operation.
                    #
                    # It removes production permissions that aren't
                    # present locally and adds all local permissions.

                    production_group.permissions.set(
                        production_permission_objects,
                    )

                    copied_assignments += len(
                        production_permission_objects
                    )

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  {group_name}: "
                            f"{len(production_permission_objects)} "
                            f"permissions"
                        )
                    )

                # ==================================================
                # REMOVE PRODUCTION-ONLY GROUPS
                # ==================================================

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "Removing production-only groups..."
                    )
                )

                deleted_groups = 0

                for group in (
                    Group.objects
                    .using(self.TARGET_DB)
                    .all()
                ):

                    if group.name not in local_groups:

                        group.delete(
                            using=self.TARGET_DB
                        )

                        deleted_groups += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Groups deleted: "
                        f"{deleted_groups}"
                    )
                )

        except CommandError:
            raise

        except Exception as exc:

            raise CommandError(
                "Synchronization failed.\n"
                "Production transaction was rolled back.\n\n"
                f"{exc}"
            )

        finally:

            try:
                connections[
                    self.SOURCE_DB
                ].close()
            except Exception:
                pass

            try:
                connections[
                    self.TARGET_DB
                ].close()
            except Exception:
                pass

        # ==========================================================
        # FINAL
        # ==========================================================

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(
                "=================================================="
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "       SYNC COMPLETED SUCCESSFULLY"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "=================================================="
            )
        )

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(
                f"Local permissions   : "
                f"{len(local_permissions)}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Local groups        : "
                f"{len(local_groups)}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Assignments copied  : "
                f"{copied_assignments}"
            )
        )

        self.stdout.write("")

        self.stdout.write(
            self.style.WARNING(
                "Users were NOT modified."
            )
        )
