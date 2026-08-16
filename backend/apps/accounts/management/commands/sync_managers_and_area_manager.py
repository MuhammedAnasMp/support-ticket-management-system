import logging

import oracledb

from django.core.management.base import BaseCommand

from apps.stores.models import Store
from apps.accounts.models import Role, CustomUser
from django.contrib.auth.models import Group


logger = logging.getLogger(__name__)


# ============================================================
# DEBUG MODE
# ============================================================
#
# True:
#     Only check and print.
#     NO Django database changes.
#
# False:
#     Actually create/update Django records.
#
# ============================================================

DEBUG_MODE = False


# ============================================================
# Oracle Configuration
# ============================================================

ORACLE_USERNAME = "KHYPER"
ORACLE_PASSWORD = "KHYPER"
ORACLE_DSN = "192.168.2.171:1521/ZEDEYE"
ORACLE_CLIENT_PATH = r"C:\instantclient_19_5"


# ============================================================
# Oracle Query
# ============================================================

ORACLE_QUERY = """
SELECT
    U.USR_ID,
    U.USR_PWD AS PASS_WORD,
    S.US_SITE AS LOCATION,
    GET_LOC_NAME(S.US_SITE) AS LOC_NAME,
    U.USR_PROFILE,

    (SELECT MAIL_ID
       FROM GOLD_LOC_LNK
      WHERE GLL_GL_LOC_CODE = S.US_SITE
        AND ROWNUM = 1) AS MAIL_ID,

    (SELECT GLL_COMP_NAME
       FROM GOLD_LOC_LNK
      WHERE GLL_GL_LOC_CODE = S.US_SITE
        AND ROWNUM = 1) AS TYPE1

FROM IVISION_USER U,
     IVISION_USER_SITE S

WHERE U.USR_PROFILE IN (
        'STOREMANAGER',
        'AREAMANAGER'
      )

  AND S.US_USER = U.USR_ID

  AND U.USR_ID IN (
        SELECT LOG_USR_ID
        FROM IVISION_USER_LOG_DETL
        WHERE LOG_REP_ID IN ('SLSRPT', 'LPOPRINT')
          AND TRUNC(LOG_DATETIME) BETWEEN DATE '2026-08-01'
                                      AND DATE '2026-08-15'
      )

  AND U.USR_ID NOT IN (
        'CKITCHEN',
        'ZAINUL',
        'RAFEEQ',
        'KIRANK'
      )

ORDER BY S.US_SITE
"""


# ============================================================
# Helper Functions
# ============================================================

def safe_string(value, default=""):

    if value is None:
        return default

    return str(value).strip()


def map_store_type(type1):

    if not type1:
        return None

    type1 = str(type1).strip().upper()

    mapping = {
        "HYPER MARKET": "HYPER_MARKET",
        "SUPER MARKET": "SUPER_MARKET",
        "FRESH": "FRESH",
        "COSTO": "COSTO",
        "CAMP": "CAMP",
        "WAREHOUSE": "WAREHOUSE",
    }

    if type1 in mapping:
        return mapping[type1]

    return type1.replace(" ", "_")


def get_role_and_group(profile):

    profile = profile.strip().upper()

    if profile == "STOREMANAGER":
        return "Store Manager", "Store Manager"

    if profile == "AREAMANAGER":
        return "Area Manager", "Area Manager"

    return None, None


# ============================================================
# Management Command
# ============================================================

