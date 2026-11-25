# Database Notes — Fortivex LMS

## 2026-09-27 Update — Real PostgreSQL now reachable; role/grants gap fixed

**The "no local PostgreSQL or Docker" blocker every prior status doc has flagged is resolved on
this machine.** PostgreSQL 16 is installed and running as a native Windows service
(`postgresql-x64-16`), listening on `127.0.0.1:5432` — **not** via the project's
`docker-compose.yml` (Docker itself is still unavailable here). This was not set up by this
session; it was already true when this session started, and `fortivex_lms` /
`fortivex_lms_test` databases already existed, already migrated to head (`3f9a1c7e5d21`), with
`fortivex_lms` already carrying dev seed data (2 organizations, 4 users, 4 programs, 2 cohorts, 4
enrollments) — presumably done in the session that ran out of context, or by a team member,
outside what's recorded in this file.

**What this session found and fixed:** everything above had been created/migrated/seeded while
connected as the `postgres` superuser. The `fortivex` role that `backend/.env`'s `DATABASE_URL`
(`postgresql://fortivex:fortivex@localhost:5432/fortivex_lms`) and `docker-compose.yml` both name
**did not exist** — so the backend app, run normally via its own `.env`, could not have connected
to its own dev database. Fixed by creating the `fortivex` login role (password `fortivex`, matching
both files) and granting it:
- `ALL PRIVILEGES` on both `fortivex_lms` and `fortivex_lms_test` databases
- `ALL` on the `public` schema, all existing tables, and all sequences in both databases
- `ALTER DEFAULT PRIVILEGES` for tables/sequences in `public`, so future Alembic migrations
  (which create tables as whichever role runs them) don't silently reintroduce this gap

**Verified after the fix:** connecting as `fortivex`/`fortivex` to `fortivex_lms` lists all 12
tables and reads seeded rows correctly; the FastAPI app started via `uvicorn` (reading
`backend/.env` normally, no superuser override) passed `GET /api/v1/health/db` and served real
authenticated requests against this database — see `docs/BACKEND_STATUS.md`.

**Not changed this session:** schema/migrations themselves — no new tables, no new migration.
`fortivex_lms_test`'s schema is created/dropped per test run by
`backend/tests/test_integration_flow.py` (`Base.metadata.create_all`/`drop_all`), not by Alembic —
documented as intentional in that file's own docstring, since proving `alembic upgrade head` itself
works is `fortivex_lms`'s job, not the test database's.

---

## 2026-09-24 Update — Program, Enrollment tables

Two new tables added (migration `227197e91239`, chained after
`2bf55b701959`):

