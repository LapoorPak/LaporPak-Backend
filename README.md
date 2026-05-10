# LaporPak Backend

Backend API untuk LaporPak, platform pelaporan masalah publik yang menangani autentikasi, laporan warga, routing ke dinas, notifikasi, upload file, dan operasional admin.

---

## Overview

LaporPak Backend menjadi pusat data dan API untuk frontend LaporPak. Service ini menyediakan endpoint untuk warga, dinas/petugas, dan admin, dengan session cookie dari Better Auth, database PostgreSQL melalui Prisma, serta dukungan upload foto dan AI-assisted report review.

---

## Tech Stack

| Area | Stack |
| --- | --- |
| Runtime | Node.js |
| Framework | Express 5, TypeScript |
| Database | PostgreSQL, Prisma |
| Auth | Better Auth |
| Upload | Multer, local upload directory |
| Email | Nodemailer, SMTP |
| Security | Helmet, CORS |
| AI | Google GenAI / Gemini |
| Deployment | Docker |

---

## Features

- **Authentication** - Better Auth session, Google OAuth config, OTP email delivery, and role-aware session detail.
- **Reports** - create reports, upload evidence, list personal reports, fetch dashboard reports, update status, and resolve reports.
- **Agency Routing** - connect reports with agencies, branches, categories, and location-based assignment logic.
- **Agency Portal API** - report queues, dashboard data, status updates, clarification notes, and resolution proof uploads.
- **Admin API** - overview metrics plus CRUD for dinas, cabang, kategori, users, petugas assignment, and reports.
- **Notifications** - notification list, unread count, mark one as read, and mark all as read.
- **Uploads** - static serving for report uploads and office photos.
- **Health Checks** - live and full health endpoints for deployment monitoring.
- **AI-assisted Review** - Gemini-powered report review flow for validating report context.

---

## API Routes

| Prefix | Description |
| --- | --- |
| `/api/auth` | Custom auth/session routes and Better Auth handler |
| `/api/reports` | Citizen and agency report workflows |
| `/api/agencies` | Agency and location data |
| `/api/categories` | Report categories |
| `/api/admin` | Admin overview, master data, users, assignments, and report operations |
| `/api/upload` | Upload endpoints |
| `/api/notifications` | Notification queries and read state |
| `/api/health/live` | Lightweight liveness check |
| `/api/health` | Full health snapshot |

---

## Environment Variables

Buat file `.env` dari `.env.example`.

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/laporpak
BETTER_AUTH_SECRET=your_secret_here_min_32_chars
BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_app_password
SMTP_FROM="LaporPak <no-reply@example.com>"
GEMINI_API_KEY=your_gemini_api_key
UPLOAD_DIR=uploads
```

---

## Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL database
- SMTP credentials for OTP email
- Gemini API key for AI review

### Installation

```bash
npm install
```

### Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Development

```bash
npm run dev
```

The API runs on `http://localhost:3000` by default.

### Build

```bash
npm run build
```

### Start Production Build

```bash
npm start
```

---

## Docker

Build image:

```bash
docker build -t laporpak-backend .
```

Run container:

```bash
docker run --env-file .env -p 3000:3000 -v laporpak_uploads:/app/uploads laporpak-backend
```

---

## Project Structure

```txt
src
|-- config        # Auth, CORS, DB, health, storage, and upload config
|-- data          # Static category and Jakarta boundary data
|-- middleware    # Auth, error handling, and request logging
|-- routes        # Express route modules
|-- services      # Business logic for reports, admin, agency, AI, routing, notifications
|-- types         # Shared backend TypeScript types
|-- utils         # API response and auth portal helpers
```

---

## Related Repositories

| Repo | Stack | Description |
| --- | --- | --- |
| [LaporPak-Frontend](https://github.com/LapoorPak/LaporPak-Frontend) | React / Vite / TypeScript / Tailwind CSS | Web app for citizen, agency, and admin portals |
| [LaporPak-Backend](https://github.com/LapoorPak/LaporPak-Backend) | Express / TypeScript / Prisma / PostgreSQL / Better Auth | API service for LaporPak |
