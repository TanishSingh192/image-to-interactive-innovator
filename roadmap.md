# Genesis build roadmap

- [x] DB: genesis_worlds/agents/experiences/knowledge/events/experiments + RLS
- [x] Engine: seeded world, hidden rules, day/night, agent learning loop
- [x] Controller: play/pause/step/speed/reset, DB persistence
- [x] Pages: World, Agents, World Model, Civilization, Experiments (+new), Analytics, Settings
- [x] Dark research theme
- [x] 3D world view (2D toggle kept)
- [x] MCP server (OAuth, read-only tools)

## Research engine phases

Implementation status is separate from empirical validation. The checkboxes below track code presence, not a claim that the phase has passed repeatable experiments.

- [x] Phase 1 — Agent behavior: utility-based goal selection, resource planning, exploration incentive, failure memory, and non-resource objectives are implemented.
- [x] Phase 2 — Experimentation: agents generate candidate combinations, record predictions and outcomes, and retain learned recipes. Hypothesis evaluation now distinguishes supported, refuted, and inconclusive predictions.
- [x] Phase 3 — Ecosystem: deer and wolves, movement, grazing/predation, reproduction, deaths, and resource renewal are implemented.
- [x] Phase 4 — Civilization mechanics: cooperation, skill-based roles, agriculture, construction, trade, teaching, and cumulative technology tracking are implemented.
- [ ] Phase 5 — Optional language-model policy behind the validated action interface, with repeatable comparison against the baseline.

## Validation still required

- [ ] Run the complete Vitest suite and production build on the current branch.
- [ ] Add seeded, repeatable multi-run experiments comparing the new policy against the previous baseline.
- [ ] Report survival rate, discovery rate, prediction error, failed experiments, exploration coverage, farming/building, and cooperation across seeds.
- [ ] Test for stuck agents, resource starvation, repeated failed actions, and recipe-discovery bottlenecks.
- [ ] Confirm saved snapshots and existing UI views handle the added `inconclusive` hypothesis status.

## GitHub documentation
- [x] README, architecture, setup, reference, research protocol, MIT license, templates, screenshots
- [ ] GitHub upload — requires the owner to connect this project through Lovable's GitHub sync
