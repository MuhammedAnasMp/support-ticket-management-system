import os
import sys
import shutil
import argparse
from pathlib import Path

# Add backend directory to sys.path and configure Django settings
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    import django
    django.setup()
    from apps.maintenance.models import Ticket
    from apps.stores.models import Store
    DJANGO_AVAILABLE = True
except Exception as e:
    DJANGO_AVAILABLE = False
    print(f"[Warning] Could not initialize Django environment: {e}")


def get_db_ticket_ids():
    """Retrieve all ticket_ids present in the Django database."""
    if DJANGO_AVAILABLE:
        return set(Ticket.objects.values_list('ticket_id', flat=True))
    return set()


def scan_media_stores(media_stores_path, db_ticket_ids):
    """
    Scans media/stores directory and identifies ticket folders
    whose ticket_id is missing from the database.
    """
    missing_tickets = []
    found_media_tickets = {}

    if not os.path.exists(media_stores_path):
        print(f"[Error] Media stores directory does not exist: {media_stores_path}")
        return missing_tickets, found_media_tickets

    store_dirs = [
        d for d in os.listdir(media_stores_path)
        if os.path.isdir(os.path.join(media_stores_path, d))
    ]

    for store_name in store_dirs:
        store_path = os.path.join(media_stores_path, store_name)
        tickets_dir = os.path.join(store_path, 'tickets')

        if not os.path.exists(tickets_dir):
            continue

        for folder_name in os.listdir(tickets_dir):
            ticket_folder_path = os.path.join(tickets_dir, folder_name)
            if os.path.isdir(ticket_folder_path) and folder_name.startswith('ticket_'):
                try:
                    ticket_id = int(folder_name.replace('ticket_', ''))
                    found_media_tickets[ticket_id] = (store_name, ticket_folder_path)

                    # Check if ticket ID is missing in database
                    if ticket_id not in db_ticket_ids:
                        # Collect all files inside this ticket folder
                        file_paths = []
                        total_bytes = 0
                        for root, _, files in os.walk(ticket_folder_path):
                            for f in files:
                                fp = os.path.join(root, f)
                                file_paths.append(fp)
                                total_bytes += os.path.getsize(fp)

                        missing_tickets.append({
                            'ticket_id': ticket_id,
                            'store_name': store_name,
                            'folder_name': folder_name,
                            'source_path': ticket_folder_path,
                            'file_count': len(file_paths),
                            'total_bytes': total_bytes,
                            'files': file_paths
                        })
                except ValueError:
                    continue

    return missing_tickets, found_media_tickets


def copy_missing_tickets(missing_tickets, output_dir, dry_run=False):
    """
    Copies media folders of missing tickets to output_dir
    structured under <output_dir>/<store_name>/<ticket_folder_name>/
    """
    results = []
    output_path = Path(output_dir).resolve()

    for item in missing_tickets:
        store_name = item['store_name']
        folder_name = item['folder_name']
        source_path = item['source_path']

        target_folder = output_path / store_name / folder_name

        if dry_run:
            results.append({
                'ticket_id': item['ticket_id'],
                'store_name': store_name,
                'target_path': str(target_folder),
                'copied_files': item['file_count'],
                'status': 'Dry Run (Skipped)'
            })
            continue

        try:
            if target_folder.exists():
                shutil.rmtree(target_folder)
            shutil.copytree(source_path, target_folder)
            results.append({
                'ticket_id': item['ticket_id'],
                'store_name': store_name,
                'target_path': str(target_folder),
                'copied_files': item['file_count'],
                'status': 'Successfully Copied'
            })
        except Exception as err:
            results.append({
                'ticket_id': item['ticket_id'],
                'store_name': store_name,
                'target_path': str(target_folder),
                'copied_files': 0,
                'status': f'Error: {err}'
            })

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Find missing tickets by comparing DB models and media folder, then copy media under store folders."
    )
    parser.add_argument(
        '--media-dir',
        default=os.path.join(BASE_DIR, 'media', 'stores'),
        help="Path to backend media/stores directory"
    )
    parser.add_argument(
        '--output-dir',
        default=os.path.join(BASE_DIR, 'found_missing_tickets'),
        help="Path to output directory where missing store ticket media will be copied"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Perform scanning without copying files"
    )

    args = parser.parse_args()

    print("=" * 80)
    print("                MISSING TICKET MEDIA FINDER & COPIER                 ")
    print("=" * 80)
    print(f"Django Environment : {'Loaded' if DJANGO_AVAILABLE else 'Failed'}")
    print(f"Media Stores Path  : {args.media_dir}")
    print(f"Output Directory   : {args.output_dir}")
    print(f"Dry Run Mode       : {args.dry_run}")
    print("-" * 80)

    db_ticket_ids = get_db_ticket_ids()
    print(f"Total Tickets in DB : {len(db_ticket_ids)}")

    missing_tickets, found_media = scan_media_stores(args.media_dir, db_ticket_ids)

    print(f"Total Ticket Media Folders Scanned : {len(found_media)}")
    print(f"Missing Tickets Found in Media    : {len(missing_tickets)}")
    print("-" * 80)

    if not missing_tickets:
        print("No missing tickets found in media/stores!")
        return

    print(f"{'Store Name':<30} | {'Ticket Folder':<15} | {'Files':<6} | {'Size (KB)':<10}")
    print("-" * 80)
    for m in sorted(missing_tickets, key=lambda x: (x['store_name'], x['ticket_id'])):
        store = m['store_name']
        folder = m['folder_name']
        fc = m['file_count']
        size_kb = round(m['total_bytes'] / 1024, 2)
        print(f"{store:<30} | {folder:<15} | {fc:<6} | {size_kb:<10}")

    print("-" * 80)
    print("Processing copy operation...")
    copy_results = copy_missing_tickets(missing_tickets, args.output_dir, dry_run=args.dry_run)

    print("-" * 80)
    print("COPY SUMMARY REPORT:")
    print(f"{'Store Name':<28} | {'Ticket ID':<10} | {'Status':<22} | {'Target Location'}")
    print("-" * 80)
    for res in copy_results:
        s = res['store_name']
        tid = f"ticket_{res['ticket_id']}"
        st = res['status']
        tgt = res['target_path']
        print(f"{s:<28} | {tid:<10} | {st:<22} | {tgt}")

    print("=" * 80)
    print("Operation completed successfully.")


if __name__ == '__main__':
    main()
