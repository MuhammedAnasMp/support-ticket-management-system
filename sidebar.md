

## Web Application Sidebar

### 🏠 Dashboard

* Overall Statistics
* Open Tickets
* Pending Approvals
* Recent Activities
* Notifications

---

### 🎫 Tickets

* Create Ticket
* All Tickets
* My Tickets
* Pending Approval
* Assigned
* In Progress
* Completed
* Closed
* Rejected

> Ticket details include:
>
> * Issue information
> * Photos
> * Work logs
> * Expenses
> * Timeline
> * Comments
> * Worker assignments

---

### 🏬 Stores

* Stores
* Departments
* Sub Departments

---

### 🔧 Maintenance

* Maintenance Nature
* Default Worker Assignment
* Priorities
* Statuses

---

### 👥 Workforce

* Employees
* Employee Rates
* Worker Skills (Nature Assignment)

---

### 🧾 Expense Approval *(Office Staff Only)*

This module is **not accounting**. Its purpose is to validate and approve expenses submitted by workers.

* Pending Expense Claims
* Approved Expenses
* Rejected Expenses
* Expense Types

Each expense includes:

* Ticket reference
* Worker
* Amount
* Receipt image
* Expense date
* Remarks
* Office approval/rejection
* Approval history

Office staff can:

* Review receipts.
* Verify the expense matches the ticket.
* Approve or reject the claim.
* Add rejection reasons.
* Track approved expenses for reconciliation.

---

### 📊 Reports

* Ticket Report
* Store Performance
* Labour Cost
* Expense Report
* Worker Performance
* Monthly Summary
* Reconciliation Report

---

### 👤 Administration

* Users
* Roles
* Permissions
* System Settings

---

# Store Manager Mobile App

### 🏠 Home

* My Open Tickets
* In Progress
* Completed
* Notifications

---

### ➕ Report Issue

* Select Department
* Select Maintenance Nature
* Enter Description
* Attach Photos
* Submit

---

### 🎫 My Store Tickets

* View Status
* View Assigned Worker
* Upload Additional Photos
* Add Comments
* View Work Progress

---

### 🔔 Notifications

* Ticket Approved
* Worker Assigned
* Work Started
* Work Completed
* Ticket Closed

---

### 👤 Profile

* My Details
* Change Password
* Logout

---

# Worker Mobile App

### 🏠 Home

* Today's Jobs
* Upcoming Jobs
* Notifications

---

### 📋 My Jobs

Workers can:

* View assigned jobs.
* Accept a job.
* Start work.
* Pause or resume work.
* Complete work.

---

### ⏱ Work Log

* Record working hours.
* Describe work completed.
* View previous work logs.

---

### 💰 Expenses

Workers can:

* Submit expense claims.
* Upload receipt photos.
* View claim status (Pending, Approved, Rejected).
* See rejection reasons if applicable.

> Workers **cannot approve** their own expenses. Every submitted expense must be reviewed and approved by office staff before it is included in the ticket reconciliation.

---

### 👤 Profile

* Personal Information
* Change Password
* Logout

## Expense Approval Workflow

```text
Worker
   │
   ├── Performs maintenance
   ├── Submits expense + receipt
   │
   ▼
Expense Status = Pending
   │
   ▼
Office Staff Review
   │
   ├── Validate receipt
   ├── Verify ticket
   ├── Check amount
   │
   ├── Approve ✔
   │        │
   │        ▼
   │   Included in Reconciliation
   │
   └── Reject ✖
            │
            ▼
     Rejection reason sent to worker
```

This structure keeps the system focused:

* **Tickets** handle the operational maintenance process.
* **Expense Approval** handles financial validation by office staff.
* **Reports** provide management insight.
* **Administration** manages users and system configuration.
* Store managers and workers each have streamlined mobile apps tailored to their responsibilities.




