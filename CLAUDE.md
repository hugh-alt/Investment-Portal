# Investment Platform - Claude Workflow

## Project Goal
Build a deployable prototype of an adviser investment platform with:
- Firm governance (Admin), Adviser workflows
- Taxonomy + SAA + drift
- Private markets sleeve (hero)
- CMA + stress testing
- Rebalance recommendations + approval + simulated execution + CSV export

## Tech
- Next.js + TypeScript
- Postgres (RDS later) via Prisma
- AWS Amplify for deployment

## Workflow (mandatory)
For every task:
1) PLAN: restate requirements + acceptance criteria + impacted files.
2) IMPLEMENT: make smallest coherent change set.
3) SELF-REVIEW: run checklist (below) and fix issues.
4) TEST: run commands + provide output summary.
5) PR SUMMARY: what changed, how to verify, known limitations.

## Definition of Done Checklist
- `npm run lint` passes
- `npm run test` passes (or if no tests exist yet, add at least 1 minimal test or justify)
- `npm run build` passes
- App runs locally (`npm run dev`)
- Includes seed data or a safe migration path
- No secrets committed; config via env vars
- Reviewer checklist completed

## Coding Rules
- No giant files. Prefer modules.
- TypeScript strict, no `any` unless justified.
- All DB access through Prisma client.
- Use Zod for input validation in API routes.
- Add basic tests for business logic (services/lib).
