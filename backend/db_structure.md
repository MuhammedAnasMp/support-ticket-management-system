# Database Structure Documentation

This document outlines the database schema, models, field definitions, and Django admin configurations across all apps in the Maintenance Tracker backend.

---

## Overview of Apps & Models

| App | Model Name | Primary Key | Description | Admin Registered |
|---|---|---|---|---|
| **accounts** | `Role` | `role_id` | User access roles | Yes |
| | `CustomUser` | `user_id` | Custom user model (extends `AbstractUser`) | Yes (`UserAdmin`) |
| | `PasswordResetOTP` | `id` | OTP tokens for password reset | Yes |
| | `WhatsAppLog` | `id` | Log of outgoing WhatsApp messages | Yes |
| **stores** | `Area` | `area_id` | Geographical regions/governorates | Yes |
| | `Store` | `store_id` | Retail stores and warehouses | Yes |
| | `Department` | `department_id` | High-level organizational departments | Yes |
| | `SubDepartment` | `sub_department_id` | Specialized department units | Yes |
| **maintenance** | `Priority` | `priority_id` | Ticket priority levels per department | Yes |
| | `Status` | `status_id` | Ticket workflow statuses | Yes |
| | `StatusChangeRule` | `id` | Configurable rules for status transitions | Yes |
| | `WorkNature` | `nature_id` | Nature/type of work per sub-department | Yes |
| | `NatureWorker` | `nature_worker_id` | Worker skill mapping to work natures | Yes |
| | `Ticket` | `ticket_id` | Core maintenance work order ticket | Yes |
| | `Allocation` | `allocation_id` | Worker assignment to a ticket | Yes |
| | `WorkLog` | `worklog_id` | Worker logged hours and labor costs | Yes |
| | `TicketHistory` | `history_id` | Audit trail snapshot of ticket changes | Yes |
| | `TicketChatMessage` | `message_id` | Real-time chat messages per ticket | No (Sockets/API) |
| **finance** | `ExpenseType` | `expense_type_id` | Categories/subcategories of expenses | Yes |
| | `EmployeeRate` | `rate_id` | Worker hourly pay rate history | Yes |
| | `Expense` | `expense_id` | Financial expenses attached to tickets | Yes |
| | `Reconciliation` | `reconciliation_id` | Final financial verification per ticket | Yes |
| **common** | `MediaCategory` | `category_id` | Media upload categories per department | Yes |
| | `Media` | `media_id` | Uploaded images, videos, documents | Yes |
| | `Notification` | `notification_id` | In-app user notifications | Yes |
| | `PushSubscription` | `subscription_id` | Web Push PWA subscriptions | Yes |

---

## 1. Accounts App (`apps/accounts`)

