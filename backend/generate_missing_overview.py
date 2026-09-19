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
from apps.stores.models import Store


def generate_overview_report(output_txt_path, missing_tickets_dir):
    media_stores = os.path.join(BASE_DIR, 'media', 'stores')

    # 1. Map media folders: ticket_id -> { store_name, folder_name, folder_path, file_count }
    media_tickets = {}
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
                            media_tickets[t_id] = {
                                'store_name': store_name,
                                'folder_name': t_folder,
                                'folder_path': t_path,
                                'file_count': file_count
                            }
                        except ValueError:
                            pass

    # 2. Fetch all DB tickets ordered strictly by ticket_id
    db_tickets = Ticket.objects.select_related('store', 'department', 'status').all().order_by('ticket_id')
    db_ticket_ids = set(t.ticket_id for t in db_tickets)

    # 3. Identify categories
    tickets_no_media = []
    tickets_with_media = []

    for t in db_tickets:
        store_name = t.store.store_name if t.store else 'Unknown Store'
        has_media = t.ticket_id in media_tickets

        info = {
            'ticket_id': t.ticket_id,
            'work_order_no': t.work_order_no,
            'store_name': store_name,
            'department': t.department.department_name if t.department else 'N/A',
            'status': t.status.status_name if t.status else 'N/A',
            'title': t.title,
            'created_date': t.created_date.strftime('%Y-%m-%d %H:%M') if t.created_date else 'N/A',
            'has_media': has_media
        }

        if has_media:
            tickets_with_media.append(info)
        else:
            tickets_no_media.append(info)

    missing_db_ids = set(media_tickets.keys()) - db_ticket_ids
    missing_db_tickets = []
    for t_id in missing_db_ids:
        m_info = media_tickets[t_id]
        missing_db_tickets.append({
            'ticket_id': t_id,
            'store_name': m_info['store_name'],
            'folder_name': m_info['folder_name'],
            'file_count': m_info['file_count'],
            'folder_path': m_info['folder_path']
        })

    # Group by store / location
    stores_summary = {}
    for t in db_tickets:
        s_name = t.store.store_name if t.store else 'Unknown Store'
        if s_name not in stores_summary:
            stores_summary[s_name] = {'total_db': 0, 'with_media': 0, 'no_media': 0, 'missing_in_db': 0}
        stores_summary[s_name]['total_db'] += 1
        if t.ticket_id in media_tickets:
            stores_summary[s_name]['with_media'] += 1
        else:
            stores_summary[s_name]['no_media'] += 1

    for m in missing_db_tickets:
        s_name = m['store_name']
        if s_name not in stores_summary:
            stores_summary[s_name] = {'total_db': 0, 'with_media': 0, 'no_media': 0, 'missing_in_db': 0}
        stores_summary[s_name]['missing_in_db'] += 1

    # Write Text File
    lines = []
    lines.append("==================================================================================")
    lines.append("                  LOCATION & TICKET MEDIA OVERVIEW REPORT                         ")
    lines.append(f"Generated On: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("==================================================================================")
    lines.append("")
    lines.append("SUMMARY STATISTICS:")
    lines.append(f"  • Total DB Tickets                       : {len(db_tickets)}")
    lines.append(f"  • DB Tickets WITH Media Folder           : {len(tickets_with_media)}")
    lines.append(f"  • DB Tickets WITHOUT Media Folder        : {len(tickets_no_media)}  [MARKED: NO MEDIA FOLDER]")
    lines.append(f"  • Media Folders Missing DB Ticket Record : {len(missing_db_tickets)}  [MARKED: MISSING TICKET IN DB]")
    lines.append(f"  • Total Store Locations                  : {len(stores_summary)}")
    lines.append("")
    lines.append("=" * 95)
    lines.append("SECTION 1: OVERVIEW BY STORE / LOCATION")
    lines.append("=" * 95)
    lines.append(f"{'Store / Location Name':<35} | {'DB Tickets':<10} | {'With Media':<11} | {'No Media':<10} | {'Missing DB'}")
    lines.append("-" * 95)
    for s_name in sorted(stores_summary.keys()):
        data = stores_summary[s_name]
        lines.append(f"{s_name:<35} | {data['total_db']:<10} | {data['with_media']:<11} | {data['no_media']:<10} | {data['missing_in_db']}")
    lines.append("-" * 95)
    lines.append("")

    lines.append("=" * 95)
    lines.append("SECTION 2: MISSING TICKETS IN DATABASE (Media folder exists, sorted by Ticket ID)")
    lines.append("=" * 95)
    if missing_db_tickets:
        lines.append(f"{'Ticket ID':<12} | {'Store Name':<30} | {'Ticket Folder':<15} | {'Files':<6} | {'Status Mark'}")
        lines.append("-" * 95)
        for m in sorted(missing_db_tickets, key=lambda x: x['ticket_id']):
            lines.append(f"Ticket #{m['ticket_id']:<5} | {m['store_name']:<30} | {m['folder_name']:<15} | {m['file_count']:<6} | [MISSING TICKET IN DB]")
    else:
        lines.append("None")
    lines.append("")

    lines.append("=" * 95)
    lines.append("SECTION 3: TICKETS WITHOUT MEDIA FOLDER (Sorted by Ticket ID)")
    lines.append("=" * 95)
    lines.append(f"{'Ticket ID':<12} | {'Store Name':<30} | {'Work Order No':<22} | {'Status':<15} | {'Status Mark'}")
    lines.append("-" * 95)
    for t in sorted(tickets_no_media, key=lambda x: x['ticket_id']):
        lines.append(f"Ticket #{t['ticket_id']:<5} | {t['store_name']:<30} | {t['work_order_no']:<22} | {t['status']:<15} | [NO MEDIA FOLDER]")
    lines.append("")

    lines.append("=" * 95)
    lines.append("SECTION 4: TICKETS WITH MEDIA FOLDER (Sorted by Ticket ID)")
    lines.append("=" * 95)
    lines.append(f"{'Ticket ID':<12} | {'Store Name':<30} | {'Work Order No':<22} | {'Status':<15} | {'Status Mark'}")
    lines.append("-" * 95)
    for t in sorted(tickets_with_media, key=lambda x: x['ticket_id']):
        lines.append(f"Ticket #{t['ticket_id']:<5} | {t['store_name']:<30} | {t['work_order_no']:<22} | {t['status']:<15} | [MEDIA FOLDER EXISTS]")
    lines.append("")

    # Also build a Master Numerical Ticket Ledger (All Tickets sorted 1..N)
    all_combined_tickets = []
    for t in db_tickets:
        all_combined_tickets.append({
            'ticket_id': t.ticket_id,
            'store_name': t.store.store_name if t.store else 'Unknown Store',
            'work_order_no': t.work_order_no,
            'status_mark': '[MEDIA FOLDER EXISTS]' if t.ticket_id in media_tickets else '[NO MEDIA FOLDER]'
        })

    for m in missing_db_tickets:
        all_combined_tickets.append({
            'ticket_id': m['ticket_id'],
            'store_name': m['store_name'],
            'work_order_no': f"Folder: {m['folder_name']}",
            'status_mark': '[MISSING TICKET IN DB]'
        })

    lines.append("=" * 95)
    lines.append("SECTION 5: MASTER ALL-TICKETS LEDGER (Strictly ordered 1..N by Ticket ID)")
    lines.append("=" * 95)
    lines.append(f"{'Ticket ID':<12} | {'Store Name':<32} | {'Work Order No / Folder':<26} | {'Media Status'}")
    lines.append("-" * 95)
    for item in sorted(all_combined_tickets, key=lambda x: x['ticket_id']):
        lines.append(f"Ticket #{item['ticket_id']:<5} | {item['store_name']:<32} | {item['work_order_no']:<26} | {item['status_mark']}")
    lines.append("-" * 95)
    lines.append("")

    report_content = "\n".join(lines)

    # Save report to destination files
    with open(output_txt_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    # Also save inside found_missing_tickets folder if it exists
    if os.path.exists(missing_tickets_dir):
        secondary_txt = os.path.join(missing_tickets_dir, 'missing_tickets_overview.txt')
        with open(secondary_txt, 'w', encoding='utf-8') as f:
            f.write(report_content)

    print(f"Report successfully saved to:\n  1. {output_txt_path}\n  2. {secondary_txt if os.path.exists(missing_tickets_dir) else 'N/A'}")


if __name__ == '__main__':
    out_file = os.path.join(BASE_DIR, 'missing_tickets_overview.txt')
    missing_dir = os.path.join(BASE_DIR, 'found_missing_tickets')
    generate_overview_report(out_file, missing_dir)
