# Setup and deployment

[Back to README](../README.md)

## Local application

Use current Bun and Node.js 22.12+ or a compatible newer release. From the checkout root:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
```

Fill `.env.local` with your backend's public connection values. These names are the generated client's technical contract:

| Variable | Meaning | Visibility |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public backend endpoint | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public application key; row policies still apply | Public |

Vite embeds `VITE_*` values into client code. Never substitute an administrative/service key. The example contains no credentials; `.env.local` is ignored by the existing `*.local` ignore rule. Do not commit any private environment files.

```sh
bun run dev
```

Open the address printed by Vite. Backend network access and a signed-in account are required even though simulation calculations execute locally. Missing connection values prevent working sign-in/persistence.

## Lovable-managed development

Lovable injects managed configuration for preview and hosting. Manage data and auth in the project's **Cloud** interface; do not edit generated integration files. Export records separately through **Cloud → Advanced settings → Export data**. A GitHub checkout does not clone accounts, stored worlds, or hosted auth settings.

Google sign-in currently uses Lovable's auth helper. Hosted provider/settings were not re-verified during this documentation update; configuration must be checked if sign-in fails.

## Schema and independent backends

- `drizzle/migrations/0000_migration.sql`: historical ARC-lab schema, no longer used by Genesis pages.
- `drizzle/migrations/0001_genesis_tables.sql`: active Genesis schema, grants, row policies, relationships.

For an empty independently managed compatible backend, use an authorized migration runner to apply checked-in migrations in order. They require PostgreSQL auth roles and `auth.uid()` support; this is not a standalone SQLite schema. Do not reapply migrations to the existing managed project.

`drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL` for privileged migration execution. Ordinary local frontend development does not need it. Lovable Cloud does not expose its database password or administrative key to project users; use managed migrations. Independent infrastructure requires credentials supplied by that infrastructure's owner, server-side only.

## Authentication

Create/use an account on the configured backend; no demo password is supplied. Email confirmation depends on hosted settings. Authorize actual local/public origins and destinations; the current email flow uses `/experiments`. Google returns to the same origin through the Lovable helper. Independent hosting may require adapting this integration; copying environment values alone does not establish functioning OAuth.

Reload after sign-out before changing accounts, because in-tab controller invalidation is not implemented.

## Commands and validation

```sh
bun run test
bun run lint
bun run build
bun run preview
```

The existing test is a routing smoke test, not complete engine coverage. Also verify sign-in, world loading, stepping, pausing/saving, reload, rule inspection, experiment completion, and exports in a browser. Preview behavior depends on the generated hosting adapter.

## Deployment and GitHub

Lovable hosting uses the generated TanStack/Vite configuration. Publish through the editor when ready. Independent hosting needs a compatible TanStack Start runtime adapter, public build-time configuration, reachable services, migrated tables/policies, and authorized auth redirects. Do not assume a static-only host can serve Start output. Store private credentials in host-managed secrets.

Connect the repository using Lovable chat **+ → GitHub → Connect project**, authorize GitHub, choose the owner, and create the repository. Source, docs, and screenshots then synchronize both ways. Avoid rewriting published history. Sync neither exports backend data/secrets nor publishes an app update.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing configuration | Both public fields populated before starting Vite |
| Sign-in failure | Network, account confirmation, actual provider/redirect settings |
| Empty/failed writes | Session, applied Genesis migrations, grants/row policies |
| Run stops when tab closes | Expected: no background worker |
| Same seed, different trajectory | Random agent UUIDs influence policy RNG |
| No live chart after reload | Recent-action buffer is in-memory; run again or inspect stored records |
| Experiment remains running | Browser stopped before completion was persisted |
| Export buttons stay disabled | Current Settings hooks lack a required world ID; see the simulation reference |

## Operational checklist

### Before local development

- Confirm dependency installation completed using the checked-in lockfile.
- Set only public browser fields in `.env.local`; keep the file out of source control.
- Confirm the target backend has the application migrations and account settings you intend to use.
- Use a local/test account whose records you are authorized to inspect.

### Before sharing a deployment

- Verify real sign-in and configured redirects on the target origin; source inspection cannot establish hosted settings.
- Run one complete browser experiment and confirm its completion record.
- Pause and reload a live world to check persistence, then inspect actual failures rather than assuming successful UI actions imply saved records.
- Review [Security](../SECURITY.md) for client integrity, parent ownership, multi-tab, and account-switch boundaries.
- Keep database exports and auth secrets separate from the MIT-licensed source repository.

### Before publishing documentation screenshots

- Capture actual activity, not invented data or mock model responses.
- Exclude account identifiers, tokens, and private notes.
- Label selected crops and bounded metrics honestly.
- Inspect every final image for readable text, intact framing, missing assets, and clipping.

## Dependencies and hosting licenses

The project source uses the [MIT License](../LICENSE). Installed packages and third-party assets retain their own license terms. Hosting, account access, backend storage, and any future model usage are services, not permissions supplied by the source license.
