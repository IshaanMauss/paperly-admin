# Paperly Admin Panel DFDs

Status: Current as of 2026-08-27.

These Mermaid diagrams document the owner/admin control plane at Level 1. This panel monitors and controls platform operations; it does not own template ingestion or teacher paper building.

## Diagrams

- `admin-control-panel-level1-flow.mmd` - Mandatory hosted-production ZTNA, admin sign-in, dashboard sections, per-route permission checks, database reads/writes, and audit/security events.
- `admin-security-rbac-level2-flow.mmd` - Level 2 admin RBAC flow showing token validation, role permission gating, denied-attempt audit logging, typed maintenance confirmation, and backup step-up recommendation.

## Active Rule

Admin panel sessions and actions must be isolated from teacher sessions and MVP/backoffice template-review sessions. Admin visibility must not mutate teacher workspace state or billing truth by accident.
