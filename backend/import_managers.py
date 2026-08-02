from apps.stores.models import Store, StoreType
from apps.accounts.models import Role, CustomUser
from django.contrib.auth.models import Group
import os
import sys
import logging
import django

# Setup Django settings
sys.path.append(r'E:\Code\Maintenancde Tracker\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


try:
    import oracledb
except ImportError:
    logger.error("oracledb is not installed.")
    sys.exit(1)


def connection():
    username = "KHYPER"
    password = "KHYPER"
    dsn = "192.168.2.171:1521/ZEDEYE"
    client_path = "C:\\instantclient_19_5"

    try:
        logger.info("Initializing Oracle client...")
        oracledb.init_oracle_client(lib_dir=client_path)
        logger.info("Connecting to Oracle Database...")
        conn = oracledb.connect(user=username, password=password, dsn=dsn)
        logger.info("Connected to Oracle Database successfully!")
        return conn
    except oracledb.Error as e:
        logger.error(f"Error connecting to Oracle Database: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in connection: {e}")
        raise


def main():
    try:
        # 1. Fetch data from Oracle
        conn = connection()
        cursor = conn.cursor()
        logger.info("Fetching all rows from temp_mgr...")
        cursor.execute("select * from temp_mgr")
        col_names = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        logger.info(f"Successfully fetched {len(rows)} records.")
    except Exception as e:
        logger.error(f"Error fetching from Oracle: {e}")
        sys.exit(1)

    # 2. Get or create the Role and Django Group
    # Role is "Store Manager" (or create if missing)
    manager_role, created_role = Role.objects.get_or_create(
        role_name="Store Manager")
    if created_role:
        logger.info("Created missing role: Store Manager")
    else:
        logger.info("Using existing role: Store Manager")

    # Group is "store_manager" (or create if missing)
    manager_group, created_group = Group.objects.get_or_create(
        name="store_manager")
    if created_group:
        logger.info("Created missing group: store_manager")
    else:
        logger.info("Using existing group: store_manager")

    # 3. Process each record
    created_stores = 0
    updated_stores = 0
    created_users = 0
    updated_users = 0

    for idx, row_data in enumerate(rows):
        row = dict(zip(col_names, row_data))

        loc_id = str(row['LOCATION']).strip()
        loc_name = str(row['LOC_NAME']).strip()
        mail_id = str(row['MAIL_ID']).strip() if row.get(
            'MAIL_ID') else f"store{loc_id}@grandhyper.com"
        username = str(row['USR_ID']).strip()
        password = str(row['PASS_WORD']).strip() if row.get(
            'PASS_WORD') else "password123"
        type1 = str(row['TYPE1']).strip().upper() if row.get('TYPE1') else None
        mobile = str(row['MOBILE_NUMBER']).strip(
        ) if row.get('MOBILE_NUMBER') else None

        # Clean/validate type
        # StoreType.choices:
        # SUPER_MARKET = "SUPER_MARKET"
        # HYPER_MARKET = "HYPER_MARKET"
        # WAREHOUSE = "WAREHOUSE"
        # FRESH = "FRESH"
        # COSTO = "COSTO"
        # CAMP = "CAMP"
        mapped_type = None
        if type1:
            if type1 == "HYPER MARKET":
                mapped_type = "HYPER_MARKET"
            elif type1 == "SUPER MARKET":
                mapped_type = "SUPER_MARKET"
            elif type1 in ["FRESH", "COSTO", "CAMP", "WAREHOUSE"]:
                mapped_type = type1
            else:
                mapped_type = type1.replace(" ", "_")

        # Clean mobile phone to exactly 8 digits if possible
        phone = None
        if mobile:
            digits_only = "".join([c for c in mobile if c.isdigit()])
            if len(digits_only) == 8:
                phone = digits_only

        # A. Get or create Store
        store_obj, store_created = Store.objects.get_or_create(
            store_id=loc_id,
            defaults={
                'store_name': loc_name,
                'type': mapped_type,
                'active': True
            }
        )
        if store_created:
            created_stores += 1
            logger.info(
                f"[{idx+1}/{len(rows)}] Created store {loc_name} ({loc_id}) of type {mapped_type}")
        else:
            updated_stores += 1
            # Update name and type if needed
            store_obj.store_name = loc_name
            store_obj.type = mapped_type
            store_obj.save()

        # B. Get or create User
        user_obj = CustomUser.objects.filter(username=username).first()
        user_created = False
        if not user_obj:
            user_obj = CustomUser.objects.create_user(
                username=username,
                email=mail_id,
                password=password,
                full_name=username,
                phone=phone,
                active=True,
                role=manager_role
            )
            user_created = True
            created_users += 1
            logger.info(f"[{idx+1}/{len(rows)}] Created user {username}")
        else:
            updated_users += 1
            user_obj.email = mail_id
            user_obj.set_password(password)
            user_obj.full_name = username
            user_obj.phone = phone
            user_obj.role = manager_role
            user_obj.active = True
            user_obj.save()
            logger.info(f"[{idx+1}/{len(rows)}] Updated user {username}")

        # C. Assign user to store_manager group
        user_obj.groups.add(manager_group)

        # D. Allocate user to the store (M2M accessible_stores)
        user_obj.accessible_stores.add(store_obj)

        # E. Set store manager (store.manager)
        store_obj.manager = user_obj
        store_obj.save()

    print("\n" + "="*40)
    print("IMPORT SUMMARY")
    print("="*40)
    print(f"Created Stores: {created_stores}")
    print(f"Updated Stores: {updated_stores}")
    print(f"Created Users:  {created_users}")
    print(f"Updated Users:  {updated_users}")
    print("="*40)


if __name__ == "__main__":
    main()
