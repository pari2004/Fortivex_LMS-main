# Fortivex LMS — Target Combined Architecture

**Date:** 2026-09-17
**Status:** DRAFT — for Parikshith T T (Technical Lead) review and sign-off
before Phase 3 implementation begins. This document is the architecture
reference; there is no existing PRD in the repository to reconcile it
against (see `docs/PROJECT_AUDIT.md`). If a PRD surfaces later, reconcile it
against this doc rather than letting the two silently diverge.

**Non-goal for today:** this document specifies the target shape. It does
not itself implement anything. No business modules should be built off of
it without this doc being reviewed first.

**2026-09-22 update:** an Empowers Academy PRD (`docs/Empowers Academy
Learning & Career Platform.pdf`) was found in the repo this session — the
2026-09-17 audit had found none. It agrees closely with this document on
roles and MVP entity scope, but conflicts on two open points this
document has not been changed to reflect pending Parikshith's ruling: (1)
it recommends AWS (S3/ECS/ECR/Terraform) where this doc and `CLAUDE.md`
commit to Railway/Vercel/GoDaddy, and (2) it is written Empowers-only,
with no mention of Medivex AI, where this doc assumes a combined-org
platform. See `docs/PROJECT_STATUS.md` §5 for full detail. Do not resolve
either silently — both need an explicit decision.

---

## 1. Guiding Principle

**One LMS. Two organizations.** Empowers Academy and Medivex AI are rows in
an `organizations` table, not two codebases, two databases, or two Next.js
apps. Every place the temptation exists to write:

```python
if organization.slug == "empowers": ...
elif organization.slug == "medivex": ...
```

is a signal that something belongs in configuration (brand config, program
data, activity-type availability) instead of in code. The only acceptable
"org-aware" code is code that reads *which* organization the current
request belongs to and then loads *that org's data* — never code that
branches on *which org it is* to decide *what to do*.

## 2. Target System Diagram

```
                              ONE LMS (single codebase, single DB)
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                     │
                  lms.empowersacademy.com          lms.medivexai.com
                        │                                     │
                        └─────────────────┬─────────────────┘
                                          │  (domain → organization_domains lookup)
                                     LMS CORE
                                          │
                    Auth ── Organizations ── Roles/Permissions
                                          │
                                      Students
                                          │
                              Programs ── Cohorts ── Enrollments
                                          │
                                      Curriculum
                                          │
                                     Activities
                          ┌───────────────┼────────────────┐
                       Learning        Practice           Build
                     (classes,        (labs, case      (projects,
                      lessons,         studies, data     capstone,
                      quizzes)         analysis)         GitHub)
                                          │
                                       Review
                                          │
                                   Certification
                                          │
                                       Career
```

## 3. Multi-Tenancy Strategy

**Decision: shared database, shared schema, row-level org scoping.**
Rejected alternatives and why:

| Option | Rejected because |
|---|---|
| Separate database per org | Doubles migration/ops work for two orgs that share >90% of their data model; no benefit at this scale. |
| Separate Next.js/FastAPI deployments per org | Directly violates "one shared LMS platform" requirement; guarantees drift. |
| Schema-per-tenant in one DB | Adds operational complexity (per-schema migrations) with no real isolation benefit for two known, trusted orgs. |

Every tenant-scoped table carries an `organization_id` foreign key
(directly, or transitively through `program_id` → `programs.organization_id`
etc.). Queries are always scoped by the authenticated request's
organization context — enforced once, in a shared data-access layer /
dependency, not repeated ad hoc in every endpoint.

**Domain → organization resolution:** `organization_domains` maps a
hostname (`lms.empowersacademy.com`, `lms.medivexai.com`, plus staging
equivalents) to an `organization_id`. Backend middleware resolves this once
per request from the `Host` header; the frontend receives/derives the same
context (via the API, or via Next.js middleware reading the same table
through an internal endpoint) so branding renders correctly server-side.
Authenticated users additionally carry organization context via their
`organization_memberships` — a user's *session* organization is either the
domain they're on, or (for staff/admin users who may belong to more than
one org) an explicit org switcher, out of scope for MVP.