| Table | Why it exists today |
|---|---|
| `programs` | The "course/program" a student enrolls in, scoped to one organization (`UniqueConstraint(organization_id, code)`). Curriculum/cohort structure underneath it is still out of scope. |
| `enrollments` | Connects `students` + `programs` + `organizations` (denormalized `organization_id`, same pattern as `students`) + a `status` enum (`ENROLLED`/`ACTIVE`/`COMPLETED`/`CANCELLED`, per today's brief — simpler than `student_lifecycle_status`, deliberately). `UniqueConstraint(student_id, program_id)` — one active enrollment row per student per program; re-enrollment after cancellation isn't handled today (documented simplification, not silently ignored). |

**Verification status: unchanged from yesterday.** Still no PostgreSQL or
Docker reachable in this environment. What *was* verified today:
`configure_mappers()` succeeds with all 10 tables present and every FK/
relationship resolving (`organizations`, `users`, `roles`, `permissions`,
`role_permissions`, `user_roles`, `organization_memberships`, `students`,
`programs`, `enrollments`); `alembic heads` returns a single head
(`227197e91239`) and `alembic history` shows the correct two-migration
chain. **Required before this schema is considered verified:** the same
action item as yesterday — run `alembic upgrade head` against a real
Postgres and confirm it applies cleanly.

A dev seed script now exists (`backend/scripts/seed_dev_data.py`) —
idempotent, creates both real organizations (Empowers Academy, Medivex
AI), one admin + one student user per org with placeholder dev-only
passwords, one program per org, one enrollment per seeded student. No
real student data, no real credentials. **Not run** — same blocker.

---

**Date:** 2026-09-23
**Owner:** Durga (backend support — data model documentation), reviewed
against `docs/ARCHITECTURE.md` §3–§5, §8.

## Tables created today (8, all in one Alembic migration)

| Table | Why it exists today |
|---|---|
| `organizations` | Root of multi-tenancy (ARCHITECTURE.md §3–4). `brand_config` kept as JSONB so branding can be populated later without a migration. `organization_domains` (hostname→org lookup) is **not** built yet — no request-scoped org resolution today, see below. |
| `users` | Account identity. No `organization_id` on `users` directly — org relationship goes through `organization_memberships`, per ARCHITECTURE.md §5. |
| `organization_memberships` | Join: which orgs a user belongs to, and whether that membership is active. Required for `user_roles` to be scoped correctly. |
| `roles` | Catalog table (`SUPER_ADMIN`, `ACADEMIC_ADMIN`, ... — not yet seeded with rows; the enum values are documented in `app/models/enums` comments and ARCHITECTURE.md §5, not enforced as a DB constraint, since roles are meant to be data, not code). |
| `permissions` | Catalog table for fine-grained permission codes (e.g. `curriculum.edit`). Not seeded today — no permission codes are needed until an endpoint checks one. |
| `role_permissions` | Join: which permissions a role grants. |
| `user_roles` | Join: which role a user holds, **scoped to one `organization_membership`** (not directly to the user) — this is what lets one account hold different roles in different orgs, per ARCHITECTURE.md §5. |
| `students` | A user's student record within one organization. `lifecycle_status` uses the full enum from ARCHITECTURE.md §7 (`LEAD`...`ALUMNI`) as a status value only — no admissions workflow logic is built against `LEAD`→`PAYMENT` (that may belong to the separate CRM project; still unconfirmed, see `docs/PROJECT_STATUS.md`). New students default to `ENROLLMENT`. |

All tables: integer primary key, `created_at`/`updated_at` (DB-generated,
`TIMESTAMPTZ`), explicit `UniqueConstraint`s, indexed foreign keys.
Enums are native Postgres `ENUM` types (`organization_status`,
`membership_status`, `student_lifecycle_status`).

## Deliberately not built today

Per ARCHITECTURE.md §8 and `CLAUDE.md` rule 6 (don't over-engineer for
MVP), these were left out even though they're named in the target schema:

- `organization_domains` — hostname→org resolution. No middleware reads
  the `Host` header yet, so there's nothing to resolve against.
- `student_profiles` — extended profile fields; `students` alone is
  enough to exercise the FK/RBAC wiring today.
- Everything below the MVP entity list in ARCHITECTURE.md §8 (programs,
  cohorts, curriculum, classes, assignments, quizzes, projects,
  certificates, notifications, audit_logs) and everything in the
  explicitly deferred list (labs, github_accounts, payments, etc).

## Verification status

- **Not run against a real database.** No PostgreSQL instance is
  reachable from this development environment (confirmed: no `psql`
  binary, no Docker, nothing listening on `127.0.0.1:5432`).
- What *was* verified locally: `sqlalchemy.orm.configure_mappers()` after
  importing every model succeeds (catches FK/relationship typos), and
  `alembic heads`/`alembic history` load the migration chain without
  error. The migration file itself was written by hand from the models
  (not `--autogenerate`, which requires a live DB to diff against) —
  see the note at the top of
  `backend/alembic/versions/2bf55b701959_initial_schema_....py`.
- **Required before this schema is considered verified:** run `alembic
  upgrade head` against a real Postgres (`docker-compose up postgres`
  once Docker is available, or a Railway dev database) and confirm it
  applies cleanly, then spot-check the resulting DDL (column types,
  constraint names, enum values) against this document.
