# Genesis documentation

[Project README](../README.md) · [MIT license](../LICENSE)

## Choose a reading path

| Audience | Suggested order |
| --- | --- |
| First-time user | Project README → Setup → First exploration → Simulation reference |
| Researcher | Architecture → Simulation reference → Research protocol → Security |
| Contributor | Setup → Architecture → Contributing → Relevant reference sections |
| Hosting/operator | Setup → Persistence and trust sections in Architecture → Security |

## Guide directory

- [Setup and deployment](SETUP.md): environment, backend requirements, migration history, auth destinations, commands, troubleshooting.
- [Architecture](ARCHITECTURE.md): responsibilities, execution sequence, data relationships, metrics, persistence, client trust boundaries.
- [Simulation reference](SIMULATION_REFERENCE.md): default world, experiment controls, actions, observations, symbolic memory, exports.
- [Research protocol](RESEARCH_PROTOCOL.md): experiment design, run provenance, metric interpretation, reporting, suggested verification.
- [Contributing](../CONTRIBUTING.md): focused changes, tests, honest claims, safe screenshots.
- [Security](../SECURITY.md): implemented controls, known boundaries, private reporting.

## Documentation conventions

**Implemented** describes current source behavior. **Limitation** describes a known constraint. **Proposed** describes future work; it is not a shipped capability.

Framed images under `images/` show the real app, with account identifiers excluded. The screenshot session is illustrative: its numbers are not a baseline benchmark or promised outcome. The repository does not include private world exports or account sessions.

Technical environment variable names are preserved in setup examples because they must match the generated client. Documentation never supplies private credentials.