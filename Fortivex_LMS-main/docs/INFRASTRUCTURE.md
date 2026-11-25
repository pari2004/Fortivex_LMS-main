# Infrastructure — Fortivex LMS

**Date:** 2026-09-17 (ownership note updated 2026-09-28)
**Status:** TEMPLATE — sections marked `PENDING` require Railway/Vercel/
GoDaddy dashboard access. Claude Code has no credentials for these
services and did not attempt to access them. Do not fill `PENDING`
sections with guesses — leave them blank until verified against the
actual dashboards.
**Ownership:** Padmesh MK, this file's original owner, resigned as of the
2026-09-28 audit. Per that audit's brief, Parikshith T T (Technical Lead)
is now responsible for DevOps/cloud activities and owns this file going
forward. All `PENDING` sections below still require his direct dashboard
access to resolve — nothing in this repo can verify them.

---

## Current Deployment

- **Frontend deployment:** PENDING — confirm in Vercel dashboard whether a
  project exists for this LMS, and if so, which Git repo/branch it
  deploys from (note: as of this audit, `Fortivex_LMS` has no frontend
  code to deploy — if something is live, confirm what it's actually
  serving).
- **Backend deployment:** PENDING — confirm in Railway dashboard whether a
  service exists, what it's running, and which repo/branch it tracks.
- **Database hosting:** PENDING — confirm whether a Railway (or other)
  PostgreSQL instance already exists for this project, its plan/tier, and
  whether it currently holds any real data.

## Domains & DNS

- `empowersacademy.com` / `lms.empowersacademy.com`
- `medivexai.com` / `lms.medivexai.com`

PENDING — confirm in GoDaddy: current DNS records for both domains and
subdomains, where each currently points (Vercel, parked, or something
else), TTLs, and whether staging subdomains exist (e.g.
`staging-lms.empowersacademy.com`).

## Staging vs Production

PENDING — no staging environment is confirmed to exist yet. Recommendation
once infra is stood up: separate Railway environments (or separate
services) for staging and production, separate Vercel deployment targets
(preview/production), and separate databases — never point a staging
frontend/backend at the production database.

## Environment Configuration

No secrets are recorded here. See `.env.example` at the repo root for the
full list of variable **names** the target architecture requires (values
are never committed). Once real environments exist, document *where each
variable's value is set* (Railway env vars, Vercel env vars) — not the
values themselves — e.g.:

| Variable | Set in | Notes |
|---|---|---|
| `DATABASE_URL` | Railway (backend service) | PENDING — confirm |
| `JWT_SECRET_KEY` | Railway (backend service) | PENDING — confirm, rotate if ever exposed |
| `NEXT_PUBLIC_API_URL` | Vercel (frontend project) | PENDING — confirm per environment |

## CI/CD

**Added 2026-09-29:** `.github/workflows/ci.yml` — two jobs, `backend`
(`pytest` against an ephemeral `postgres:16` service container, so the
live-DB integration tests in `test_integration_flow.py` run in CI instead
of skipping) and `frontend` (`tsc --noEmit`, `eslint src`, `next build`),
on every push/PR to `main`.

**2026-09-30 finding:** the workflow *did* run for real on GitHub's
runners (PR #7's `pull_request` trigger and PR #8's merge into `main`,
via `gh run list`) — both runs **failed** in the `frontend` job, unnoticed
until this session actually checked `gh run list` instead of assuming the
never-verified workflow was fine. Root cause, reproduced locally: the
`frontend` job ran `npx tsc --noEmit` *before* `npm run build`.
`src/app/layout.tsx` uses Next.js's auto-generated `LayoutProps<"/">`
type, which only exists in `.next/types/routes.d.ts` after `next build`
or `next dev` has run at least once. Every local session's "tsc clean"
claim was true only because a stale `.next/types` from a prior `next dev`
happened to be sitting in the working tree — a fresh checkout (exactly
what CI does) has no `.next` directory yet, so `tsc` always failed there.
Reproduced by renaming `.next` aside locally and rerunning `npx tsc
--noEmit` (fails with the identical `TS2304: Cannot find name
'LayoutProps'` error), then confirmed the fix: reordered the `frontend`
job to `npm run build` → `npx tsc --noEmit` → `npm run lint`, and
verified this exact sequence passes end-to-end from a clean `.next` state.
Fixed on branch `fix/ci-frontend-typecheck-order`, pushed, opened as PR #9,
and **merged into `main` on 2026-09-30** — both `backend` and `frontend`
jobs passed for real on GitHub's runners (`backend` 1m14s, `frontend`
36s). Confirmed via `gh run view --json jobs` that the `backend` job had
passed cleanly on both pre-fix runs too — only `frontend` failed, so this
was an isolated, fully diagnosed issue, not a wider CI problem. CI is now
green on `main` as of this writing (2026-10-01).

## Local Development Requirements

**2026-09-23:** the foundation scaffold landed on
`feature/lms-initial-scaffold` — `docker-compose.yml` (repo root) now
defines Postgres 16 + Redis 7 + backend + frontend for local dev. It has
**not** been run/tested — this development environment has no Docker
installed (confirmed: no `docker` on PATH). Config-reviewed only; someone
with Docker available should run `docker-compose up` and confirm it
actually works before relying on it. Details: `docs/BACKEND_STATUS.md`,
`docs/FRONTEND_STATUS.md`.

Requirements confirmed by actually using them in this session: Python
3.11 + pip (backend deps installed and tests run in a venv), Node 25 +
npm 11 (frontend build/lint/dev server all ran successfully). No local
PostgreSQL was available or used — see `docs/DATABASE_NOTES.md`.

## Risks

1. Actual current production state is unknown to this audit — there is a
   real possibility something is already deployed under these domains from
   prior work not reflected in this git repo. **Do not assume a blank
   slate on the infra side** just because the repo is blank — Padmesh
   should confirm dashboard state before anyone provisions anything new.
2. No documented separation between staging and production yet — first
   infra task should establish this before any real user/student data
   exists.
3. DNS for two production domains (GoDaddy) plus their LMS subdomains is a
   single point of failure if changed carelessly — no DNS changes without
   Parikshith/Padmesh sign-off, and never as a side effect of an
   unrelated task.

## Required Improvements (once dashboard access is used to fill this doc in)

- [ ] Confirm and record actual current deployment state (or confirm there
      is none).
- [ ] Stand up staging environment separate from production.
- [ ] Wire environment variables per the `.env.example` contract.
- [x] Add basic CI (lint/test/build on PR) — `.github/workflows/ci.yml`,
      added 2026-09-29; the `frontend` job failed on PR #7/#8's runs (see
      CI/CD section above), fixed and merged via PR #9 on 2026-09-30. CI is
      green on `main`.
- [ ] Confirm DNS records for both domains and their LMS subdomains.
