# Simulation reference

[Documentation index](README.md) · [Architecture](ARCHITECTURE.md)

This is a source reference for the built-in environment and baseline. The hidden transitions below are for researchers; the agent observation does not contain this list. Policy priors are still partly hand-coded.

## Configuration

| Field | Live default / experiment value | Meaning |
| --- | --- | --- |
| Width × height | 26 × 18 | Environment dimensions |
| Seed | 7 initially | Seed for terrain generation; not complete trajectory determinism |
| Agents | 3 default; experiment UI clamps to 1–6 | Population |
| Day length | 40 ticks | Full cycle; night begins in the second half |
| Step budget | 300 default; experiment UI clamps to 50–2000 | Number of world ticks, not total agent actions |
| Communication | Toggle | Gates message and transfer actions |
| Knowledge sharing | Toggle | Controls baseline rule-teaching behavior when communication is enabled |

The UI's bounds are presentation controls, not a server-certified configuration validator. New-world creation chooses a new random terrain seed. The current experiment page uses fixed dimensions/day length.

## Observation shape

An observation includes clock, phase, position, energy, inventory, the current tile, nearby agent identities/positions, and the local radius-two tile view (up to 5 × 5). Nearby agents use Manhattan distance ≤ 2. World edges reduce the available view.

`TRUE_RULES` and other agents' minds are not included. Nevertheless the decision function receives full world state, so a future untrusted adapter needs a strictly isolated observation-only contract.

## Action grammar

Actions are string-encoded internal commands, not public HTTP endpoints. The baseline chooses them; the UI does not provide a free-form action console.

| Action | Preconditions | Outcome / costs |
| --- | --- | --- |
| `move:N`, `move:S`, `move:E`, `move:W` | Valid direction, positive energy | Move one tile if walkable; costs 1 energy by day or 2 at night, including blocked attempts |
| `gather` | Positive energy, useful object on current tile | Tree → wood, stone → stone, charged berry → food; costs 1 energy even when no resource is available |
| `experiment:wood+stone` | At least one of each material | Consumes both, adds one tool, costs 2 energy |
| `craft:wood+stone` | Same | Alias for experimentation |
| `experiment:item1+item2` | Items present | Other pairs consume inputs and produce nothing; missing inputs return failure before spending energy |
| `eat` | At least one food | Consumes one food; adds 25 energy, capped at 100 |
| `rest` | No inventory requirement | Adds 8 energy by day or 14 at night, capped at 100 |
| `give:targetId:resource` | Communication enabled, nearby target within distance 2, inventory available | Transfers one unit; increments exchange counter |
| `say:text` | Communication enabled | Records message text, truncated to 120 characters; message buffer capped at 200 |

At zero energy, only rest/eat are permitted. Unknown actions return failure. Water, rock, and the world edge block movement. A tool doubles **wood and stone** gathering, not food gathering. Berry bushes spend one charge per food pickup and replenish to two charges after the scheduled day-length delay. Tree and stone gathering do not deplete those objects in the current engine.

Message logging and rule-sharing behavior are distinct. A message saying a rule was discovered is not independent validation of that rule. Current role labels are descriptive heuristics, not learned professions.

## Outcome and memory records

`Outcome` contains a success boolean, textual changes, and event strings. A recent action record contains step, agent identity/name, action, prediction text/confidence, actual text, error, and success.

Rules contain key, text, kind, confidence, evidence, step, and shared flag. Kinds are hypothesis, confirmed, and incorrect. See [Architecture](ARCHITECTURE.md#learning-and-metric-meaning) for exact threshold behavior and error calculation caveats.

One tick includes one action per agent before the clock advances. With three agents, 100 ticks can produce 300 action records; the recent buffer cap therefore spans a different number of ticks for different populations.

## Persistence and query scopes

| Read | Scope |
| --- | --- |
| Worlds | Accessible world rows, newest first |
| Agents | Requires a world ID; agents for that world |
| Knowledge | Requires a world ID; records ordered by discovery step |
| Experiences | Requires a world ID; records ordered by step |
| Events | Requires a world ID; latest 100 events |
| Experiments | Accessible experiment records, newest first |

Database row policies constrain access. These query functions are not a proof of cross-reference ownership consistency or tamper-resistant execution.

## Export status and formats

Settings includes intended Knowledge JSON/CSV and Experiences JSON/CSV downloads. JSON serializes queried records; CSV uses row keys as columns and serializes nested objects as quoted JSON strings. Buttons require nonempty queried data.

**Current wiring limitation:** Settings calls the knowledge/experience hooks without a world ID, while those hooks are disabled without one. The export buttons may consequently remain disabled even after recording a world. Analytics similarly calls knowledge without a world ID, so its knowledge-based discovery timeline may remain empty. This documentation update does not change that application logic.

The intended exports are not full account backups or experiment trajectory archives. There is no world-snapshot download button in the current Settings view. Backend export is a separate managed operation; never publish private exports as repository sample data.

## Analytics interpretation

Completed experiment rows drive outcome charts. Sharing-on/off groups show unweighted mean rule count and accuracy across completed runs; configurations need not be matched. Empty groups display zero and should not be treated as observed zero performance. Missing summary fields also default to zero in the chart mapping.

The knowledge timeline groups discovery steps into 25-step buckets when knowledge rows are available. It is not an elapsed-time learning curve, independent causal evaluator, or significance test. See the [Research protocol](RESEARCH_PROTOCOL.md) before interpreting comparisons.