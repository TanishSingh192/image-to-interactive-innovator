import type { AgentState, Observation, Outcome, RuleState, WorldState } from "./world";
import { mulberry32, hashStr } from "./rng";

/**
 * Baseline agent: a heuristic policy over a symbolic learned world model.
 * It receives the same observation/action contract an LLM agent would, so
 * hosted or local models can be plugged in later via the same interface.
 * It never sees TRUE_RULES — every rule below is learned from outcomes.
 */

const ruleKey = (action: string, ctx: string) => `${action} @ ${ctx}`;

function ctxOf(obs: Observation): string {
  const t = obs.tile;
  return t.obj ? `${t.terrain}/${t.obj}` : t.terrain;
}

export function findRule(mind: AgentState["mind"], key: string): RuleState | undefined {
  return mind.rules.find((r) => r.key === key);
}

function upsertRule(mind: AgentState["mind"], key: string, text: string, step: number, ok: boolean) {
  let r = findRule(mind, key);
  if (!r) {
    r = { key, text, kind: "hypothesis", confidence: 0.35, evidence: 0, step, shared: false };
    mind.rules.push(r);
  }
  r.evidence++;
  if (ok) {
    r.confidence = Math.min(0.99, r.confidence + 0.2);
    if (r.evidence >= 3 && r.confidence >= 0.75) r.kind = "confirmed";
  } else {
    r.confidence = Math.max(0.05, r.confidence - 0.25);
    if (r.confidence <= 0.15) r.kind = "incorrect";
  }
  return r;
}

/** Predict the outcome of an action from learned rules only. */
export function predict(mind: AgentState["mind"], action: string, obs: Observation): { text: string; confidence: number } {
  const verb = action.split(":")[0]!;
  if (verb === "move") {
    const d = action.split(":")[1]!;
    const delta = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d]!;
    const t = obs.view.find((v) => v.dx === delta[0] && v.dy === delta[1]);
    if (t && (t.terrain === "water" || t.terrain === "rock")) {
      const key = ruleKey("move", t.terrain);
      const r = findRule(mind, key);
      return { text: `blocked by ${t.terrain}`, confidence: r?.confidence ?? 0.5 };
    }
    return { text: "position changes", confidence: 0.9 };
  }
  const key = ruleKey(verb === "experiment" ? action : verb, ctxOf(obs));
  const r = findRule(mind, key);
  if (!r) return { text: "unknown outcome", confidence: 0 };
  return { text: r.text, confidence: r.confidence };
}

/** Compare prediction to actual outcome; update the symbolic model. Returns prediction error 0..1. */
export function learn(
  s: WorldState, a: AgentState, action: string, obs: Observation,
  predicted: { text: string; confidence: number }, actual: Outcome,
): { error: number; changed: RuleState | null } {
  const verb = action.split(":")[0]!;
  const actualText = actual.changes.join("; ");
  let key: string;
  let text: string;
  if (verb === "move") {
    const blocked = actualText.includes("blocked");
    const terrain = blocked ? (actualText.match(/blocked by (\w+)/)?.[1] ?? "unknown") : "open ground";
    key = ruleKey("move", terrain);
    text = blocked ? `move into ${terrain} → blocked` : "move into open ground → position changes";
  } else if (verb === "experiment" || verb === "craft") {
    key = ruleKey(action, ctxOf(obs));
    text = `${action.replace(":", " ")} → ${actual.success ? actual.changes.find((c) => c.includes("+1") && !c.includes("energy")) ?? "success" : "nothing happens"}`;
  } else {
    key = ruleKey(verb, ctxOf(obs));
    text = `${verb} on ${ctxOf(obs)} → ${actual.success ? actual.changes.filter((c) => !c.startsWith("energy")).join(", ") || "success" : actualText}`;
  }
  const before = findRule(a.mind, key);
  const rule = upsertRule(a.mind, key, text, s.clock, actual.success);
  // Error: 0 if prediction matched actual, scaled by confidence when wrong.
  const predictedOk = predicted.text !== "unknown outcome" && actualText.toLowerCase().includes(predicted.text.split("→").pop()?.trim().split(" ")[0]?.toLowerCase() ?? "~~~");
  const error = predicted.text === "unknown outcome" ? 1 : predictedOk === actual.success ? 0 : 1;
  s.stats.predictions++;
  s.stats.predictionErrors += error;
  return { error, changed: !before || before.kind !== rule.kind || before.evidence !== rule.evidence ? rule : null };
}

