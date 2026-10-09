# Contributing to Genesis

Read the [README](README.md), [setup guide](docs/SETUP.md), and [architecture](docs/ARCHITECTURE.md). Genesis is released under the [MIT License](LICENSE). Contributions are intended for inclusion under the same license; only contribute material you have the right to share.

## Workflow

Use the repository's bug-report or enhancement issue form to describe changes, and the pull request template to record validation. These templates collect evidence; they do not imply an automated CI pipeline exists.

1. Describe the issue or intended change; keep it focused.
2. Install with `bun install --frozen-lockfile` and use your own authorized local configuration.
3. Run relevant tests, lint, and build; disclose existing failures.
4. Add concrete engine tests for simulation changes and explain reproducibility/metric effects.
5. Verify changed UI flows in the browser, including persistence where applicable.
6. Update documentation when assumptions, actions, schema, or limitations change.

## Research integrity

Never fabricate chart values, model responses, outcomes, or official scores. Label heuristic priors and manually proposed recipes. Distinguish recorded simulation from externally evaluated results. Report seed, settings, metric windows, and nondeterminism when discussing outcomes. Keep researcher ground truth out of observations; browser bundling is not secrecy.

## Boundaries

Use existing TanStack conventions, UI components, and semantic tokens. Preserve generated clients and per-user data access. Use migrations for schema changes. Keep private credentials out of browser code and the repository. Do not commit sessions, private exports, or screenshots containing account identifiers.

The Lovable-connected branch synchronizes automatically. Do not force-push or rewrite already-published history.

## Pull request checklist

- [ ] Focused scope and reason
- [ ] Checks/tests run; failures disclosed
- [ ] No fabricated data or exaggerated research claims
- [ ] Auth, ownership, persistence, and account lifecycle considered
- [ ] Reproducibility/metric changes documented
- [ ] No private credentials/user records included
- [ ] Relevant docs and actual screenshots updated
