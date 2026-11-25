# CLAUDE.md — Fortivex LMS

Guidance for Claude Code (and any AI assistant) working in this repository.

## What this project is

One centralized LMS shared by two education platforms, **Empowers Academy**
(tech/AI programs) and **Medivex AI** (healthcare/clinical programs). It is
**one codebase, one database, one deployment per side (frontend/backend)** —
not two separate apps. Organization context is resolved at runtime (from
the request domain and/or the authenticated user's organization membership),
never hardcoded.

Full architecture: `docs/ARCHITECTURE.md`. Repository state as of the last
audit: `docs/PROJECT_AUDIT.md`. As of 2026-09-17 the repo has no application
code yet — read the audit before assuming anything exists.

## The one rule that matters most

**Never branch logic on which organization it is.** No
`if org.slug == "empowers"` / `if org.slug == "medivex"` anywhere in
application code. Organization differences are data (brand_config rows,
program rows, activity-type availability), not code paths. If you find
yourself writing that `if`, stop and ask whether the thing that differs
should be a config value or a database row instead.

## Tech stack (target)

- Frontend: Next.js + TypeScript + React (single app, org-aware theming)
- Backend: Python + FastAPI, versioned routes under `/api/v1/...`
- Database: PostgreSQL, single shared schema, `organization_id`-scoped rows
- ORM: SQLAlchemy — Migrations: Alembic
- Cache/queues: Redis, only where actually needed
- Object storage: S3-compatible
- Local dev: Docker Compose
- Hosting: Railway (backend/DB) + Vercel (frontend) + GoDaddy (DNS) —
  **not** AWS, regardless of what any older document might say.

## Rules for AI-assisted changes in this repo

1. **Inspect before implementing.** Read the relevant existing code and the
   two docs above before writing anything. Don't assume a module exists or
   doesn't — check.
2. **Never invent an org-specific code branch.** See rule above.
3. **Don't build ahead of the review gate.** `docs/ARCHITECTURE.md` is a
   draft pending Technical Lead (Parikshith T T) sign-off. Schema
   migrations and cross-cutting decisions (auth, RBAC shape, API
   contracts) should not be merged until that sign-off happens.
4. **No destructive operations without explicit approval:** no
   `DROP TABLE`/data-wiping migrations, no `git push --force` to shared
   branches, no rewriting other people's commits, no running migrations
   against a production or shared database from a local machine.
5. **Never commit secrets.** `DATABASE_URL`, JWT secrets, API keys, cloud
   credentials, Railway/Vercel/GoDaddy tokens — all via `.env` (gitignored)
   or CI/CD secret stores. `.env.example` holds placeholder names only.
   Only Parikshith T T and Padmesh MK hold production infra credentials —
   do not request or fabricate them from anyone else.
6. **Don't over-engineer for the MVP deadline.** Build the module actually
   requested, to the schema in `docs/ARCHITECTURE.md`. The "deferred"
   modules listed there (labs, GitHub integration, career, payments, AI
   tutor, etc.) are explicitly out of scope until asked for.
7. **Small, reviewed changes.** Feature branch → implementation → tests →
   PR → review → CI → merge. No direct pushes to `main`. See Git Workflow.
8. **After any implementation:** run tests, type-check, lint, review the
   actual migration diff (not just "it ran"), and report exactly what
   changed — including anything left unresolved. Don't report a task as
   done without having run and verified it.

## Git workflow

- `main` — production-tracking, protected.
- `develop` (or a staging branch) — integration branch once created.
- `feature/<module>`, `fix/<issue>` — all work branches from here.
- No direct commits to `main`. Every feature: branch → implement → test →
  PR → review → CI → merge.

## Team (context, not literal task assignments for the AI)

- **Parikshith T T** — Technical Lead: architecture, DB boundaries, auth/RBAC
  design, API contracts, security, code review, final call on implementation
  order. Has Railway/Vercel/GoDaddy access.
- **Padmesh MK** — DevOps/Cloud: Railway, Vercel, GoDaddy/DNS, environment
  docs, CI, Docker dev support. Has infra access.
- **Spoorthy** — Backend Lead: FastAPI structure, DB connection, SQLAlchemy,
  Alembic, API versioning, org/user/RBAC model structure.
- **Durga** — Backend Support: data model documentation, relationships, dev
  seed data, migration validation.
- **Vasu** — API/QA Support: Postman collection, endpoint testing beyond
  "returns 200" (structure, auth, validation, error handling).
- **Thanushree** — Frontend Lead: Next.js structure, routing, layout, API
  client, org-aware branding/theme structure.
- **Jagadeesh** — Frontend Support: reusable components, forms, login UI,
  branding-aware components, following Thanushree's standards.
- **Deepika** — Frontend QA: responsive/accessibility testing across
  devices, UI bug documentation.

AI assistance supports these roles; it does not replace their review or
sign-off, particularly Parikshith's on architecture and Padmesh's on infra.
