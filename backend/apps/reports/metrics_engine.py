"""
Role-based metrics engine for Maintenance Tracker dashboard.
Computes real-time KPIs, worker efficiency ratings, SLA statistics, and store breakdown
filtered by user role, permissions, accessible stores, sub-departments, and date ranges.
"""

from datetime import datetime, time
from django.db.models import Q, Sum, Count, Avg, F
from django.utils import timezone
from apps.maintenance.models import Ticket, Status, Allocation, WorkLog
from apps.finance.models import Expense
from apps.stores.models import Store, Department, SubDepartment
from apps.accounts.models import CustomUser


def parse_date_range(from_date_str, to_date_str):
    """Parses ISO date strings into timezone-aware datetime bounds."""
    if from_date_str:
        try:
            dt = datetime.strptime(from_date_str, "%Y-%m-%d")
            from_dt = timezone.make_aware(datetime.combine(dt, time.min))
        except Exception:
            from_dt = None
    else:
        from_dt = None

    if to_date_str:
        try:
            dt = datetime.strptime(to_date_str, "%Y-%m-%d")
            to_dt = timezone.make_aware(datetime.combine(dt, time.max))
        except Exception:
            to_dt = None
    else:
        to_dt = None

    return from_dt, to_dt


def get_dashboard_metrics(user, from_date_str=None, to_date_str=None, store_id=None, department_id=None):
    """
    Computes dashboard metric dataset tailored to user's role and permission flags.
    """
    from_dt, to_dt = parse_date_range(from_date_str, to_date_str)
    role_name = (user.role.role_name if user.role else '').strip()
    role_lower = role_name.lower()

    # Determine user permissions
    can_create_all = user.has_perm('maintenance.create_ticket_all_departments') or user.is_superuser
    is_admin = role_lower in ('admin', 'administrator', 'main administrator') or user.is_superuser
    is_management = role_lower in ('management', 'manager', 'executive')
    is_office_admin = role_lower in ('office administrator', 'office admin')
    is_technician = role_lower in ('technician', 'worker')

    # Base ticket queryset
    ticket_qs = Ticket.objects.all()

    # Date filtering (created_date within range)
    if from_dt:
        ticket_qs = ticket_qs.filter(created_date__gte=from_dt)
    if to_dt:
        ticket_qs = ticket_qs.filter(created_date__lte=to_dt)

    # Filter by user accessible stores if user is restricted
    if is_technician:
        ticket_qs = ticket_qs.filter(
            Q(allocations__worker=user) | Q(work_logs__worker=user) | Q(created_by=user)
        ).distinct()
    elif not is_admin and not is_management and not is_office_admin:
        accessible_stores = user.accessible_stores.all()
        if accessible_stores.exists():
            ticket_qs = ticket_qs.filter(store__in=accessible_stores)

    # Optional UI filter overrides
    if store_id and str(store_id).strip() and str(store_id).lower() not in ('all', 'null', 'undefined'):
        try:
            ticket_qs = ticket_qs.filter(store_id=int(store_id))
        except (ValueError, TypeError):
            pass

    if department_id and str(department_id).strip() and str(department_id).lower() not in ('all', 'null', 'undefined'):
        try:
            ticket_qs = ticket_qs.filter(department_id=int(department_id))
        except (ValueError, TypeError):
            pass

    # Restricted sub-department filter if user doesn't have all-depts access
    if not can_create_all and not is_admin and not is_management and not is_technician:
        user_subdepts = user.sub_departments.all()
        if user_subdepts.exists():
            dept_ids = user_subdepts.values_list('department_id', flat=True).distinct()
            if dept_ids:
                ticket_qs = ticket_qs.filter(department_id__in=dept_ids)


    # Core Ticket Counts
    status_counts = ticket_qs.values('status__status_name').annotate(count=Count('ticket_id'))
    status_map = {item['status__status_name'].lower(): item['count'] for item in status_counts if item['status__status_name']}

    total_tickets = ticket_qs.count()
    open_count = status_map.get('open', 0)
    in_progress_count = status_map.get('in progress', 0) + status_map.get('in_progress', 0)
    location_approval_count = status_map.get('location approval', 0) + status_map.get('location_approval', 0)
    completed_count = status_map.get('completed', 0)
    blocked_count = status_map.get('blocked', 0)
    reconciled_count = status_map.get('reconciled', 0)
    rejected_count = status_map.get('rejected', 0)

    active_tickets_count = open_count + in_progress_count + location_approval_count + blocked_count

    # SLA & Overdue Calculation (>48 hours without closure)
    cutoff_48h = timezone.now() - timezone.timedelta(hours=48)
    overdue_count = ticket_qs.filter(
        Q(status__status_name__iexact='open') | Q(status__status_name__iexact='in progress'),
        created_date__lt=cutoff_48h
    ).count()

    # Unassigned Ticket Queue (Open tickets with 0 worker allocations)
    unassigned_count = ticket_qs.filter(
        status__status_name__iexact='open'
    ).annotate(alloc_count=Count('allocations')).filter(alloc_count=0).count()

    # Financial Aggregations for matching tickets
    matched_ticket_ids = ticket_qs.values_list('ticket_id', flat=True)

    expense_qs = Expense.objects.filter(ticket_id__in=matched_ticket_ids)
    if from_dt:
        expense_qs = expense_qs.filter(expense_date__gte=from_dt.date())
    if to_dt:
        expense_qs = expense_qs.filter(expense_date__lte=to_dt.date())

    total_expense_amount = float(expense_qs.aggregate(total=Sum('amount'))['total'] or 0.0)
    unapproved_expense_qs = expense_qs.filter(approved=False)
    unapproved_expense_count = unapproved_expense_qs.count()
    unapproved_expense_amount = float(unapproved_expense_qs.aggregate(total=Sum('amount'))['total'] or 0.0)

    worklog_qs = WorkLog.objects.filter(ticket_id__in=matched_ticket_ids)
    if from_dt:
        worklog_qs = worklog_qs.filter(work_date__gte=from_dt.date())
    if to_dt:
        worklog_qs = worklog_qs.filter(work_date__lte=to_dt.date())

    total_logged_hours = float(worklog_qs.aggregate(total=Sum('hours'))['total'] or 0.0)
    total_labour_amount = float(worklog_qs.aggregate(total=Sum('labour_amount'))['total'] or 0.0)

    # Average Mean Time to Repair (MTTR in Hours) for completed/closed tickets
    completed_tickets = ticket_qs.filter(closed_date__isnull=False)
    if completed_tickets.exists():
        durations = []
        for t in completed_tickets[:200]:
            if t.closed_date and t.created_date:
                diff = (t.closed_date - t.created_date).total_seconds() / 3600.0
                durations.append(diff)
        avg_mttr_hours = round(sum(durations) / len(durations), 1) if durations else 0.0
    else:
        avg_mttr_hours = 0.0

    # On-Time SLA Percentage
    if total_tickets > 0:
        sla_compliance_pct = round(((total_tickets - overdue_count) / float(total_tickets)) * 100, 1)
    else:
        sla_compliance_pct = 100.0

    # Worker Performance & Efficiency Aggregation (Planned vs Actual Logged Hours)
    workers_qs = CustomUser.objects.filter(
        Q(role__role_name__icontains='technician') | Q(role__role_name__icontains='worker') | Q(allocations__isnull=False)
    ).distinct()

    worker_performance_list = []
    total_planned_system = 0.0
    total_actual_system = 0.0

    for w in workers_qs[:50]:
        w_allocs = Allocation.objects.filter(worker=w, ticket_id__in=matched_ticket_ids)
        w_logs = WorkLog.objects.filter(worker=w, ticket_id__in=matched_ticket_ids)
        if from_dt:
            w_logs = w_logs.filter(work_date__gte=from_dt.date())
        if to_dt:
            w_logs = w_logs.filter(work_date__lte=to_dt.date())

        planned = float(w_allocs.aggregate(total=Sum('planned_hours'))['total'] or 0.0)
        logged = float(w_logs.aggregate(total=Sum('hours'))['total'] or 0.0)

        # Completed jobs by this worker
        w_completed = ticket_qs.filter(allocations__worker=w, status__status_name__iexact='completed').distinct().count()
        w_total_jobs = ticket_qs.filter(allocations__worker=w).distinct().count()

        # Efficiency calculation
        if logged > 0 and planned > 0:
            eff_pct = round((planned / logged) * 100, 1)
        elif logged > 0 and planned == 0:
            eff_pct = 100.0
        elif planned > 0 and logged == 0:
            eff_pct = 0.0
        else:
            eff_pct = 100.0

        w_on_time_pct = 100.0
        if w_total_jobs > 0:
            w_overdue = ticket_qs.filter(
                allocations__worker=w,
                status__status_name__iexact='in progress',
                created_date__lt=cutoff_48h
            ).distinct().count()
            w_on_time_pct = round(((w_total_jobs - w_overdue) / float(w_total_jobs)) * 100, 1)

        total_planned_system += planned
        total_actual_system += logged

        if w_total_jobs > 0 or logged > 0:
            worker_performance_list.append({
                'worker_id': w.user_id,
                'worker_name': w.full_name or w.username,
                'employee_no': w.employee_no or '',
                'planned_hours': round(planned, 1),
                'logged_hours': round(logged, 1),
                'efficiency_pct': eff_pct,
                'completed_jobs': w_completed,
                'total_assigned_jobs': w_total_jobs,
                'on_time_pct': w_on_time_pct,
            })

    # Sort worker leaderboard by efficiency / completed jobs
    worker_performance_list.sort(key=lambda x: (x['completed_jobs'], x['efficiency_pct']), reverse=True)

    if total_actual_system > 0:
        system_efficiency_pct = round((total_planned_system / total_actual_system) * 100, 1)
    else:
        system_efficiency_pct = 100.0

    # Store Breakdown Matrix
    store_breakdown = []
    stores_list = Store.objects.filter(active=True)
    if not is_admin and not is_management and not is_office_admin:
        stores_list = user.accessible_stores.filter(active=True)

    for s in stores_list[:30]:
        s_tickets = ticket_qs.filter(store=s)
        s_total = s_tickets.count()
        if s_total == 0:
            continue
        s_open = s_tickets.filter(status__status_name__iexact='open').count()
        s_in_prog = s_tickets.filter(status__status_name__iexact='in progress').count()
        s_loc_appr = s_tickets.filter(status__status_name__iexact='location approval').count()
        s_compl = s_tickets.filter(status__status_name__iexact='completed').count()
        s_cost = float(Expense.objects.filter(responsible_store=s).aggregate(total=Sum('amount'))['total'] or 0.0)

        store_breakdown.append({
            'store_id': s.store_id,
            'store_name': s.store_name,
            'total_tickets': s_total,
            'open': s_open,
            'in_progress': s_in_prog,
            'location_approval': s_loc_appr,
            'completed': s_compl,
            'total_cost': round(s_cost, 2),
        })

    # Department Load Distribution
    dept_distribution = []
    depts_list = Department.objects.all()
    for d in depts_list:
        d_count = ticket_qs.filter(department=d).count()
        if d_count > 0:
            d_cost = float(Expense.objects.filter(ticket__department=d).aggregate(total=Sum('amount'))['total'] or 0.0)
            dept_distribution.append({
                'department_id': d.department_id,
                'department_name': d.department_name,
                'ticket_count': d_count,
                'total_cost': round(d_cost, 2),
            })

    # Top performing worker
    top_performing_worker = worker_performance_list[0] if worker_performance_list else None

    # Most ticket raised store
    stores_by_tickets = sorted(store_breakdown, key=lambda x: x['total_tickets'], reverse=True)
    most_ticket_raised_store = stores_by_tickets[0] if stores_by_tickets else None

    # Assemble Final Dashboard Response Object
    return {
        'role': role_name or 'User',
        'user_id': user.user_id,
        'full_name': user.full_name or user.username,
        'summary': {
            'total_tickets': total_tickets,
            'active_tickets': active_tickets_count,
            'open': open_count,
            'in_progress': in_progress_count,
            'location_approval': location_approval_count,
            'completed': completed_count,
            'blocked': blocked_count,
            'reconciled': reconciled_count,
            'rejected': rejected_count,
            'overdue_count': overdue_count,
            'unassigned_count': unassigned_count,
            'sla_compliance_pct': sla_compliance_pct,
            'avg_mttr_hours': avg_mttr_hours,
            'system_efficiency_pct': system_efficiency_pct,
        },
        'financials': {
            'total_expenses': round(total_expense_amount, 2),
            'total_labour_cost': round(total_labour_amount, 2),
            'grand_total_cost': round(total_expense_amount + total_labour_amount, 2),
            'unapproved_expense_count': unapproved_expense_count,
            'unapproved_expense_amount': round(unapproved_expense_amount, 2),
        },
        'worklog_summary': {
            'total_logged_hours': round(total_logged_hours, 1),
            'total_planned_hours': round(total_planned_system, 1),
        },
        'insights': {
            'top_performing_worker': top_performing_worker,
            'most_ticket_raised_store': most_ticket_raised_store,
            'top_stores_by_tickets': stores_by_tickets[:5],
        },
        'worker_performance': worker_performance_list,
        'store_breakdown': store_breakdown,
        'department_distribution': dept_distribution,
    }

