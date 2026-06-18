# RJ Technical Solution Sales and Services Company
## Air Conditioning Servicing Management System

A web-browser-based application developed as a Software Engineering study for **RJ Technical Solution Sales and Services Company**, designed to improve the company's operational efficiency, data security, and overall service management.

---

## Modules

- **Employee Management** — manage employee records and user accounts
- **Project and CRM** — track client projects and relationships
- **Document Management** — store and retrieve service-related documents
- **Schedule Management** — plan and monitor service schedules
- **Inventory and Billing Management** — track parts, equipment, purchase orders, and billing
- **Vehicle Monitoring** — log vehicle usage and fuel records
- **Report Generation** — generate operational and financial reports
- **Maintenance** — database backup and system maintenance tools
- **Help & Support** — in-app FAQ and support resources

---

## Tech Stack

- **Backend:** Java 21, Spring Boot 3, Spring Security (JWT), PostgreSQL
- **Frontend:** React, FlyonUI (Tailwind CSS)
- **Build:** Gradle

---

## Running the Application

### Prerequisites

- Java 21+
- PostgreSQL database
- `pg_dump` / `pg_restore` / `psql` on PATH (for backup features)

### Environment Variables

All configuration is read from a `.env` file in the project root. Copy `.env.example` to `.env` and fill in your values — the app reads it automatically on startup.

```bash
cp .env.example .env
# then edit .env with your values
```

| Variable | Description | Default |
|---|---|---|
| `EASI_DB_NAME` | PostgreSQL database name | — |
| `EASI_DB_USERNAME` | DB username | — |
| `EASI_DB_PASSWORD` | DB password | — |
| `JWT_SECRET` | Secret key for JWT signing | — |
| `MAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USERNAME` | SMTP login email | — |
| `MAIL_PASSWORD` | SMTP password (Gmail app password recommended) | — |
| `EASI_UPLOAD_DIR` | Directory for uploaded documents | `uploads/documents` |
| `EASI_BACKUP_DIR` | Directory for database backups | `backups` |
| `EASI_PG_DUMP` | Path to `pg_dump` executable | `pg_dump` |
| `EASI_PG_RESTORE` | Path to `pg_restore` executable | `pg_restore` |
| `EASI_PSQL` | Path to `psql` executable | `psql` |
| `EASI_OFFICE_ADDRESS` | Office address shown in delivery address quick-fill | _(empty)_ |

> `.env` is git-ignored and must never be committed.

### Build

```bash
./gradlew bootJar
```

The JAR will be at `build/libs/easi-<version>.jar`.

### Run

With `.env` in the project root, no extra arguments are needed:

```bash
java -jar easi-4.0.jar
```

The app will be accessible at `http://localhost:8080`.

---

## Academic Context

**Course:** CS 304 — Software Engineering 2
**Institution:** Technological Institute of the Philippines
**Study Title:** RJ Technical Solution Sales and Services Company Air Conditioning Servicing Management System