## 4. Organization & Branding Model

```
organizations
  id
  name                 -- "Empowers Academy" / "Medivex AI"
  slug                 -- "empowers" / "medivex"   (internal reference only,
                                                     never branched on in logic)
  code                 -- short code, e.g. "EMP" / "MDX"
  status               -- ACTIVE | INACTIVE
  primary_domain        -- e.g. "empowersacademy.com"
  lms_domain            -- e.g. "lms.empowersacademy.com"
  brand_config          -- JSONB (see below)
  created_at / updated_at

organization_domains
  id
  organization_id (FK)
  hostname              -- includes staging/preview hosts too
  is_primary

brand_config (JSONB shape, not a separate table — no per-org migrations needed to tweak branding)
  {
    "logo_url": "...",
    "favicon_url": "...",
    "primary_color": "#...",
    "secondary_color": "#...",
    "login_hero_image": "...",
    "email_from_name": "...",
    "email_footer": "...",
    "dashboard_welcome_copy": "...",
    "program_category_labels": ["AI/ML", "Cybersecurity", ...]   -- display grouping only
  }
```

The frontend loads `brand_config` once per session (resolved from the
domain, or from the user's org membership) and drives a single design
system's theme tokens from it — one component tree, org-variable styling.
No `/empowers/*` vs `/medivex/*` route trees, no duplicated page templates.

## 5. RBAC Model

```
roles                  -- SUPER_ADMIN, ACADEMIC_ADMIN, PROGRAM_MANAGER,
                           TRAINER, MENTOR, LAB_ADMIN, CAREER_TEAM,
                           FINANCE_ADMIN, STUDENT
permissions             -- fine-grained, e.g. "curriculum.edit",
                           "enrollment.create", "grades.view"
role_permissions        -- join table: which permissions each role grants
user_roles              -- join table: which role(s) a user holds
                           (scoped per organization_membership, since a
                           user's role can differ by org — e.g. a mentor
                           at Empowers might just be a student at Medivex)
organization_memberships
  id
  user_id (FK)
  organization_id (FK)
  status                -- ACTIVE | INACTIVE
  joined_at
```

`user_roles` is scoped through `organization_memberships`, not directly to
`users` — this is what allows one user account to hold different roles (or
no role at all) in each organization without duplicating the user record.
Authorization checks go through a single permission-checking
dependency/decorator that answers "does this user's current org membership
grant permission X" — implemented once, reused everywhere. No scattered
`if user.role == "..."` checks in route handlers or components.

## 6. Curriculum Model

```
Organization
    └── Program                (e.g. "AIML Full Stack Development",
    │                            "Clinical Research")
        └── Cohort              (a running instance of a program, with
        │                        start/end dates, timezone, trainer(s))
        └── Program Module       (top-level curriculum grouping)
            └── Week
                └── Lesson
                    └── Activity  (activity_type enum, see below)
```

`programs`, `program_modules`, `weeks`, `lessons` are **not org-branched in
code** — they're just rows scoped by `organization_id` (via `programs`).
Empowers programs and Medivex programs live in the same tables; the UI
renders whatever program data belongs to the current org/cohort context.

### Activity Types

```
activities.activity_type ENUM:
  VIDEO
  LIVE_CLASS
  READING
  PDF
  QUIZ
  CODING_EXERCISE
  PRACTICE_LAB
  HEALTHCARE_CASE_STUDY
  DATA_ANALYSIS
  ASSIGNMENT
  PROJECT
  CAPSTONE
  INTERVIEW_PREPARATION
  OTHER
```

An organization/program is not required to use every activity type — a
`program_activity_type_config` (or equivalent enable/disable flag at the
program level) can restrict which types are offered, but the schema and
delivery UI are shared. `HEALTHCARE_CASE_STUDY` and `DATA_ANALYSIS` will, in
practice, mostly appear on Medivex programs and `CODING_EXERCISE` /
`PRACTICE_LAB` mostly on Empowers programs — that's a data fact, not a
code branch.

Activity-specific payload data (e.g. a quiz's questions, a coding
exercise's starter repo, a case study's dataset) lives in per-type detail
tables/JSONB keyed off the activity, not by cramming every possible field
onto one giant `activities` row.

## 7. Student Lifecycle

```
LEAD → APPLICATION → ADMISSION → PAYMENT → ENROLLMENT →
COHORT_ASSIGNMENT → ORIENTATION → ACTIVE → COMPLETED → ALUMNI
```

MVP scope: model this as a `students.lifecycle_status` enum with a simple
state transition, and build out `LEAD`→`ENROLLMENT` tooling only if/when
the team actually needs lead/admissions tracking in the LMS itself (it may
live in a separate CRM — note the existing `fortivex_CRM` project on the
team's local machines suggests lead/admissions may already be handled
elsewhere; **confirm with Parikshith before building admissions workflows
here** to avoid duplicating a system that already exists). The LMS's core
responsibility starts firmly at `ENROLLMENT`.

## 8. Core Database Entities (MVP scope)

```
organizations, organization_domains
users, roles, permissions, role_permissions, user_roles, organization_memberships

students, student_profiles

programs, program_modules, weeks, lessons, activities

cohorts, enrollments

classes, attendance

assignments, submissions, evaluations

quizzes, questions, quiz_attempts

projects, project_milestones, project_submissions

certificates

notifications

audit_logs
```

**Deferred (not built in MVP, but the above schema should not preclude
them):** `labs`, `lab_sessions`, `github_accounts`, `repositories`,
`portfolios`, `career_profiles`, `job_applications`, `interviews`,
`community`, `payments`, `ai_tutor`.

## 9. API Architecture

Versioned REST, one FastAPI app, routers grouped by domain:

```
/api/v1/auth
/api/v1/users
/api/v1/organizations
/api/v1/roles
/api/v1/students
/api/v1/programs
/api/v1/cohorts
/api/v1/enrollments
/api/v1/curriculum        -- modules/weeks/lessons/activities
/api/v1/classes
/api/v1/attendance
/api/v1/assignments
/api/v1/quizzes
```

Deferred, added when their module is built:
`/api/v1/labs`, `/api/v1/projects`, `/api/v1/github`, `/api/v1/portfolio`,
`/api/v1/career`, `/api/v1/certificates`, `/api/v1/notifications`,
`/api/v1/analytics`.

Every authenticated endpoint resolves organization context from the
requester's session (never from a client-supplied `org` query param/body
field, to prevent cross-org data access via a forged parameter).

