"""
Pre-built Report Templates Registry

Provides ready-to-use standard report configurations for maintenance,
workforce performance, store locations, financial expenses, audit logs,
and dynamic year-over-year & month-over-month store comparisons.
"""

PREBUILT_TEMPLATES = [
    {
        "id": "tpl_worker_performance",
        "name": "Worker Performance & Task Completion",
        "category": "Workforce",
        "description": "Evaluates worker assignment load, completion count, and resolution status per technician across all store locations.",
        "data_source": "maintenance.allocation",
        "theme": "maintenance",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "allocation_id", "label": "ID #", "width": 60, "alignment": "left"},
                {"path": "worker__username", "label": "Technician", "width": 120, "alignment": "left"},
                {"path": "worker__role__role_name", "label": "Role", "width": 100, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "ticket__title", "label": "Ticket Title", "width": 160, "alignment": "left"},
                {"path": "ticket__store__store_name", "label": "Store Location", "width": 120, "alignment": "left"},
                {"path": "ticket__priority__priority_name", "label": "Priority", "width": 80, "alignment": "center"},
                {"path": "assigned_by__username", "label": "Assigned By", "width": 100, "alignment": "left"},
                {"path": "assigned_date", "label": "Assigned Date", "width": 100, "alignment": "center"},
                {"path": "planned_hours", "label": "Planned Hours", "width": 80, "alignment": "right"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "assigned_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "allocation_id", "function": "count", "label": "Total Assignments", "color": "blue"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Assignments by Technician",
                    "group_by": "worker__username",
                    "aggregate_func": "count",
                }
            ]
        }
    },
    {
        "id": "tpl_location_wise_works",
        "name": "Location-Wise Work Orders Breakdown",
        "category": "Maintenance",
        "description": "Store and location-wise breakdown of work orders, active priorities, and completion progress across all retail outlets.",
        "data_source": "maintenance.ticket",
        "theme": "corporate_blue",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "title", "label": "Ticket Title", "width": 180, "alignment": "left"},
                {"path": "store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "store__area__area_name", "label": "Area", "width": 100, "alignment": "left"},
                {"path": "department__department_name", "label": "Department", "width": 110, "alignment": "left"},
                {"path": "nature__nature_name", "label": "Work Nature", "width": 110, "alignment": "left"},
                {"path": "priority__priority_name", "label": "Priority", "width": 80, "alignment": "center"},
                {"path": "status__status_name", "label": "Status", "width": 90, "alignment": "center"},
                {"path": "created_by__username", "label": "Created By", "width": 110, "alignment": "left"},
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
                {"path": "ticket_id", "function": "count", "label": "Total Work Orders", "color": "blue"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Work Orders by Store",
                    "group_by": "store__store_name",
                    "aggregate_func": "count",
                },
                {
                    "type": "doughnut",
                    "title": "Work Orders by Priority",
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
        "id": "tpl_all_location_expenses",
        "name": "All Location Maintenance Expenses",
        "category": "Finance",
        "description": "Complete breakdown of maintenance expenditures incurred across all store locations, categorized by expense type.",
        "data_source": "finance.expense",
        "theme": "finance",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "expense_id", "label": "ID #", "width": 60, "alignment": "left"},
                {"path": "responsible_store__store_name", "label": "Store Location", "width": 140, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "expense_type__expense_name", "label": "Expense Category", "width": 130, "alignment": "left"},
                {"path": "worker__username", "label": "Submitted By", "width": 110, "alignment": "left"},
                {"path": "expense_date", "label": "Expense Date", "width": 90, "alignment": "center"},
                {"path": "amount", "label": "Amount (KWD)", "width": 95, "alignment": "right", "format": ".3f"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "expense_date", "direction": "desc"}
            ],
            "aggregations": [
                {"path": "amount", "function": "sum", "label": "Total Expenditure KWD"}
            ],
            "kpi_cards": [
                {"path": "expense_id", "function": "count", "label": "Expense Records Count", "color": "emerald"},
                {"path": "amount", "function": "sum", "label": "Total Expenditure (KWD)", "color": "emerald"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Expenditure by Store Location",
                    "group_by": "responsible_store__store_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                },
                {
                    "type": "pie",
                    "title": "Expenses by Category",
                    "group_by": "expense_type__expense_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                }
            ]
        }
    },
    {
        "id": "tpl_store_yearly_comparison",
        "name": "Store Expenditure Comparison (Current vs Previous Year)",
        "category": "Comparisons",
        "description": "Dynamic side-by-side annual expenditure comparison per store location (Old Year vs New Year, Variance KWD, and Growth %).",
        "data_source": "finance.expense",
        "theme": "finance",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "responsible_store__store_name", "label": "Store Location", "width": 160, "alignment": "left"},
                {"path": "amount", "label": "Expense Amount", "width": 120, "alignment": "right", "format": ".3f"},
            ],
            "grouping": {
                "fields": ["responsible_store__store_name"],
                "aggregations": [
                    {"path": "amount", "function": "sum", "label": "Total Expenses (KWD)"}
                ]
            },
            "comparison": {
                "enabled": True,
                "type": "previous_year",
                "date_field": "expense_date"
            },
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "kpi_cards": [
                {"path": "amount", "function": "sum", "label": "Total Annual Expenditure", "color": "emerald"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Store Annual Expense Comparison",
                    "group_by": "responsible_store__store_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                }
            ]
        }
    },
    {
        "id": "tpl_store_monthly_ticket_comparison",
        "name": "Store Work Order Comparison (Current vs Previous Month)",
        "category": "Comparisons",
        "description": "Dynamic side-by-side monthly work order volume comparison per store location (Current Month vs Previous Month).",
        "data_source": "maintenance.ticket",
        "theme": "corporate_blue",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "store__store_name", "label": "Store Location", "width": 160, "alignment": "left"},
                {"path": "ticket_id", "label": "Work Order Count", "width": 120, "alignment": "right"},
            ],
            "grouping": {
                "fields": ["store__store_name"],
                "aggregations": [
                    {"path": "ticket_id", "function": "count", "label": "Work Orders Count"}
                ]
            },
            "comparison": {
                "enabled": True,
                "type": "previous_month",
                "date_field": "created_date"
            },
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "kpi_cards": [
                {"path": "ticket_id", "function": "count", "label": "Total Work Orders", "color": "blue"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Store Monthly Ticket Volume Comparison",
                    "group_by": "store__store_name",
                    "aggregate_func": "count",
                }
            ]
        }
    },
    {
        "id": "tpl_technician_labor_hours",
        "name": "Technician Labor Hours & Wage Cost",
        "category": "Workforce",
        "description": "Detailed log of technician labor hours, hourly rates, and total labor cost across work orders and stores.",
        "data_source": "maintenance.worklog",
        "theme": "amber",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "worklog_id", "label": "Log ID", "width": 60, "alignment": "left"},
                {"path": "worker__username", "label": "Technician", "width": 120, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "ticket__store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "work_date", "label": "Work Date", "width": 90, "alignment": "center"},
                {"path": "hours", "label": "Hours Spent", "width": 80, "alignment": "right"},
                {"path": "hourly_rate", "label": "Hourly Rate", "width": 80, "alignment": "right"},
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
                {"path": "hours", "function": "sum", "label": "Total Hours Logged"},
                {"path": "labour_amount", "function": "sum", "label": "Total Labor Payout"}
            ],
            "kpi_cards": [
                {"path": "hours", "function": "sum", "label": "Total Hours Worked", "color": "amber"},
                {"path": "labour_amount", "function": "sum", "label": "Total Labor Cost (KWD)", "color": "amber"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Hours Worked by Technician",
                    "group_by": "worker__username",
                    "aggregate_func": "sum",
                    "aggregate_field": "hours",
                },
                {
                    "type": "bar",
                    "title": "Labor Cost by Technician",
                    "group_by": "worker__username",
                    "aggregate_func": "sum",
                    "aggregate_field": "labour_amount",
                }
            ]
        }
    },
    {
        "id": "tpl_critical_priority_alert",
        "name": "Critical & High Priority Work Order Audit",
        "category": "Maintenance",
        "description": "High-priority work orders requiring immediate attention, focusing on urgent and open maintenance issues.",
        "data_source": "maintenance.ticket",
        "theme": "coral",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "title", "label": "Ticket Title", "width": 180, "alignment": "left"},
                {"path": "store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "nature__nature_name", "label": "Work Nature", "width": 110, "alignment": "left"},
                {"path": "priority__priority_name", "label": "Priority", "width": 80, "alignment": "center"},
                {"path": "status__status_name", "label": "Status", "width": 90, "alignment": "center"},
                {"path": "created_by__username", "label": "Created By", "width": 110, "alignment": "left"},
                {"path": "created_date", "label": "Created Date", "width": 110, "alignment": "center"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": [
                    {"path": "priority__priority_name", "operator": "in", "value": ["Critical", "High"]}
                ]
            },
            "sorting": [
                {"path": "created_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "ticket_id", "function": "count", "label": "Urgent Work Orders", "color": "red"},
            ],
            "charts": [
                {
                    "type": "pie",
                    "title": "Urgent Tickets by Store Location",
                    "group_by": "store__store_name",
                    "aggregate_func": "count",
                },
                {
                    "type": "bar",
                    "title": "Urgent Tickets by Work Nature",
                    "group_by": "nature__nature_name",
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
        "id": "tpl_work_nature_breakdown",
        "name": "Work Nature & Trade Specialty Distribution",
        "category": "Maintenance",
        "description": "Categorized analysis of maintenance tickets by work nature (Electrical, HVAC, Plumbing, Civil, Refrigeration).",
        "data_source": "maintenance.ticket",
        "theme": "teal",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "title", "label": "Ticket Title", "width": 180, "alignment": "left"},
                {"path": "nature__nature_name", "label": "Work Nature", "width": 120, "alignment": "left"},
                {"path": "store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "department__department_name", "label": "Department", "width": 110, "alignment": "left"},
                {"path": "status__status_name", "label": "Status", "width": 90, "alignment": "center"},
                {"path": "created_date", "label": "Created Date", "width": 100, "alignment": "center"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "created_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "ticket_id", "function": "count", "label": "Total Tickets Analyzed", "color": "teal"},
            ],
            "charts": [
                {
                    "type": "doughnut",
                    "title": "Distribution by Work Nature",
                    "group_by": "nature__nature_name",
                    "aggregate_func": "count",
                },
                {
                    "type": "bar",
                    "title": "Work Nature by Store Location",
                    "group_by": "store__store_name",
                    "aggregate_func": "count",
                }
            ]
        }
    },
    {
        "id": "tpl_department_maintenance_overhead",
        "name": "Store Department Maintenance Overhead",
        "category": "Store Operations",
        "description": "Distribution of maintenance tickets and operational requests across store departments (Bakery, Butchery, HVAC, IT, POS).",
        "data_source": "maintenance.ticket",
        "theme": "indigo",
        "page_orientation": "portrait",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "title", "label": "Ticket Title", "width": 180, "alignment": "left"},
                {"path": "department__department_name", "label": "Department", "width": 130, "alignment": "left"},
                {"path": "store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "priority__priority_name", "label": "Priority", "width": 80, "alignment": "center"},
                {"path": "status__status_name", "label": "Status", "width": 90, "alignment": "center"},
                {"path": "created_date", "label": "Created Date", "width": 100, "alignment": "center"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "created_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "ticket_id", "function": "count", "label": "Total Department Requests", "color": "indigo"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Tickets by Department",
                    "group_by": "department__department_name",
                    "aggregate_func": "count",
                },
                {
                    "type": "pie",
                    "title": "Priority Distribution by Department",
                    "group_by": "priority__priority_name",
                    "aggregate_func": "count",
                }
            ]
        }
    },
    {
        "id": "tpl_ticket_financial_reconciliation",
        "name": "Ticket Financial Reconciliation Audit",
        "category": "Finance",
        "description": "Audit of finalized ticket financial settlements, tracking material costs, labor costs, and grand total per ticket.",
        "data_source": "finance.reconciliation",
        "theme": "emerald",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "reconciliation_id", "label": "Rec ID", "width": 60, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "ticket__store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "verified_by__username", "label": "Verified By", "width": 110, "alignment": "left"},
                {"path": "material_total", "label": "Material Total (KWD)", "width": 110, "alignment": "right", "format": ".3f"},
                {"path": "labour_total", "label": "Labor Total (KWD)", "width": 110, "alignment": "right", "format": ".3f"},
                {"path": "grand_total", "label": "Grand Total (KWD)", "width": 110, "alignment": "right", "format": ".3f"},
                {"path": "completed", "label": "Completed", "width": 90, "alignment": "center"},
                {"path": "verified_date", "label": "Verified Date", "width": 100, "alignment": "center"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "verified_date", "direction": "desc"}
            ],
            "aggregations": [
                {"path": "grand_total", "function": "sum", "label": "Total Expenditure"},
                {"path": "material_total", "function": "sum", "label": "Total Material Cost"},
                {"path": "labour_total", "function": "sum", "label": "Total Labor Cost"}
            ],
            "kpi_cards": [
                {"path": "grand_total", "function": "sum", "label": "Reconciled Expenditure (KWD)", "color": "emerald"},
                {"path": "reconciliation_id", "function": "count", "label": "Reconciled Tickets", "color": "emerald"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "Reconciled Expenditure by Store",
                    "group_by": "ticket__store__store_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "grand_total",
                }
            ]
        }
    },
    {
        "id": "tpl_ticket_status_history_audit",
        "name": "Ticket Status State Change History",
        "category": "Audit",
        "description": "Audit history of ticket status state changes, timestamps, and user transitions across the work order lifecycle.",
        "data_source": "maintenance.tickethistory",
        "theme": "purple",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "history_id", "label": "Audit ID", "width": 60, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "store__store_name", "label": "Store Location", "width": 130, "alignment": "left"},
                {"path": "changed_by__username", "label": "Changed By", "width": 110, "alignment": "left"},
                {"path": "status__status_name", "label": "Status", "width": 110, "alignment": "center"},
                {"path": "changed_date", "label": "Timestamp", "width": 120, "alignment": "center"},
                {"path": "remarks", "label": "Remarks / Reason", "width": 160, "alignment": "left"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "changed_date", "direction": "desc"}
            ],
            "kpi_cards": [
                {"path": "history_id", "function": "count", "label": "Total Status Changes Logged", "color": "purple"},
            ],
            "charts": [
                {
                    "type": "bar",
                    "title": "State Changes by User",
                    "group_by": "changed_by__username",
                    "aggregate_func": "count",
                },
                {
                    "type": "bar",
                    "title": "Status State Distribution",
                    "group_by": "status__status_name",
                    "aggregate_func": "count",
                }
            ]
        }
    },
    {
        "id": "tpl_store_expense_type_matrix",
        "name": "Store Expense Category Matrix",
        "category": "Finance",
        "description": "Matrix analysis of expense categories (Parts, Tools, External Vendor, Spare Supplies) incurred per store location.",
        "data_source": "finance.expense",
        "theme": "slate",
        "page_orientation": "landscape",
        "page_size": "A4",
        "definition": {
            "columns": [
                {"path": "expense_id", "label": "ID #", "width": 60, "alignment": "left"},
                {"path": "responsible_store__store_name", "label": "Store Location", "width": 140, "alignment": "left"},
                {"path": "expense_type__expense_name", "label": "Expense Category", "width": 130, "alignment": "left"},
                {"path": "ticket__work_order_no", "label": "WO #", "width": 90, "alignment": "left"},
                {"path": "worker__username", "label": "Submitted By", "width": 110, "alignment": "left"},
                {"path": "expense_date", "label": "Expense Date", "width": 90, "alignment": "center"},
                {"path": "amount", "label": "Amount (KWD)", "width": 95, "alignment": "right", "format": ".3f"},
            ],
            "filters": {
                "logic": "AND",
                "conditions": []
            },
            "sorting": [
                {"path": "expense_date", "direction": "desc"}
            ],
            "aggregations": [
                {"path": "amount", "function": "sum", "label": "Total Expenditure KWD"}
            ],
            "kpi_cards": [
                {"path": "amount", "function": "sum", "label": "Total Category Expense (KWD)", "color": "blue"},
                {"path": "expense_id", "function": "count", "label": "Total Expense Records", "color": "blue"},
            ],
            "charts": [
                {
                    "type": "pie",
                    "title": "Expenses by Category",
                    "group_by": "expense_type__expense_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                },
                {
                    "type": "bar",
                    "title": "Category Expenses by Store",
                    "group_by": "responsible_store__store_name",
                    "aggregate_func": "sum",
                    "aggregate_field": "amount",
                }
            ]
        }
    }
]


def get_prebuilt_templates():
    return PREBUILT_TEMPLATES
