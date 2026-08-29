"""
Pre-built Report Templates Registry

Provides ready-to-use report configurations so users can quickly launch
standard maintenance, store performance, and financial reports.
"""

PREBUILT_TEMPLATES = [
    {
        "id": "tpl_monthly_tickets",
        "name": "Monthly Maintenance Ticket Summary",
        "category": "Maintenance",
        "description": "Comprehensive summary of maintenance work orders grouped by store and priority.",
        "data_source": "maintenance.ticket",
        "theme": "corporate_blue",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "title", "label": "Ticket Title", "width": 180, "alignment": "left"},
                {"path": "store__store_name", "label": "Store", "width": 120, "alignment": "left"},
                {"path": "department__department_name", "label": "Department", "width": 110, "alignment": "left"},
                {"path": "nature__nature_name", "label": "Work Nature", "width": 110, "alignment": "left"},
                {"path": "priority__priority_name", "label": "Priority", "width": 80, "alignment": "center"},
                {"path": "status__status_name", "label": "Status", "width": 90, "alignment": "center"},
                {"path": "allocations__worker__username", "label": "Assigned Technician", "width": 120, "alignment": "left"},
                {"path": "created_by__username", "label": "Created By", "width": 100, "alignment": "left"},
                {"path": "created_date", "label": "Created Date", "width": 110, "alignment": "center"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "created_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "ticket_id", "function": "count", "label": "Total Tickets", "color": "blue"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Tickets by Store",
                    "group_by": "store__store_name",
                    "aggregate_func": "count",
                },
                {
                    "type": "pie",
                    "title": "Tickets by Priority",
                    "group_by": "priority__priority_name",
                    "aggregate_func": "count",
                }
            ],
            "conditional_formatting": [
                {
                    "path": "priority__priority_name",
                    "operator": "equals",
                    "value": "Critical",
                    "bg_color": "#fee2e2",
                    "text_color": "#991b1b",
                }
            ]
        }
    },
    {
        "id": "tpl_expense_report",
        "name": "Financial Expenses by Store & Department",
        "category": "Finance",
        "description": "Detail of maintenance financial expenses incurred per store and expense type.",
        "data_source": "finance.expense",
        "theme": "finance",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "expense_id", "label": "ID #", "width": 60, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "responsible_store__store_name", "label": "Store", "width": 130, "alignment": "left"},
                {"path": "expense_type__expense_name", "label": "Expense Type", "width": 120, "alignment": "left"},
                {"path": "worker__username", "label": "Submitted By", "width": 100, "alignment": "left"},
                {"path": "expense_date", "label": "Date", "width": 90, "alignment": "center"},
                {"path": "amount", "label": "Amount (KWD)", "width": 90, "alignment": "right", "format": ".3f"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "expense_date", "direction": "desc"}
            ],
            "aggregations": [
                {"path": "amount", "function": "sum", "label": "Total Amount"}
            ],
            "kpi_cards": [
                {"path": "expense_id", "function": "count", "label": "Total Expenses", "color": "emerald"},
                {"path": "amount", "function": "sum", "label": "Total Amount (KWD)", "color": "emerald"},
            ],
            "charts": [
                {
                    "type": "doughnut",
                    "title": "Expenses by Category",
                    "group_by": "expense_type__expense_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                }
            ]
        }
    },
    {
        "id": "tpl_worker_hours",
        "name": "Worker Labor Hours & Costs",
        "category": "Workforce",
        "description": "Log of labor hours, hourly rates, and total labor cost per technician.",
        "data_source": "maintenance.worklog",
        "theme": "maintenance",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "worklog_id", "label": "Log ID", "width": 60, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "worker__username", "label": "Technician", "width": 120, "alignment": "left"},
                {"path": "work_date", "label": "Date", "width": 90, "alignment": "center"},
                {"path": "hours", "label": "Hours", "width": 70, "alignment": "right"},
                {"path": "hourly_rate", "label": "Rate", "width": 70, "alignment": "right"},
                {"path": "labour_amount", "label": "Total Labor Cost", "width": 100, "alignment": "right"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "work_date", "direction": "desc"}
            ],
            "aggregations": [
                {"path": "hours", "function": "sum", "label": "Total Hours"},
                {"path": "labour_amount", "function": "sum", "label": "Total Labor Cost"}
            ],
            "kpi_cards": [
                {"path": "hours", "function": "sum", "label": "Total Hours Worked", "color": "amber"},
                {"path": "labour_amount", "function": "sum", "label": "Total Labor Cost (KWD)", "color": "amber"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Hours by Technician",
                    "group_by": "worker__username",
                    "aggregate_func": "sum",
                    "aggregate_field": "hours",
                }
            ]
        }
    }
]


def get_prebuilt_templates():
    return PREBUILT_TEMPLATES
