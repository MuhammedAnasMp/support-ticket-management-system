import os
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to sys.path and configure Django settings
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.maintenance.models import Ticket
from django.db.models import Max


def generate_non_existing_tickets_report(output_txt_path, secondary_txt_path=None):
    media_stores = os.path.join(BASE_DIR, 'media', 'stores')

    # 1. Map media folders on disk: ticket_id -> { store_name, folder_name, folder_path, file_count }
    disk_media_tickets = {}
    if os.path.exists(media_stores):
        for store_name in os.listdir(media_stores):
            store_dir = os.path.join(media_stores, store_name)
            tickets_dir = os.path.join(store_dir, 'tickets')
            if os.path.exists(tickets_dir):
                for t_folder in os.listdir(tickets_dir):
                    if t_folder.startswith('ticket_'):
                        try:
                            t_id = int(t_folder.replace('ticket_', ''))
                            t_path = os.path.join(tickets_dir, t_folder)
                            file_count = sum(len(files) for _, _, files in os.walk(t_path))
                            disk_media_tickets[t_id] = {
                                'store_name': store_name,
                                'folder_name': t_folder,
                                'folder_path': t_path,
                                'file_count': file_count
                            }
                        except ValueError:
                            pass

    # 2. Get existing DB ticket IDs
    db_ticket_ids = set(Ticket.objects.values_list('ticket_id', flat=True))
    max_db_id = max(db_ticket_ids) if db_ticket_ids else 0
    max_media_id = max(disk_media_tickets.keys()) if disk_media_tickets else 0
    max_overall_id = max(max_db_id, max_media_id)

    # 3. Find non-existing ticket IDs from 1 to max_overall_id
    non_existing_tickets = []
    with_media_count = 0
    without_media_count = 0

    for tid in range(1, max_overall_id + 1):
        if tid not in db_ticket_ids:
            if tid in disk_media_tickets:
                info = disk_media_tickets[tid]
                with_media_count += 1
                non_existing_tickets.append({
                    'ticket_id': tid,
                    'store_name': info['store_name'],
                    'has_media': True,
                    'file_count': info['file_count'],
                    'status': f"Media Folder Exists ({info['file_count']} files)"
                })
            else:
                without_media_count += 1
                non_existing_tickets.append({
                    'ticket_id': tid,
                    'store_name': 'N/A (No DB / Store Record)',
                    'has_media': False,
                    'file_count': 0,
                    'status': 'No Media Folder'
                })

    # Group non-existing tickets by Store Name
    store_grouped = {}
    for item in non_existing_tickets:
        s_name = item['store_name']
        if s_name not in store_grouped:
            store_grouped[s_name] = []
        store_grouped[s_name].append(item)

    lines = []
    lines.append("==================================================================================")
    lines.append("                   NON-EXISTING TICKET IDS LIST (1 to LAST)                       ")
    lines.append(f"Generated On: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("==================================================================================")
    lines.append("")
    lines.append("SUMMARY STATISTICS:")
    lines.append(f"  • Range of Ticket IDs Checked            : 1 to {max_overall_id}")
    lines.append(f"  • Existing Tickets in DB                 : {len(db_ticket_ids)}")
    lines.append(f"  • Total NON-EXISTING Ticket IDs          : {len(non_existing_tickets)}")
    lines.append(f"  • Non-Existing IDs WITH Media Folder     : {with_media_count} tickets")
    lines.append(f"  • Non-Existing IDs WITHOUT Media Folder  : {without_media_count} tickets")
    lines.append("")

    lines.append("=" * 95)
    lines.append("SECTION 1: LIST OF NON-EXISTING TICKET IDS (Strictly Ordered from 1 to Last)")
    lines.append("=" * 95)
    lines.append(f"{'Ticket ID':<12} | {'Store / Location Name':<32} | {'Media Status / Note'}")
    lines.append("-" * 95)
    for item in non_existing_tickets:
        lines.append(f"Ticket #{item['ticket_id']:<5} | {item['store_name']:<32} | {item['status']}")
    lines.append("-" * 95)
    lines.append("")

    lines.append("=" * 95)
    lines.append("SECTION 2: NON-EXISTING TICKETS GROUPED BY STORE NAME")
    lines.append("=" * 95)
    lines.append("")
    for s_name in sorted(store_grouped.keys()):
        lines.append(f"STORE: {s_name.upper()}")
        lines.append("-" * 95)
        for item in store_grouped[s_name]:
            lines.append(f"  • Ticket #{item['ticket_id']:<5} | Status: {item['status']}")
        lines.append("")

    report_content = "\n".join(lines)

    # Save to primary text file
    with open(output_txt_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    # Save to secondary text file if path provided
    if secondary_txt_path:
        os.makedirs(os.path.dirname(secondary_txt_path), exist_ok=True)
        with open(secondary_txt_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

    print(f"Report generated successfully:\n  1. {output_txt_path}\n  2. {secondary_txt_path}")


if __name__ == '__main__':
    out_file = os.path.join(BASE_DIR, 'missing_tickets_overview.txt')
    sec_file = os.path.join(BASE_DIR, 'found_missing_tickets', 'missing_tickets_overview.txt')
    generate_non_existing_tickets_report(out_file, sec_file)
