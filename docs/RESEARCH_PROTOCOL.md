# Research protocol and reporting

[Documentation index](README.md) · [Simulation reference](SIMULATION_REFERENCE.md)

Genesis is an exploratory symbolic simulator. This guide proposes a disciplined workflow; it does not claim the prototype is a validated benchmark or that any sample hypothesis has been established.

## 1. Define a question

Use a narrow question tied to recorded behavior, for example:

> Under a fixed population and step budget, do completed runs with knowledge sharing enabled record different confirmed-rule counts from runs without sharing?

This is a proposed experiment, not a conclusion. Rule counts can include duplicates across agents, and sharing is guided by the baseline policy.

## 2. Record provenance

Keep the following with your report or experiment notes. Do not publish account identifiers or private records.

| Field | Why it matters |
| --- | --- |
| Source revision or version | Changes to policy/world generation can change outcomes |
| Run name and hypothesis | Identifies intent without relying on chart truncation |
| Seed and dimensions | Describes initial terrain |
| Agent count | Changes total action count and recent metric window |
| Step budget and completed steps | Distinguishes intended and executed work |
| Communication/sharing switches | Separates messaging/transfer capability from rule teaching |
| Baseline policy identity | Current runs use the built-in symbolic policy, not a selected external model |
| Browser and execution date | Identifies the execution environment |
| Completion status | Exclude abandoned/incomplete rows from outcome comparisons |
| Metric definition/window | Prevents interpreting recent accuracy as full-run accuracy |

Experiment summaries do not currently persist every provenance field automatically. Record source/browser/date information in notes rather than assuming it is recoverable from the summary.

## 3. Design comparisons

1. Hold population, step budget, dimensions, and policy constant.
2. Change one setting at a time; keep communication enabled if comparing sharing on/off.
3. Repeat across several independently executed runs and terrain seeds.
4. Report each run as well as group summaries; avoid drawing conclusions from a single example.
5. Keep the browser open through completion and use one active simulation tab.
6. Separate independent experiment results from active-world activity and inspection buffers.

Matching seeds constrain terrain, **not** trajectories: random agent UUIDs seed policy choices. Do not label runs as exact paired replays. Achieving that requires stable agent identities/RNG streams, which are future work.

## 4. Interpret metrics correctly

| Measure | Suitable interpretation | Avoid |
| --- | --- | --- |
| Total rules | Number of per-agent symbolic records | Number of unique true world laws |
| Confirmed rules | Current heuristic confirmation labels | Independently verified causal discoveries |
| Accuracy | Zero-error fraction within recent action buffer | Full-run predictive correctness or calibrated intelligence |
| Coverage | Mean visited tiles divided by all tiles | Percentage of traversable world explored by the civilization jointly |
| Exchanges | Recorded transfer events | Emergent economy or learned cooperation |
| Crafted | Environment tool creation counter | Unguided invention of recipes |
| Discovery-event count | Discovery-kind events retained in bounded buffer | Complete lifetime discovery count |

At most 300 agent-action records and 200 controller events are retained in memory. Larger populations shorten the tick span represented by accuracy. A 100% plot can arise from the heuristic success/text comparison and does not establish causal understanding.

The built-in analytics groups all completed runs by sharing flag, without automatically matching other configurations. Do not infer a sharing effect from those averages until you have checked the underlying settings. Knowledge-derived analytics and Settings exports also have the world-ID wiring limitation described in the reference guide.

## 5. Suggested validation checklist

These are **recommended checks**, not assertions that a full automated suite exists:

- Confirm movement cost, blocked movement, and exhaustion behavior with isolated engine tests.
- Check material consumption, tool creation, and actual gather yields.
- Verify local observations omit ground truth and other minds; separately inspect policy priors.
- Compare stored summary definitions to raw buffers, especially windowed accuracy.
- Confirm pause/reload preserves a snapshot while recent view buffers are not restored.
- Test ownership policies and parent/child ownership consistency using separate authorized accounts.
- Test account changes and concurrent tabs before broader multi-user use.
- Verify incomplete/cancelled runs are not included in completed-run claims.

The currently existing automated test is a routing smoke test. Security isolation, scientific validity, and complete engine behavior are not established by that test.

## 6. Reporting template

```text
Question:
Source revision and execution environment:
Policy: built-in symbolic baseline
Configurations and number of runs:
Completion criteria:
Recorded outcomes:
Metric definitions and buffer windows:
Between-run variation:
Observed failures or missing records:
Known priors and nondeterminism:
Interpretation:
Limitations and next experiment:
```

Fill outcomes only from actual records. Do not add invented example numbers, external model reasoning, official scores, confidence intervals, or significance claims. If statistical analysis is performed outside the app, state its method and inputs explicitly.

## 7. Claims appropriate for this repository

Appropriate: “The prototype records a symbolic agent's actions and rule evidence in a simulated world.”

Not established: “The agent autonomously discovered arbitrary hidden laws without prior knowledge,” “This proves emergent civilization,” or “These are official ARC-AGI results.”

Framed screenshots document the captured interface state. They are not experimental datasets, reproducibility guarantees, or benchmark evidence.