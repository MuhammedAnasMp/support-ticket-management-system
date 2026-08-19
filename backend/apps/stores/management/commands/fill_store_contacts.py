from django.core.management.base import BaseCommand
from apps.stores.models import Store


class Command(BaseCommand):
    help = "Fills past stores' phone and whatsapp numbers from their assigned active managers if missing."

    def handle(self, *args, **options):
        stores = Store.objects.filter(manager__isnull=False)
        updated_count = 0

        for store in stores:
            manager = store.manager
            if manager.is_active and getattr(manager, 'active', True):
                updated = False
                if not store.phone and manager.phone:
                    store.phone = manager.phone
                    updated = True
                    self.stdout.write(f"Copying phone {manager.phone} from manager {manager.full_name} to store {store.store_name}")
                manager_wa = manager.whatsapp_number or manager.phone
                if not store.whatsapp_number and manager_wa:
                    store.whatsapp_number = manager_wa
                    updated = True
                    self.stdout.write(f"Copying whatsapp {manager_wa} from manager {manager.full_name} to store {store.store_name}")
                if updated:
                    store.save(update_fields=['phone', 'whatsapp_number'])
                    updated_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully backfilled contact details for {updated_count} stores."))
