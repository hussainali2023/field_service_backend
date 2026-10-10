# 🛠️ FieldPulse - Field Service Management Backend REST API

A production-grade, multi-tenant Field Service Management REST API built with **Node.js**, **Express.js**, **TypeScript**, **PostgreSQL (Neon)**, **Prisma ORM**, **Redis**, **Multer & Cloudinary**, and **Stripe Payment Gateway**.

---

## 🔑 Demo Credentials for Evaluation

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@fieldservice.com` | `Admin@12345` | System Analytics, User Management, Dispatch, Invoices, Audit Logs |
| **Technician (Provider)** | `technician@fieldservice.com` | `Tech@12345` | Job Desk, Status Transitions, Diagnostic Reports, Customer Reviews |
| **Customer (User)** | `customer@fieldservice.com` | `Customer@12345` | Request Services, View Estimates, Online Stripe Payments, Feedback |

---

## 🚀 Key Features & Architectural Highlights

1. **Role-Based Access Control (RBAC)**:
   - 3 Fixed Roles: `ADMIN`, `TECHNICIAN`, `CUSTOMER`.
   - Bearer JWT authentication (Access & Refresh tokens) + GCP Social Login + Role guard middlewares.

2. **Stripe Payment Integration**:
   - Secure Stripe Checkout Sessions for generated invoices.
   - Real-time cryptographic Webhook listener (`/api/v1/payments/webhook`) & client verification fallback (`/api/v1/payments/verify`).
   - Transaction-safe atomic invoice & payment settlement using Prisma `$transaction`.

3. **High-Performance Redis Caching**:
   - In-memory cache layer with automatic TTL and pattern invalidation.
   - Caches public service catalogs (`services:list:*`) and Admin analytics dashboard (`admin:dashboard:stats`).
   - Redis-backed secure password reset tokens (`pwd_reset:<email>`).

4. **Multer & Cloudinary File Storage**:
   - Multer memory storage upload pipelines with MIME type filtering and file size caps.
   - Cloudinary stream uploader for user profile avatars and job attachments/reports.
   - Resilient base64 fallback mechanism if external cloud credentials are offline.

5. **Concurrency & Business Workflows**:
   - Schedule conflict detection: Prevents double-booking technicians during active timeframes.
   - Comprehensive request state machine: `REQUESTED` ➔ `REVIEWED` ➔ `ASSIGNED` ➔ `SCHEDULED` ➔ `ON_THE_WAY` ➔ `IN_PROGRESS` ➔ `COMPLETED` / `CANCELLED`.
   - Complete audit logging on all critical business operations (`AuditLog`).

---

## 📋 Technology Stack

- **Runtime & Language**: Node.js, TypeScript
- **Web Framework**: Express.js (v5)
- **Database & ORM**: PostgreSQL (Neon Serverless) + Prisma 7
- **Validation**: Zod (Strict schema validation on all inputs)
- **Caching & Temporary State**: Redis (v6) with resilient memory fallback
- **File Upload**: Multer + Cloudinary (v2)
- **Payment Processing**: Stripe API (Test Mode)
- **Security**: Helmet, CORS, Express-Rate-Limit, Bcrypt.js, JSON Web Tokens

---

## 🛠️ Getting Started Locally

### 1. Prerequisites
- Node.js (v20+ recommended)
- `pnpm` (or `npm`)

### 2. Environment Configuration
Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Ensure variables are configured:
```env
PORT=5000
DATABASE_URL="postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require"
JWT_ACCESS_SECRET="your-jwt-access-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
CLIENT_URL="http://localhost:3000"
REDIS_HOST="localhost"
REDIS_PORT=6379
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Setup & Seeding
```bash
# Push schema to database
pnpm db:push

# Generate Prisma client
pnpm db:generate

# Seed realistic demo data and credentials
pnpm db:seed
```

### 5. Run the Server
```bash
# Development (with live reload)
pnpm dev

# Build production bundle
pnpm build

# Start production server
pnpm start
```