## 10. Technology Stack (proposed, pending Parikshith/Spoorthy sign-off)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js + TypeScript + React | Single app, org-aware theming, not per-org apps |
| Backend | Python + FastAPI | Versioned routers under `/api/v1` |
| Database | PostgreSQL | Single instance, shared schema, org-scoped rows |
| ORM | SQLAlchemy | |
| Migrations | Alembic | |
| Cache/background jobs | Redis | Only where actually needed (sessions, rate-limits, queues) — not introduced speculatively |
| Object storage | S3-compatible | For uploads: videos, PDFs, submissions, certificates |
| Local dev | Docker Compose | Postgres + Redis + backend + frontend |
| Hosting | Railway (backend/DB), Vercel (frontend), GoDaddy (DNS) | Per team's existing infra access — **not** migrating to AWS despite any older doc mentioning it |

## 11. Explicitly Deferred Decisions

To avoid over-engineering ahead of the MVP deadline, the following are
noted as future work, not designed further today:

- Org-switcher UX for staff belonging to multiple organizations.
- Fine-grained permission UI (permission management is data-driven in the
  schema from day one; an admin UI to edit it is not MVP).
- Lead/admissions workflow (pending confirmation this isn't already owned
  by the existing CRM project).
- Every "future/advanced" module listed in section 8.

## 12. Review Gate

This document is a draft pending Parikshith's review (per his assigned
responsibilities today: finalize the combined architecture, review the
organization model, database boundaries, auth/RBAC design, and set the
implementation order for the next phase). No Phase 3 (actual schema
migrations, model code, or endpoints) should be merged to `main` until
he's signed off on sections 3–9 above.
