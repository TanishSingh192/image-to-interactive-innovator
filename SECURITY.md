# Security notes

Genesis is a prototype, not a certified benchmark or adversarial agent-isolation service.

## Reporting

Use GitHub private vulnerability reporting if the owner enables it; otherwise contact the repository owner privately before public disclosure. Never include tokens, private records, or personal data in public issues. No dedicated security email or response-time commitment has been established.

## Current controls

Account-gated lab pages; row-level policies matching each row's `user_id` to the current user; public browser keys rather than administrative credentials for normal CRUD; ground-truth list and other minds omitted from agent observations by convention.

## Known boundaries

- Clients control simulation and submitted outcomes; records are not server-certified.
- Ground truth ships to the browser and is visible to the researcher.
- Decision functions receive full world state; untrusted adapters need stricter isolation.
- Policies check row ownership, not independent ownership consistency across references.
- In-tab simulation state is not explicitly invalidated on account changes; reload before switching accounts.
- Multi-tab snapshots can conflict; persistence is not atomic or comprehensively retried.
- This documentation is not a security audit; comprehensive access/engine testing remains future work.

Keep private credentials in managed secrets. Never use an administrative key in `VITE_*` fields. Do not publish sessions or private exports. Review schemas/access policies before independent deployment, and avoid sensitive personal data in experiment notes/messages.