/** Baseline policy: survive, then gather, then test the hidden recipe, then explore. */
export function decide(s: WorldState, a: AgentState, obs: Observation, stepSeed: number): string {
  const r = mulberry32(hashStr(a.id) + s.clock * 7919 + stepSeed);
  const inv = a.inventory;

  if (a.energy < 30 && (inv["food"] ?? 0) > 0) { a.goal = "eat to recover"; return "eat"; }
  if (a.energy < 15) { a.goal = "rest"; return "rest"; }

  const here = obs.tile;
  const hungry = a.energy < 55;

  // Gather from the current tile when useful.
  if (here.obj === "berry" && hungry) { a.goal = "gather food"; return "gather"; }
  if (here.obj === "tree" && (inv["wood"] ?? 0) < 3) { a.goal = "gather wood"; return "gather"; }
  if (here.obj === "stone" && (inv["stone"] ?? 0) < 3) { a.goal = "gather stone"; return "gather"; }

  // Test the hidden crafting hypothesis once materials are in hand.
  if ((inv["wood"] ?? 0) >= 1 && (inv["stone"] ?? 0) >= 1 && (inv["tool"] ?? 0) < 1) {
    const key = ruleKey("experiment:wood+stone", ctxOf(obs));
    const known = findRule(a.mind, key);
    if (!known || known.kind !== "confirmed") {
      a.goal = "test hypothesis: wood + stone";
      return "experiment:wood+stone";
    }
    a.goal = "craft tool";
    return "experiment:wood+stone";
  }

  // Civilization behavior: share surplus and knowledge with nearby agents.
  if (s.config.allowComms && obs.nearbyAgents.length > 0) {
    const other = obs.nearbyAgents[0]!;
    if ((inv["food"] ?? 0) > 2 && r() < 0.4) { a.goal = `share food with ${other.name}`; return `give:${other.id}:food`; }
    if (s.config.allowSharing) {
      const confirmed = a.mind.rules.filter((x) => x.kind === "confirmed" && !x.shared);
      if (confirmed.length > 0 && r() < 0.5) {
        const rule = confirmed[0]!;
        rule.shared = true;
        a.goal = `teach ${other.name}`;
        return `say:I discovered: ${rule.text}`;
      }
    }
  }

  // Move toward the nearest useful object or unvisited tile.
  a.goal = "explore";
  const want: string[] = hungry ? ["berry"] : (inv["wood"] ?? 0) < 2 ? ["tree"] : (inv["stone"] ?? 0) < 2 ? ["stone", "tree"] : ["berry", "tree"];
  let best: { dx: number; dy: number } | null = null;
  let bestD = 99;
  for (const v of obs.view) {
    if (v.obj && want.includes(v.obj)) {
      const d = Math.abs(v.dx) + Math.abs(v.dy);
      if (d > 0 && d < bestD) { bestD = d; best = v; }
    }
  }
  if (best) {
    const dir = Math.abs(best.dx) > Math.abs(best.dy) ? (best.dx > 0 ? "E" : "W") : (best.dy > 0 ? "S" : "N");
    return `move:${dir}`;
  }
  // Wander toward unvisited tiles.
  const dirs = ["N", "S", "E", "W"];
  const unvisited = dirs.filter((d) => {
    const delta = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d]!;
    return !a.mind.visited.includes(`${a.x + delta[0]!},${a.y + delta[1]!}`);
  });
  const pick = unvisited.length > 0 && r() < 0.8 ? unvisited[Math.floor(r() * unvisited.length)]! : dirs[Math.floor(r() * 4)]!;
  return `move:${pick}`;
}
