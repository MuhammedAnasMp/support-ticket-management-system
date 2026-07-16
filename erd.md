erDiagram

    STORE {
        int store_id PK
        int manager_id FK
        int area_id FK
        string store_name
        string address
        string phone
        string whatsapp_number
        decimal longitude
        decimal latitude
        bool active
    }

    AREA {
        int area_id PK
        string area_name
    }

    DEPARTMENT {
        int department_id PK
        string department_name
    }

    SUB_DEPARTMENT {
        int sub_department_id PK
        int department_id FK
        string sub_department_name
    }

    ROLE {
        int role_id PK
        string role_name
    }

    USER {
        int user_id PK
        string employee_no
        string full_name
        string email
        string phone
        string whatsapp_number
        string profile_image
        int role_id FK
        int store_id FK
        bool active
    }

    PRIORITY {
        int priority_id PK
        string priority_name
        int level
    }

    STATUS {
        int status_id PK
        string status_name
    }

    MAINTENANCE_NATURE {
        int nature_id PK
        string nature_name
        int sub_department_id FK
        int default_priority_id FK
        bool active
    }

    NATURE_WORKER {
        int nature_worker_id PK
        int nature_id FK
        int worker_id FK
    }

    EMPLOYEE_RATE {
        int rate_id PK
        int worker_id FK
        decimal hourly_rate
        date effective_from
        date effective_to
    }

    TICKET {
        int ticket_id PK
        string work_order_no
        int store_id FK
        int department_id FK
        int nature_id FK
        int priority_id FK
        int status_id FK
        string title
        string description
        int created_by FK
        datetime created_date
        int approved_by FK
        datetime approved_date
        int rejected_by FK
        datetime rejected_date
        string reject_reason
        int closed_by FK
        datetime closed_date
    }

    ALLOCATION {
        int allocation_id PK
        int ticket_id FK
        int worker_id FK
        int assigned_by FK
        datetime assigned_date
        decimal planned_hours
        string remarks
    }

    WORK_LOG {
        int worklog_id PK
        int ticket_id FK
        int worker_id FK
        int allocation_id FK
        date work_date
        decimal hours
        decimal hourly_rate
        decimal labour_amount
        string work_done
        datetime created_date
    }

    EXPENSE_TYPE {
        int expense_type_id PK
        int parent_id FK
        string expense_name
    }

    EXPENSE {
        int expense_id PK
        int ticket_id FK
        int worker_id FK
        int expense_type_id FK
        int responsible_store_id FK
        int receipt_id FK
        decimal amount
        date expense_date
        string remarks
        bool approved
        int approved_by FK
    }

    MEDIA_CATEGORY {
        int category_id PK
        string category_name
    }

    MEDIA {
        int media_id PK
        int ticket_id FK
        int uploaded_by FK
        int category_id FK
        string file_name
        string file_url
        datetime uploaded_date
    }

    RECONCILIATION {
        int reconciliation_id PK
        int ticket_id FK
        int verified_by FK
        decimal labour_total
        decimal expense_total
        decimal material_total
        decimal grand_total
        string remarks
        datetime verified_date
        bool completed
    }

    NOTIFICATION {
        int notification_id PK
        int user_id FK
        int ticket_id FK
        string notification_type
        string title
        string message
        bool is_read
        datetime created_date
    }

    TICKET_HISTORY {
        int history_id PK
        int ticket_id FK
        int status_id FK
        int changed_by FK
        datetime changed_date
        string remarks
    }

    AREA ||--o{ STORE : contains
    STORE ||--o{ USER : has
    STORE ||--o| USER : managed_by
    STORE ||--o{ TICKET : creates
    STORE ||--o{ EXPENSE : responsible_for

    ROLE ||--o{ USER : assigned

    DEPARTMENT ||--o{ SUB_DEPARTMENT : contains
    SUB_DEPARTMENT ||--o{ MAINTENANCE_NATURE : group

    USER }o--o{ SUB_DEPARTMENT : assigned_sub_departments
    USER }o--o{ STORE : accessible_stores

    PRIORITY ||--o{ MAINTENANCE_NATURE : default_priority
    PRIORITY ||--o{ TICKET : priority

    STATUS ||--o{ TICKET : status

    MAINTENANCE_NATURE ||--o{ NATURE_WORKER : default_workers
    MAINTENANCE_NATURE ||--o{ TICKET : category

    USER ||--o{ NATURE_WORKER : skilled_worker

    USER ||--o{ EMPLOYEE_RATE : rate_history

    USER ||--o{ TICKET : creates
    USER ||--o{ ALLOCATION : assigned_worker
    USER ||--o{ ALLOCATION : assigned_by

    USER ||--o{ WORK_LOG : logs_work

    USER ||--o{ EXPENSE : claims

    USER ||--o{ MEDIA : uploads

    USER ||--o{ RECONCILIATION : verifies

    USER ||--o{ NOTIFICATION : receives

    USER ||--o{ TICKET_HISTORY : changes

    TICKET ||--o{ ALLOCATION : assignments

    TICKET ||--o{ WORK_LOG : work_logs

    TICKET ||--o{ EXPENSE : expenses

    TICKET ||--o{ MEDIA : attachments

    TICKET ||--|| RECONCILIATION : reconciliation

    TICKET ||--o{ NOTIFICATION : notifications

    TICKET ||--o{ TICKET_HISTORY : history

    EXPENSE_TYPE ||--o{ EXPENSE : type
    EXPENSE_TYPE }o--o| EXPENSE_TYPE : parent

    MEDIA_CATEGORY ||--o{ MEDIA : category

    EXPENSE }o--o| MEDIA : receipt







Suggested django app and model development order

accounts
├── CustomUser
├── Role
├── Authentication
└── Permissions

common
├── MediaCategory
├── Media
└── Notification

stores
├── Area
├── Store
├── Department
└── SubDepartment

maintenance
├── Priority
├── Status
├── MaintenanceNature
├── NatureWorker
├── Ticket
├── Allocation
├── WorkLog
└── TicketHistory

finance
├── ExpenseType
├── EmployeeRate
├── Expense
└── Reconciliation


Media Storage Path Convention

media/
 └── stores/
      └── <store_name>/
           └── tickets/
                └── ticket_<id>/
                     ├── issue_media/
                     ├── before_repair/
                     ├── after_repair/
                     ├── receipt/
                     ├── worker_photo/
                     └── material_photo/

## Business Rules & Permissions

- **Store Manager**: Every store has exactly one Store Manager (modeled as `manager` OneToOneField from `Store` to `User`).
- **Ticket Creation**: Any user (e.g. Store Manager, Assistant Manager, Staff, Office Staff, Area Manager) can create tickets, provided their role has the role-based permission (`create_ticket`).
- **Store Belonging**: Users may belong to a store (modeled as `store` ForeignKey on `User`).
- **Ticket Assignment**: A ticket is linked to the store it was created for and records the user who created it (`store` and `created_by` ForeignKeys on `Ticket`).
- **Store Grouping (Area)**: Stores are grouped based on geographic or administrative Areas (modeled as `area` ForeignKey from `Store` to `Area`).