---

## 📑 API Endpoints Summary (45+ Endpoints)

All endpoints conform to standard JSON format:
- **Success**: `{ "success": true, "message": "...", "data": {} }`
- **Error**: `{ "success": false, "message": "...", "errors": [] }`

### 1. Authentication (`/api/v1/auth`)
- `POST /register` - Register new customer or technician
- `POST /login` - Sign in with email & password
- `POST /google` - GCP Social Login
- `POST /refresh-token` - Refresh access token
- `GET /me` - Get current authenticated user profile
- `POST /change-password` - Change existing password
- `POST /forgot-password` - Generate Redis-backed password reset token
- `POST /reset-password` - Verify token and update password

### 2. Users (`/api/v1/users`)
- `GET /` - List users with pagination and filtering (Admin)
- `POST /` - Admin create user with specified role & password
- `GET /:id` - Get single user details
- `PATCH /me` - Update profile information
- `PATCH /me/avatar` - Upload profile avatar image (Multer + Cloudinary)
- `PATCH /:id/status` - Block / activate user (Admin)
- `DELETE /:id` - Soft-delete user (Admin)

### 3. File Uploads (`/api/v1/upload`)
- `POST /single` - Upload single file/image via Multer & Cloudinary
- `POST /multiple` - Upload up to 5 attachments simultaneously

### 4. Technicians (`/api/v1/technicians`)
- `GET /` - List technicians with skill filtering and availability
- `GET /me` - Get technician's own profile and performance stats
- `PATCH /me` - Update technician skills, hourly rate, and availability
- `GET /:id` - Get technician public profile

### 5. Services (`/api/v1/services`)
- `GET /` - List services catalog (Redis Cached)
- `GET /:id` - Get service details
- `POST /` - Create new service offering (Admin)
- `PATCH /:id` - Update service pricing/info (Admin)
- `DELETE /:id` - Soft-delete service (Admin)

### 6. Service Requests / Work Orders (`/api/v1/service-requests`)
- `POST /` - Create new service request (Customer)
- `GET /` - List requests with search, pagination, status filters
- `GET /my-requests` - Customer's own service requests
- `GET /assigned-jobs` - Technician's assigned jobs desk
- `GET /:id` - Detailed service request inspection
- `PATCH /:id/assign` - Assign technician & schedule visit (Admin)
- `PATCH /:id/status` - Transition work order status (Technician / Admin)
- `PATCH /:id/report` - Submit completion report, diagnostic notes, parts used
- `POST /:id/cancel` - Cancel service request with reason
- `DELETE /:id` - Soft-delete service request (Admin)

### 7. Invoices (`/api/v1/invoices`)
- `POST /` - Generate invoice for service request (Admin)
- `GET /` - List invoices with pagination & status filters (Admin)
- `GET /my-invoices` - Customer invoices
- `GET /:id` - Get invoice details

### 8. Payments (`/api/v1/payments`)
- `POST /create-checkout-session` - Initialize Stripe checkout session (Customer)
- `POST /verify` - Verify Stripe session and mark invoice paid
- `POST /webhook` - Stripe webhook listener (raw JSON)
- `GET /my-payments` - Customer payments history
- `GET /` - List all system payments (Admin)
- `GET /:id` - Payment receipt and transaction inspection

### 9. Reviews & Feedback (`/api/v1/reviews`)
- `POST /` - Submit service review and rating (Customer)
- `GET /service/:serviceId` - List service reviews
- `GET /technician/:technicianId` - List technician reviews

### 10. Admin Operations (`/api/v1/admin`)
- `GET /dashboard-stats` - Revenue, active jobs, technician analytics (Redis Cached)
- `GET /audit-logs` - Comprehensive audit log of all system actions

---

## 📮 Postman Collection
Import `Field_Service_Api_Collection.postman_collection.json` in Postman to test all endpoints.
