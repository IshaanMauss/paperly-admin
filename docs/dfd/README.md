# Paperly Admin Panel DFDs

<!-- paperly-aggregated-2026-09-10:start -->
## Current Aggregated Update - 2026-09-10

- **Fixed: severe template-loading slowness, which also affected this repo.** `health.tsx` calls `GET /templates` the same as the teacher module does. The root cause and fix live in `paperly-mvp` (`app/api/routes/templates.py`), so no code in this repo changed, but this panel benefits directly: `GET /templates` was re-running the full question-generation pipeline for *every* template on *every* call (confirmed 15-38s for 36 templates, now ~0.85-1.1s) to populate a `rendered_question_text` field that grepping this repo confirms is never read anywhere in it either. Full writeup, the pattern's name, and more examples of the same bug shape are in `paperly-teacher-module/docs/dfd/README.md` (2026-09-10 entry and the "Engineering note" section at the bottom) - worth reading once, since the still-open template-lifecycle write-route gap flagged below is exactly the kind of area this same pattern (expensive per-row work hidden in a shared endpoint) could recur in if those routes ever get a list-style admin UI.
- **Note for the still-open Full Portion gap (flagged 2026-09-05, still unresolved):** the billing gate that a future admin Full Portion page would need to expose has changed shape in `paperly-mvp` + `paperly-teacher-module` this update - it is no longer `max_subtopics_per_topic` (subtopic choosing is now free/unlimited on every plan), it is a new `max_full_portion_topics` cap (how many topics can combine into one paper: Free/Trial = 1, Monthly/Quarterly = 4, Yearly/Demo = unlimited). Whoever picks up that gap next should build against the new field, not the old one.
<!-- paperly-aggregated-2026-09-10:end -->

<!-- paperly-aggregated-2026-09-06:start -->
## Current Aggregated Update - 2026-09-06

The coverage-gap diagram from 2026-09-05 (`admin-panel-feature-coverage-gap-2026-09-05.mmd`) is now historical - every gap it documented is closed: `full-portion.tsx` and `checking.tsx` are real pages backed by real endpoints, `maintenance.tsx` has a working cleanup-job panel, and `security.tsx` shows live RLS status. See `paperly-mvp/docs/changelog.md` (2026-09-06 entry) and the two new backend-side diagrams there for the full flow. Left deliberately unresolved and still flagged: template-lifecycle write routes (edit/replace/delete) still have no confirmed caller anywhere in this repo.
<!-- paperly-aggregated-2026-09-06:end -->

<!-- paperly-aggregated-2026-09-05:start -->
## Current Aggregated Update - 2026-09-05

New diagram: `admin-panel-feature-coverage-gap-2026-09-05.mmd`. This one documents a **gap**, not a working flow: the 2026-09-05 triple-verification audit confirmed the admin panel currently has no page or section for Full Portion, the `max_subtopics_per_topic` billing gate, AI/QR Checking, or the RLS/DB-security work done in `paperly-mvp` this session, and that the `POST /admin/worksheets/cleanup` route (backend) has no UI trigger anywhere in this repo.

Confirmed still working: 8 of 10 existing admin pages (overview, teachers, billing x2, maintenance x2, backups, security, support) have real working UI wired to their routes. Template-lifecycle write routes (edit/replace/delete) have no caller found in this repo - a code comment at `AppShell.tsx:105` suggests these may live in a separate backoffice system, which is unverified and flagged for follow-up.

Per plan: this gap is intentionally left unfixed for now. It will be closed in a dedicated admin-panel pass, done step by step, after the teacher-module mobile redesign.
<!-- paperly-aggregated-2026-09-05:end -->

Status: Current as of 2026-08-27.

These Mermaid diagrams document the owner/admin control plane at Level 1. This panel monitors and controls platform operations; it does not own template ingestion or teacher paper building.

## Diagrams

- `admin-control-panel-level1-flow.mmd` - Mandatory hosted-production ZTNA, admin sign-in, dashboard sections, per-route permission checks, database reads/writes, and audit/security events.
- `admin-security-rbac-level2-flow.mmd` - Level 2 admin RBAC flow showing token validation, role permission gating, denied-attempt audit logging, typed maintenance confirmation, and backup step-up recommendation.

## Active Rule

Admin panel sessions and actions must be isolated from teacher sessions and MVP/backoffice template-review sessions. Admin visibility must not mutate teacher workspace state or billing truth by accident.