### 1.1 `Role`
Stores user roles for permission grouping.
- **Admin**: `RoleAdmin` (`role_id`, `role_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `role_id` | AutoField (PK) | Primary Key | Role unique identifier |
| `role_name` | CharField(100) | Unique | Name of the role (e.g. Store Manager, Worker) |

---

### 1.2 `CustomUser`
Custom user model extending Django's `AbstractUser`.
- **Admin**: `CustomUserAdmin` (Extends `UserAdmin`, custom fieldsets, image thumbnail preview)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `user_id` | AutoField (PK) | Primary Key | User unique identifier |
| `employee_no` | CharField(50) | Unique, Nullable, Blank | Employee identification number |
| `full_name` | CharField(255) | Required | User's full name |
| `phone` | CharField(50) | Nullable, Blank, Validator: 8 digits | Contact phone number |
| `whatsapp_number` | CharField(50) | Nullable, Blank, Validator: 8 or 10 digits | WhatsApp contact number |
| `profile_image` | ImageField | Nullable, Blank | Avatar photo (path: `profileimagse/{dept}/{subdept}/{username}.png`) |
| `role` | FK → `Role` | SET_NULL, Nullable | Assigned user role |
| `accessible_stores` | M2M → `stores.Store` | Blank, Related: `accessible_users` | Stores accessible by this user |
| `sub_departments` | M2M → `stores.SubDepartment` | Blank, Related: `users` | Sub-departments user belongs to |
| `active` | BooleanField | Default: `False` | Account approval status |
| `profile_updated_at` | DateTimeField | Nullable, Blank | Timestamp of last profile update |

*Signals*: Automatically syncs role to Django Group and moves profile image to correct department folder on sub-department change.

---

### 1.3 `PasswordResetOTP`
One-time password tokens for user password reset requests.
- **Admin**: `PasswordResetOTPAdmin` (`user`, `otp`, `is_used`, `created_at`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `id` | AutoField (PK) | Primary Key | OTP record ID |
| `user` | FK → `CustomUser` | CASCADE | User requesting reset |
| `otp` | CharField(6) | Required | 6-digit numeric OTP code |
| `created_at` | DateTimeField | auto_now_add | Generation timestamp (valid for 10 min) |
| `is_used` | BooleanField | Default: `False` | Flag indicating if OTP was consumed |

---

### 1.4 `WhatsAppLog`
Audit log of all WhatsApp messages (OTPs, notifications) sent via API.
- **Admin**: `WhatsAppLogAdmin` (`whatsapp_number`, `user`, `message_type`, `status`, `created_at`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `id` | AutoField (PK) | Primary Key | Log entry ID |
| `user` | FK → `CustomUser` | SET_NULL, Nullable | Recipient user |
| `whatsapp_number` | CharField(50) | Required | Target phone number |
| `message_type` | CharField(50) | Default: `'OTP'` | Purpose of message (e.g. OTP, Alert) |
| `otp` | CharField(6) | Nullable, Blank | OTP code sent (if applicable) |
| `payload` | TextField | Nullable, Blank | Outgoing API request payload |
| `response` | TextField | Nullable, Blank | Gateway response text |
| `status` | CharField(50) | Required | Message status (`'success'` or `'failed'`) |
| `created_at` | DateTimeField | auto_now_add | Dispatch timestamp |

---

## 2. Stores App (`apps/stores`)

### 2.1 `Area`
Geographical regions or governorates in Kuwait.
- **Admin**: `AreaAdmin` (`area_id`, `area_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `area_id` | AutoField (PK) | Primary Key | Area ID |
| `area_name` | CharField(255) | Unique | Region/Governorate name (e.g. Hawally) |

---

### 2.2 `Store`
Retail store locations, supermarkets, and warehouses.
- **Admin**: `StoreAdmin` (`store_id`, `store_name`, `area`, `address`, `phone`, `whatsapp_number`, `active`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `store_id` | CharField(20) (PK) | Primary Key | Unique store code / ID (e.g. `STORE01`) |
| `store_name` | CharField(255) | Required | Store display name |
| `type` | CharField(20) | Choices: `StoreType` | Store category (SUPER_MARKET, HYPER_MARKET, WAREHOUSE, FRESH, COSTO, CAMP) |
| `area` | FK → `Area` | SET_NULL, Nullable | Region location |
| `address` | TextField | Nullable, Blank | Physical street address |
| `phone` | CharField(50) | Nullable, Blank, Validator: 8 digits | Store phone number |
| `whatsapp_number` | CharField(50) | Nullable, Blank, Validator: 8 or 10 digits | Store WhatsApp contact |
| `longitude` | DecimalField(9,6) | Nullable, Blank | GIS Map longitude coordinate |
| `latitude` | DecimalField(9,6) | Nullable, Blank | GIS Map latitude coordinate |
| `manager` | OneToOne → `CustomUser` | SET_NULL, Nullable, Related: `managed_store` | Assigned Store Manager |
| `active` | BooleanField | Default: `True` | Operational status |
| `store_updated_at` | DateTimeField | Nullable, Blank | Timestamp of last store update |

*Signals*: Automatically syncs manager phone/WhatsApp contacts to store and manages store manager's `accessible_stores`.

---

### 2.3 `Department`
Main operational departments (e.g. Maintenance, IT, Refrigeration).
- **Admin**: `DepartmentAdmin` (`department_id`, `department_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `department_id` | AutoField (PK) | Primary Key | Department ID |
| `department_name` | CharField(255) | Required | Department title |
| `short_code` | CharField(50) | Nullable, Blank | Abbreviated department code |

---

### 2.4 `SubDepartment`
Sub-units within a department (e.g. HVAC, Electrical, Plumbing).
- **Admin**: `SubDepartmentAdmin` (`sub_department_id`, `department`, `sub_department_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `sub_department_id` | AutoField (PK) | Primary Key | Sub-department ID |
| `department` | FK → `Department` | CASCADE | Parent department |
| `sub_department_name` | CharField(255) | Required | Sub-department title |

*Signals*: Automatically creates default `WorkNature` when a new SubDepartment is created. Protects system `"Office"` sub-department from deletion.

---

## 3. Maintenance App (`apps/maintenance`)

### 3.1 `Priority`
Priority levels configured per department.
- **Admin**: `PriorityAdmin` (`priority_id`, `department`, `priority_name`, `level`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `priority_id` | AutoField (PK) | Primary Key | Priority ID |
| `department` | FK → `stores.Department` | CASCADE | Target department |
| `priority_name` | CharField(50) | Required | Priority title (e.g. Critical, High, Normal) |
| `level` | IntegerField | Required | Numeric level (higher = more urgent) |

*Constraints*: Unique constraint on `(department, priority_name)`.

---

### 3.2 `Status`
Kanban & workflow statuses for tickets.
- **Admin**: `StatusAdmin` (`order`, `status_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `status_id` | AutoField (PK) | Primary Key | Status ID |
| `status_name` | CharField(50) | Unique | Status name (e.g. Open, In Progress, Completed) |
| `active` | BooleanField | Default: `True` | Active status flag |
| `order` | PositiveIntegerField | Default: `1` | Kanban board column order |

---

### 3.3 `StatusChangeRule`
Configurable rules for status transition validations and actions.
- **Admin**: `StatusChangeRuleAdmin` (`from_status`, `to_status`, `mode`, `type`, `path`, `is_active`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `id` | AutoField (PK) | Primary Key | Rule ID |
| `from_status` | FK → `Status` | CASCADE, Related: `from_rules` | Source status |
| `to_status` | FK → `Status` | CASCADE, Related: `to_rules` | Destination status |
| `mode` | CharField(10) | Choices: `check`, `delete`, `set`, `warning` | Action mode on status transition |
| `type` | CharField(10) | Choices: `field`, `related` | Type of element validated/manipulated |
| `path` | CharField(255) | Required | Field/relationship path (e.g. `allocations.worker`) |
| `value` | CharField(255) | Nullable, Blank | Expected value for check/set mode |
| `message` | TextField | Nullable, Blank | Error/warning message shown when rule fails |
| `is_active` | BooleanField | Default: `True` | Enable/disable rule |

---

### 3.4 `WorkNature`
Specific types of maintenance work under a sub-department.
- **Admin**: `WorkNatureAdmin` (`nature_id`, `nature_name`, `sub_department`, `default_priority`, `active`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `nature_id` | AutoField (PK) | Primary Key | Work nature ID |
| `nature_name` | CharField(255) | Required | Nature of work (e.g. AC Filter Replacement) |
| `sub_department` | FK → `stores.SubDepartment` | CASCADE | Parent sub-department |
| `default_priority` | FK → `Priority` | SET_NULL, Nullable | Default priority for tickets of this nature |
| `media_required` | BooleanField | Default: `True` | Flag requiring photo before completion |
| `active` | BooleanField | Default: `True` | Active state flag |

---

### 3.5 `NatureWorker`
Skill matrix mapping workers to work natures.
- **Admin**: `NatureWorkerAdmin` (`nature_worker_id`, `nature`, `worker`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `nature_worker_id` | AutoField (PK) | Primary Key | Mapping ID |
| `nature` | FK → `WorkNature` | CASCADE | Target work nature |
| `worker` | FK → `accounts.CustomUser` | CASCADE | Qualified worker |

---

### 3.6 `Ticket`
Core work order maintenance ticket.
- **Admin**: `TicketAdmin` (`ticket_id`, `work_order_no`, `store`, `department`, `nature`, `priority`, `status`, `created_by`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `ticket_id` | AutoField (PK) | Primary Key | Internal ticket ID |
| `work_order_no` | CharField(100) | Unique | Public work order number (e.g. `WO-2026-001`) |
| `store` | FK → `stores.Store` | CASCADE | Store location where work is requested |
| `department` | FK → `stores.Department` | CASCADE | Target maintenance department |
| `nature` | FK → `WorkNature` | CASCADE | Work nature category |
| `priority` | FK → `Priority` | PROTECT | Priority level |
| `status` | FK → `Status` | PROTECT | Current status |
| `title` | CharField(255) | Required | Brief summary title |
| `description` | TextField | Required | Full problem description |
| `created_by` | FK → `accounts.CustomUser` | PROTECT | Ticket creator |
| `created_date` | DateTimeField | auto_now_add | Creation timestamp |
| `approved_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Approver user |
| `approved_date` | DateTimeField | Nullable, Blank | Approval timestamp |
| `rejected_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Rejecter user |
| `rejected_date` | DateTimeField | Nullable, Blank | Rejection timestamp |
| `reject_reason` | TextField | Nullable, Blank | Explanation for ticket rejection |
| `closed_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Closing user |
| `closed_date` | DateTimeField | Nullable, Blank | Ticket closing timestamp |
| `location_approval` | CharField(100) | Default: `'Pending'`, Nullable | On-site Store Manager approval status |
| `location_approved_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Store Manager who approved location |
| `location_approved_date` | DateTimeField | Nullable, Blank | Store Manager approval timestamp |
| `location_reject_reason` | TextField | Nullable, Blank | Store Manager rejection reason |
| `device_info` | CharField(255) | Nullable, Blank | Mobile device hardware/browser info |

*Signals*: Automatically creates `TicketHistory` snapshots, triggers notifications (push & in-app), and broadcasts WebSocket updates.

---

### 3.7 `Allocation`
Worker assignment to a ticket.
- **Admin**: `AllocationAdmin` (`allocation_id`, `ticket`, `worker`, `assigned_by`, `planned_hours`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `allocation_id` | AutoField (PK) | Primary Key | Allocation ID |
| `ticket` | FK → `Ticket` | CASCADE | Assigned ticket |
| `worker` | FK → `accounts.CustomUser` | CASCADE | Assigned worker |
| `assigned_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Dispatcher / Manager who assigned |
| `assigned_date` | DateTimeField | auto_now_add | Assignment timestamp |
| `planned_hours` | DecimalField(5,2) | Required | Estimated hours required |
| `remarks` | TextField | Nullable, Blank | Special instructions for worker |
| `voice_note` | FileField | Nullable, Blank | Audio recording note for worker |

---

### 3.8 `WorkLog`
Log of actual labor hours and work done by a worker.
- **Admin**: `WorkLogAdmin` (`worklog_id`, `ticket`, `worker`, `work_date`, `hours`, `hourly_rate`, `labour_amount`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `worklog_id` | AutoField (PK) | Primary Key | Work log ID |
| `ticket` | FK → `Ticket` | CASCADE | Target ticket |
| `worker` | FK → `accounts.CustomUser` | CASCADE | Worker logging time |
| `allocation` | FK → `Allocation` | SET_NULL, Nullable | Associated allocation record |
| `work_date` | DateField | Required | Date work was performed |
| `hours` | DecimalField(5,2) | Required | Total hours worked |
| `hourly_rate` | DecimalField(10,2) | Required | Pay rate applied per hour |
| `labour_amount` | DecimalField(10,2) | Required | Calculated labor cost (`hours * hourly_rate`) |
| `work_done` | TextField | Required | Summary of work completed |
| `created_date` | DateTimeField | auto_now_add | Log creation timestamp |

---

### 3.9 `TicketHistory`
Audit log snapshot tracking all ticket status changes and duration in each status.
- **Admin**: `TicketHistoryAdmin` (`history_id`, `ticket`, `status`, `changed_by`, `changed_date`, `age_days`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `history_id` | AutoField (PK) | Primary Key | History record ID |
| `ticket` | FK → `Ticket` | CASCADE | Target ticket |
| `store` | FK → `stores.Store` | SET_NULL, Nullable | Snapshot of store |
| `department` | FK → `stores.Department` | SET_NULL, Nullable | Snapshot of department |
| `nature` | FK → `WorkNature` | SET_NULL, Nullable | Snapshot of work nature |
| `priority` | FK → `Priority` | SET_NULL, Nullable | Snapshot of priority |
| `status` | FK → `Status` | SET_NULL, Nullable | Snapshot of status |
| `title` | CharField(255) | Nullable, Blank | Snapshot of ticket title |
| `description` | TextField | Nullable, Blank | Snapshot of description |
| `created_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Snapshot of creator |
| `created_date` | DateTimeField | Nullable, Blank | Snapshot of creation date |
| `approved_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Snapshot of approver |
| `approved_date` | DateTimeField | Nullable, Blank | Snapshot of approval date |
| `rejected_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Snapshot of rejecter |
| `rejected_date` | DateTimeField | Nullable, Blank | Snapshot of rejection date |
| `reject_reason` | TextField | Nullable, Blank | Snapshot of reject reason |
| `closed_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Snapshot of closer |
| `closed_date` | DateTimeField | Nullable, Blank | Snapshot of closing date |
| `location_approval` | CharField(100) | Default: `'Pending'` | Snapshot of location approval status |
| `location_approved_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Snapshot of location approver |
| `location_approved_date` | DateTimeField | Nullable, Blank | Snapshot of location approval date |
| `location_reject_reason` | TextField | Nullable, Blank | Snapshot of location reject reason |
| `changed_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | User who performed state change |
| `changed_date` | DateTimeField | auto_now_add | Timestamp of change |
| `remarks` | TextField | Nullable, Blank | Transition notes / reason |
| `age_days` | DecimalField(10,4) | Default: `0.0` | Total days spent in this status |

---

### 3.10 `TicketChatMessage`
Real-time messaging per ticket between workers, office admins, and store managers.
- **Admin**: Not registered (managed via WebSocket & REST APIs)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `message_id` | AutoField (PK) | Primary Key | Chat message ID |
| `ticket` | FK → `Ticket` | CASCADE | Target ticket |
| `sender` | FK → `accounts.CustomUser` | CASCADE | Message author |
| `message_text` | TextField | Nullable, Blank | Text content |
| `image` | ImageField | Nullable, Blank | Uploaded chat photo |
| `video` | FileField | Nullable, Blank | Uploaded chat video |
| `voice` | FileField | Nullable, Blank | Uploaded chat voice recording |
| `created_date` | DateTimeField | auto_now_add | Sent timestamp |

*Signals*: Broadcasts message via Django Channels to WebSocket group `chat_ticket_{ticket_id}`.

---

## 4. Finance App (`apps/finance`)

### 4.1 `ExpenseType`
Categories and subcategories of expenses.
- **Admin**: `ExpenseTypeAdmin` (`expense_type_id`, `department`, `expense_name`, `parent`, `approve_required`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `expense_type_id` | AutoField (PK) | Primary Key | Expense type ID |
| `department` | FK → `stores.Department` | CASCADE | Target department |
| `expense_name` | CharField(100) | Required | Expense category name |
| `parent` | FK → `self` | SET_NULL, Nullable | Parent category for hierarchical nesting |
| `required` | BooleanField | Default: `True` | Flag requiring expense detail |
| `approve_required` | BooleanField | Default: `False` | Flag requiring manager approval |

*Constraints*: Unique constraint on `(department, expense_name)`.

---

### 4.2 `EmployeeRate`
Worker hourly pay rates over time.
- **Admin**: `EmployeeRateAdmin` (`rate_id`, `worker`, `hourly_rate`, `effective_from`, `effective_to`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `rate_id` | AutoField (PK) | Primary Key | Rate record ID |
| `worker` | FK → `accounts.CustomUser` | CASCADE | Target worker |
| `hourly_rate` | DecimalField(10,2) | Required | Hourly rate amount |
| `effective_from` | DateField | Required | Start date of rate |
| `effective_to` | DateField | Nullable, Blank | Expiration date of rate |

---

### 4.3 `Expense`
Financial expenditure incurred on a ticket (materials, spare parts, transport).
- **Admin**: `ExpenseAdmin` (`expense_id`, `ticket`, `worker`, `expense_type`, `amount`, `approved`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `expense_id` | AutoField (PK) | Primary Key | Expense record ID |
| `ticket` | FK → `maintenance.Ticket` | CASCADE | Target ticket |
| `worker` | FK → `accounts.CustomUser` | CASCADE | Worker claiming expense |
| `expense_type` | FK → `ExpenseType` | PROTECT | Category of expense |
| `amount` | DecimalField(10,2) | Required | Monetary amount |
| `expense_date` | DateField | Required | Date of expenditure |
| `remarks` | TextField | Nullable, Blank | Expense details / notes |
| `approved` | BooleanField | Default: `False` | Manager approval status |
| `approved_by` | FK → `accounts.CustomUser` | SET_NULL, Nullable | Approver user |
| `responsible_store` | FK → `stores.Store` | SET_NULL, Nullable | Store charged for expense |

---

### 4.4 `Reconciliation`
Final financial reconciliation of a ticket before closure.
- **Admin**: `ReconciliationAdmin` (`reconciliation_id`, `ticket`, `verified_by`, `grand_total`, `completed`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `reconciliation_id` | AutoField (PK) | Primary Key | Reconciliation ID |
| `ticket` | OneToOne → `maintenance.Ticket` | CASCADE | Target ticket |
| `verified_by` | FK → `accounts.CustomUser` | PROTECT | Verifying accountant / manager |
| `labour_total` | DecimalField(12,2) | Required | Total labor cost accumulated |
| `expense_total` | DecimalField(12,2) | Required | Total expenses accumulated |
| `material_total` | DecimalField(12,2) | Required | Total spare parts/material cost |
| `grand_total` | DecimalField(12,2) | Required | Final total cost (`labour + expense + material`) |
| `remarks` | TextField | Nullable, Blank | Verification notes |
| `verified_date` | DateTimeField | auto_now_add | Verification timestamp |
| `completed` | BooleanField | Default: `False` | Completion flag |

---

## 5. Common App (`apps/common`)

### 5.1 `MediaCategory`
Categories for media uploads (e.g. Before Repair, After Repair, Invoice).
- **Admin**: `MediaCategoryAdmin` (`category_id`, `department`, `category_name`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `category_id` | AutoField (PK) | Primary Key | Category ID |
| `department` | FK → `stores.Department` | CASCADE | Target department |
| `category_name` | CharField(100) | Required | Media category name |

*Constraints*: Unique constraint on `(department, category_name)`.

---

### 5.2 `Media`
Uploaded files (photos, documents, receipts) linked to tickets or expenses.
- **Admin**: `MediaAdmin` (`media_id`, `file_name`, `ticket`, `uploaded_by`, `category`, `uploaded_date`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `media_id` | AutoField (PK) | Primary Key | Media ID |
| `ticket` | FK → `maintenance.Ticket` | CASCADE, Nullable | Associated ticket |
| `uploaded_by` | FK → `accounts.CustomUser` | CASCADE | Uploader user |
| `category` | FK → `MediaCategory` | SET_NULL, Nullable | Media category |
| `expense` | FK → `finance.Expense` | SET_NULL, Nullable | Associated expense |
| `file_name` | CharField(255) | Required | Original filename |
| `file_url` | FileField | Upload Path Dynamic | Storage file path (`stores/{store}/tickets/ticket_{id}/{category}/{filename}`) |
| `uploaded_date` | DateTimeField | auto_now_add | Upload timestamp |

*Signals*: Automatically compresses images asynchronously upon creation.

---

### 5.3 `Notification`
In-app user notifications.
- **Admin**: `NotificationAdmin` (`notification_id`, `user`, `ticket`, `notification_type`, `title`, `is_read`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `notification_id` | AutoField (PK) | Primary Key | Notification ID |
| `user` | FK → `accounts.CustomUser` | CASCADE | Recipient user |
| `ticket` | FK → `maintenance.Ticket` | CASCADE, Nullable | Related ticket |
| `notification_type` | CharField(50) | Required | Type of notification (e.g. Assignment, Approved, High Priority) |
| `title` | CharField(255) | Required | Notification title |
| `message` | TextField | Required | Body text |
| `image` | TextField | Nullable, Blank | Attached thumbnail image URL |
| `is_read` | BooleanField | Default: `False` | Read status |
| `created_date` | DateTimeField | auto_now_add | Creation timestamp |

*Signals*: Triggers Web Push Notification and broadcasts via WebSocket to `user_{user_id}` group.

---

### 5.4 `PushSubscription`
Web Push PWA subscription details for browser push notifications.
- **Admin**: Registered (`PushSubscription`)

| Field Name | Type / Ref | Constraints / Default | Minimal Description |
|---|---|---|---|
| `subscription_id` | AutoField (PK) | Primary Key | Subscription ID |
| `user` | FK → `accounts.CustomUser` | CASCADE | Subscriber user |
| `endpoint` | TextField | Unique | Web push subscription endpoint URL |
| `p256dh` | TextField | Required | Encryption public key |
| `auth` | TextField | Required | Authentication secret key |
| `created_date` | DateTimeField | auto_now_add | Creation timestamp |
| `updated_date` | DateTimeField | auto_now | Update timestamp |
| `is_active` | BooleanField | Default: `True` | Active status flag |

---
