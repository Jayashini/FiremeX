# 🛡️ FiremeX — User Management System Documentation

## Executive Overview
FiremeX implements a **Multi-Tenant, Role-Based User Management System** built using **Go (Gin framework)**, **GORM ORM**, **PostgreSQL**, and **Preact (TypeScript)**. 

The architecture supports multi-tenant organization boundaries, automated Organization Code generation, an admin approval gate for operators, and strict JWT authentication coupled with Role-Based Access Control (RBAC) middleware.

---

## 👥 Roles & Permission Matrix

| Role | Default Status | Scope | Permissions & Capabilities |
|---|---|---|---|
| **`admin`** | `active` | Organization-wide | Full control. Registers company profile, views system dashboards, configures CCTV hardware, approves/denies/revokes operators. |
| **`operator`** | `pending` | Assigned Organization | On-duty monitoring agent. Views live video streams, receives real-time AI fire alerts, acknowledges alerts, and updates incident statuses. |

---

## 🔄 User Lifecycle & Approval Workflow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REGISTRATION GATEWAY                            │
└────────────────────────────────────────────────────────────────────────┘
                    │                                │
                    ▼                                ▼
     ┌────────────────────────────┐    ┌────────────────────────────┐
     │ 1. REGISTER ORGANIZATION   │    │  2. JOIN AS AN OPERATOR    │
     └────────────────────────────┘    └────────────────────────────┘
                    │                                │
     Creates Organization record       Requires valid Organization Code
     + Admin user (Status: ACTIVE)     Creates Operator (Status: PENDING)
                    │                                │
                    ▼                                ▼
       Admin logs in immediately         Operator login is BLOCKED
       Accesses Admin Dashboard          ("Pending Admin Approval")
                    │                                │
                    │    ┌──────────────────────┐    │
                    └───►│ ADMIN APPROVAL PANEL │◄───┘
                         └──────────────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
              [APPROVE OPERATOR]           [DENY OPERATOR]
                      │                           │
              Status = ACTIVE             User permanently
              Operator can log in         deleted from database
```

---

## 🔑 Key Workflows Explained

### 1. Organization & Admin Onboarding
- When a new company registers on FiremeX, an **Organization** record and its primary **Admin user** are created together in an atomic database transaction.
- The system automatically generates a unique 3-digit Organization Code (e.g. `ORG-492`).
- The Admin's account is automatically set to `status: "active"`, allowing immediate login.
- The Organization Code (`ORG-492`) is shared by the Admin with their monitoring staff.

### 2. Operator Onboarding & Gatekeeping
- An Operator registers by providing their name, personal work email, password, and their company's Organization Code (`ORG-492`).
- The backend validates the Organization Code in PostgreSQL.
- If valid, the Operator user is created with `role: "operator"` and `status: "pending"`.
- **Gatekeeping:** If a pending operator attempts to sign in, the authentication system rejects the request: `"Your account is pending administrator approval"`.

### 3. Admin Control Panel (Approve / Deny / Revoke)
- Logged-in Admins access the **User Management** page (`/FiremeX/admin/users`).
- The panel fetches real-time user lists from the backend split into **Active Operators** and **Pending Requests**.
- **Approve:** Updates operator status to `active`. The operator can now log in.
- **Deny:** Deletes the pending registration request from PostgreSQL.
- **Revoke:** Changes an active operator's status to `revoked`. Instantly cuts off their access to the system.

---

## 🔒 Security Architecture

```
[Incoming Request] ──► [1. CORS Check] ──► [2. JWT Auth Guard] ──► [3. Admin RBAC Guard] ──► [Controller Action]
```

1. **Password Encryption (`bcrypt`)**: All user passwords are encrypted using `bcrypt` hashing before storage. Raw passwords are never stored.
2. **Hidden Passwords in API (`json:"-"`)**: The User model explicitly hides password hashes from JSON serialization (`json:"-"`), preventing hash leakage in API responses.
3. **JWT Authentication**: Upon valid login, the backend issues a signed 24-hour JSON Web Token (JWT).
4. **Role-Based Middleware (`RequireAdmin`)**: Protects user management endpoints. Requests without an `admin` role receive a `403 Forbidden` response.
5. **Status Enforcement**: The `Login` controller verifies account status before token generation. Accounts with `pending` or `revoked` status are rejected.

---

## 🗄️ Database Entity Schema

### `organizations` Table
| Column | Type | Description |
|---|---|---|
| `id` | `uint` (PK) | Auto-increment primary key |
| `name` | `string` | Company name (e.g. "SafeGuard Logistics") |
| `code` | `string` (Unique) | Auto-generated code (e.g. "ORG-492") |
| `sector` | `string` | Industry sector (Industrial, Commercial, Healthcare, etc.) |
| `email` | `string` | Business contact email |
| `phone` | `string` | Contact phone number |

### `users` Table
| Column | Type | Description |
|---|---|---|
| `id` | `uint` (PK) | Auto-increment primary key |
| `name` | `string` | User's full name |
| `email` | `string` (Unique) | User's email address (login username) |
| `password` | `string` | Encrypted bcrypt hash (hidden from JSON output) |
| `role` | `string` | System role: `"admin"` or `"operator"` |
| `status` | `string` | Approval state: `"pending"`, `"active"`, or `"revoked"` |
| `organization_id` | `uint` (FK) | References `organizations.id` |

---

## 🌐 API Endpoint Reference

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/login` | Public | Authenticates credentials and returns JWT token |
| `POST` | `/register/organization` | Public | Registers a new Org + Admin user (returns `org_code`) |
| `POST` | `/register/operator` | Public | Submits a pending operator registration request |
| `GET` | `/api/users` | Protected (Admin) | Returns active operators & pending registration requests |
| `PATCH` | `/api/users/:id/approve` | Protected (Admin) | Approves a pending operator (`status -> active`) |
| `DELETE` | `/api/users/:id/deny` | Protected (Admin) | Denies and deletes a pending request |
| `PATCH` | `/api/users/:id/revoke` | Protected (Admin) | Revokes an operator's access (`status -> revoked`) |