class Command(BaseCommand):

    help = (
        "Import Store Managers and Area Managers "
        "from Oracle into Django"
    )

    # ========================================================
    # Django Command Output
    # ========================================================

    def print_line(self, message=""):

        self.stdout.write(message)

    # ========================================================
    # Oracle Connection
    # ========================================================

    def get_oracle_connection(self):

        try:

            self.stdout.write(
                self.style.NOTICE(
                    "Initializing Oracle client..."
                )
            )

            oracledb.init_oracle_client(
                lib_dir=ORACLE_CLIENT_PATH
            )

        except oracledb.ProgrammingError as e:

            # Oracle client may already be initialized.
            # This is safe to continue if so.

            if "already been initialized" not in str(e).lower():
                raise

        self.stdout.write(
            self.style.NOTICE(
                "Connecting to Oracle Database..."
            )
        )

        conn = oracledb.connect(
            user=ORACLE_USERNAME,
            password=ORACLE_PASSWORD,
            dsn=ORACLE_DSN
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Connected to Oracle Database successfully!"
            )
        )

        return conn

    # ========================================================
    # Handle
    # ========================================================

    def handle(self, *args, **options):

        self.print_line()

        self.print_line(
            "=" * 80
        )

        self.stdout.write(
            self.style.SUCCESS(
                "STORE MANAGER / AREA MANAGER IMPORT"
            )
        )

        self.print_line(
            "=" * 80
        )

        # ====================================================
        # Debug Status
        # ====================================================

        if DEBUG_MODE:

            self.stdout.write(
                self.style.WARNING(
                    "DEBUG_MODE = TRUE"
                )
            )

            self.stdout.write(
                self.style.WARNING(
                    "NO DJANGO DATABASE CHANGES WILL BE MADE."
                )
            )

        else:

            self.stdout.write(
                self.style.ERROR(
                    "DEBUG_MODE = FALSE"
                )
            )

            self.stdout.write(
                self.style.ERROR(
                    "ACTUAL DATABASE OPERATIONS WILL BE PERFORMED."
                )
            )

        self.print_line(
            "=" * 80
        )

        # ====================================================
        # 1. Fetch Oracle Data
        # ====================================================

        try:

            conn = self.get_oracle_connection()

            cursor = conn.cursor()

            self.stdout.write(
                "Fetching Store Manager / Area Manager records..."
            )

            cursor.execute(
                ORACLE_QUERY
            )

            col_names = [
                col[0]
                for col in cursor.description
            ]

            rows = cursor.fetchall()

            cursor.close()
            conn.close()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully fetched "
                    f"{len(rows)} records."
                )
            )

        except Exception as e:

            self.stdout.write(
                self.style.ERROR(
                    f"Error fetching from Oracle: {e}"
                )
            )

            raise

        # ====================================================
        # No Records
        # ====================================================

        if not rows:

            self.stdout.write(
                self.style.WARNING(
                    "No Store Manager / Area Manager records found."
                )
            )

            return

        # ====================================================
        # Counters
        # ====================================================

        created_stores = 0
        updated_stores = 0

        created_users = 0
        updated_users = 0

        created_roles = 0
        created_groups = 0

        accessible_store_assignments = 0
        store_manager_assignments = 0

        skipped_records = 0

        # ====================================================
        # Cache
        # ====================================================

        role_cache = {}
        group_cache = {}

        # ====================================================
        # 2. Process Records
        # ====================================================

        for idx, row_data in enumerate(
            rows,
            start=1
        ):

            row = dict(
                zip(
                    col_names,
                    row_data
                )
            )

            self.print_line()

            self.print_line(
                "-" * 80
            )

            self.stdout.write(
                f"PROCESSING [{idx}/{len(rows)}]"
            )

            self.print_line(
                "-" * 80
            )

            # =================================================
            # Read Oracle Fields
            # =================================================

            username = safe_string(
                row.get("USR_ID")
            )

            password = safe_string(
                row.get("PASS_WORD"),
                "password123"
            )

            loc_id = safe_string(
                row.get("LOCATION")
            )

            loc_name = safe_string(
                row.get("LOC_NAME")
            )

            usr_profile = safe_string(
                row.get("USR_PROFILE")
            ).upper()

            mail_id = safe_string(
                row.get("MAIL_ID")
            )

            type1 = safe_string(
                row.get("TYPE1")
            ).upper()

            # =================================================
            # Validation
            # =================================================

            if not username:

                self.stdout.write(
                    self.style.WARNING(
                        "[SKIP] USR_ID is empty."
                    )
                )

                skipped_records += 1

                continue

            if not loc_id:

                self.stdout.write(
                    self.style.WARNING(
                        f"[SKIP] LOCATION is empty "
                        f"for user {username}."
                    )
                )

                skipped_records += 1

                continue

            if usr_profile not in (
                "STOREMANAGER",
                "AREAMANAGER"
            ):

                self.stdout.write(
                    self.style.WARNING(
                        f"[SKIP] Unsupported profile "
                        f"{usr_profile} for {username}."
                    )
                )

                skipped_records += 1

                continue

            # =================================================
            # Role / Group
            # =================================================

            role_name, group_name = (
                get_role_and_group(
                    usr_profile
                )
            )

            # =================================================
            # Store Type
            # =================================================

            mapped_type = map_store_type(
                type1
            )

            # =================================================
            # Display Data
            # =================================================

            self.stdout.write(
                f"USR_ID      : {username}"
            )

            self.stdout.write(
                f"PROFILE     : {usr_profile}"
            )

            self.stdout.write(
                f"ROLE        : {role_name}"
            )

            self.stdout.write(
                f"GROUP       : {group_name}"
            )

            self.stdout.write(
                f"LOCATION    : {loc_id}"
            )

            self.stdout.write(
                f"LOC_NAME    : {loc_name}"
            )

            self.stdout.write(
                f"MAIL_ID     : {mail_id}"
            )

            self.stdout.write(
                f"TYPE1       : {type1}"
            )

            self.stdout.write(
                f"MAPPED TYPE : {mapped_type}"
            )

            # =================================================
            # DEBUG MODE
            # =================================================

            if DEBUG_MODE:

                # ---------------------------------------------
                # Store
                # ---------------------------------------------

                existing_store = (
                    Store.objects
                    .filter(
                        store_id=loc_id
                    )
                    .first()
                )

                if existing_store:

                    self.stdout.write(
                        self.style.WARNING(
                            "[DEBUG] STORE EXISTS -> UPDATE"
                        )
                    )

                else:

                    self.stdout.write(
                        self.style.SUCCESS(
                            "[DEBUG] STORE DOES NOT EXIST -> CREATE"
                        )
                    )

                self.stdout.write(
                    f"         store_id   = {loc_id}"
                )

                self.stdout.write(
                    f"         store_name = {loc_name}"
                )

                self.stdout.write(
                    f"         type       = {mapped_type}"
                )

                self.stdout.write(
                    "         active     = True"
                )

                # ---------------------------------------------
                # User
                # ---------------------------------------------

                existing_user = (
                    CustomUser.objects
                    .filter(
                        username=username
                    )
                    .first()
                )

                if existing_user:

                    self.stdout.write(
                        self.style.WARNING(
                            "[DEBUG] USER EXISTS -> UPDATE"
                        )
                    )

                else:

                    self.stdout.write(
                        self.style.SUCCESS(
                            "[DEBUG] USER DOES NOT EXIST -> CREATE"
                        )
                    )

                self.stdout.write(
                    f"         username = {username}"
                )

                self.stdout.write(
                    f"         email    = {mail_id}"
                )

                self.stdout.write(
                    f"         role     = {role_name}"
                )

                # ---------------------------------------------
                # Group
                # ---------------------------------------------

                existing_group = (
                    Group.objects
                    .filter(
                        name=group_name
                    )
                    .first()
                )

                if existing_group:

                    self.stdout.write(
                        self.style.WARNING(
                            f"[DEBUG] GROUP EXISTS -> "
                            f"{group_name}"
                        )
                    )

                else:

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[DEBUG] GROUP DOES NOT EXIST "
                            f"-> CREATE: {group_name}"
                        )
                    )

                self.stdout.write(
                    f"[DEBUG] Would add {username} "
                    f"to group '{group_name}'"
                )

                # ---------------------------------------------
                # Accessible Stores
                # ---------------------------------------------

                self.stdout.write(
                    f"[DEBUG] Would add {username} "
                    f"to accessible_stores -> {loc_id}"
                )

                # ---------------------------------------------
                # Store Manager / Area Manager
                # ---------------------------------------------

                if usr_profile == "STOREMANAGER":

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[DEBUG] Would assign "
                            f"{username} as store.manager "
                            f"for {loc_id}"
                        )
                    )

                elif usr_profile == "AREAMANAGER":

                    self.stdout.write(
                        self.style.NOTICE(
                            f"[DEBUG] Area Manager {username} "
                            f"gets accessible_stores"
                        )
                    )

                    self.stdout.write(
                        self.style.NOTICE(
                            f"[DEBUG] Area Manager {username} "
                            f"will NOT become store.manager"
                        )
                    )

                continue

            # =================================================
            # ACTUAL DATABASE OPERATIONS
            # =================================================

            # =================================================
            # A. Role
            # =================================================

            if role_name not in role_cache:

                manager_role, created_role = (
                    Role.objects.get_or_create(
                        role_name=role_name
                    )
                )

                role_cache[
                    role_name
                ] = manager_role

                if created_role:

                    created_roles += 1

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created Role: {role_name}"
                        )
                    )

                else:

                    self.stdout.write(
                        f"Using existing Role: {role_name}"
                    )

            else:

                manager_role = (
                    role_cache[
                        role_name
                    ]
                )

            # =================================================
            # B. Group
            # =================================================
            #
            # Creates the group automatically if it does not
            # already exist.
            #
            # Store Manager -> Store Manager
            # Area Manager  -> Area Manager
            #
            # Office Administrator is not modified.
            #
            # =================================================

            if group_name not in group_cache:

                manager_group, created_group = (
                    Group.objects.get_or_create(
                        name=group_name
                    )
                )

                group_cache[
                    group_name
                ] = manager_group

                if created_group:

                    created_groups += 1

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created Group: {group_name}"
                        )
                    )

                else:

                    self.stdout.write(
                        f"Using existing Group: {group_name}"
                    )

            else:

                manager_group = (
                    group_cache[
                        group_name
                    ]
                )

            # =================================================
            # C. Store
            # =================================================

            store_obj, store_created = (
                Store.objects.get_or_create(
                    store_id=loc_id,

                    defaults={
                        "store_name": loc_name,
                        "type": mapped_type,
                        "active": True,
                    }
                )
            )

            if store_created:

                created_stores += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created Store: "
                        f"{loc_name} ({loc_id})"
                    )
                )

            else:

                updated_stores += 1

                store_obj.store_name = loc_name
                store_obj.type = mapped_type
                store_obj.active = True

                store_obj.save(
                    update_fields=[
                        "store_name",
                        "type",
                        "active",
                    ]
                )

                self.stdout.write(
                    f"Updated Store: "
                    f"{loc_name} ({loc_id})"
                )

            # =================================================
            # D. User
            # =================================================

            user_obj = (
                CustomUser.objects
                .filter(
                    username=username
                )
                .first()
            )

            # -------------------------------------------------
            # NEW USER
            # -------------------------------------------------

            if not user_obj:

                user_obj = (
                    CustomUser.objects.create_user(
                        username=username,
                        email=mail_id,
                        password=password,
                        full_name=username,
                        active=True,
                        role=manager_role,
                    )
                )

                created_users += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created User: "
                        f"{username} "
                        f"({role_name})"
                    )
                )

            # -------------------------------------------------
            # EXISTING USER
            # -------------------------------------------------

            else:

                user_obj.email = mail_id

                user_obj.set_password(
                    password
                )

                user_obj.full_name = username

                user_obj.role = manager_role

                user_obj.active = True

                user_obj.save()

                updated_users += 1

                self.stdout.write(
                    f"Updated User: "
                    f"{username} "
                    f"({role_name})"
                )

            # =================================================
            # E. Assign Group
            # =================================================

            user_obj.groups.add(
                manager_group
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Assigned {username} "
                    f"to group '{group_name}'"
                )
            )

            # =================================================
            # F. Accessible Stores
            # =================================================
            #
            # BOTH Store Manager and Area Manager
            # receive access.
            #
            # =================================================

            user_obj.accessible_stores.add(
                store_obj
            )

            accessible_store_assignments += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Added {username} "
                    f"-> accessible_stores "
                    f"-> {loc_id}"
                )
            )

            # =================================================
            # G. Store Manager
            # =================================================

            if usr_profile == "STOREMANAGER":

                store_obj.manager = user_obj

                store_obj.save(
                    update_fields=[
                        "manager"
                    ]
                )

                store_manager_assignments += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] Store Manager {username} "
                        f"-> store.manager -> {loc_id}"
                    )
                )

            # =================================================
            # H. Area Manager
            # =================================================

            elif usr_profile == "AREAMANAGER":

                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] Area Manager {username} "
                        f"-> accessible_stores -> {loc_id}"
                    )
                )

                self.stdout.write(
                    self.style.NOTICE(
                        f"[OK] Area Manager {username} "
                        f"NOT assigned as store.manager"
                    )
                )

        # ====================================================
        # Final Summary
        # ====================================================

        self.print_line()

        self.print_line(
            "=" * 80
        )

        self.stdout.write(
            self.style.SUCCESS(
                "IMPORT SUMMARY"
            )
        )

        self.print_line(
            "=" * 80
        )

        self.stdout.write(
            f"Created Stores               : "
            f"{created_stores}"
        )

        self.stdout.write(
            f"Updated Stores               : "
            f"{updated_stores}"
        )

        self.stdout.write(
            f"Created Users                : "
            f"{created_users}"
        )

        self.stdout.write(
            f"Updated Users                : "
            f"{updated_users}"
        )

        self.stdout.write(
            f"Created Roles                : "
            f"{created_roles}"
        )

        self.stdout.write(
            f"Created Groups               : "
            f"{created_groups}"
        )

        self.stdout.write(
            f"Accessible Store Assignments : "
            f"{accessible_store_assignments}"
        )

        self.stdout.write(
            f"Store Manager Assignments    : "
            f"{store_manager_assignments}"
        )

        self.stdout.write(
            f"Skipped Records              : "
            f"{skipped_records}"
        )

        self.print_line(
            "=" * 80
        )

        if DEBUG_MODE:

            self.stdout.write(
                self.style.WARNING(
                    "DEBUG MODE: "
                    "No Django database changes were made."
                )
            )

        else:

            self.stdout.write(
                self.style.SUCCESS(
                    "IMPORT COMPLETE: "
                    "Django database was updated."
                )
            )

        self.print_line(
            "=" * 80
        )

        self.print_line()
