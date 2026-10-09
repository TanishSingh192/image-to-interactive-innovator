import type { AgentState, Hypothesis, MindState, Observation, Outcome, RuleState, WorldState } from "./world";
import { mulberry32, hashStr } from "./rng";

/**
 * Baseline agent: a utility-driven planner over a symbolic learned world model.
 * It sees only its Observation and its own mind — never the world state,
 * the hidden recipe table, or TRUE_RULES.
 */

const EDIBLE_GUESS = ["cooked_meat", "food", "meat"];
const DELTA: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const ROLE_OF: Record<string, string> = {
  wood: "woodcutter", stone: "mason", clay: "mason", hunt: "hunter", plant: "farmer", food: "forager",
  experiment: "inventor", teach: "teacher", trade: "trader", build: "builder",
};

export function findRule(mind: MindState, key: string): RuleState | undefined {
  return mind.rules.find((r) => r.key === key);
}

/* ---------------- context + outcome summarisation ---------------- */

function ctxKey(action: string, obs: Observation): string {
  const [verb, ...rest] = action.split(":");
  switch (verb) {
    case "move": {
      const d = DELTA[rest[0] ?? ""];
      const t = d ? obs.view.find((v) => v.dx === d[0] && v.dy === d[1]) : undefined;
      return `move into ${t ? (t.terrain === "water" || t.terrain === "rock" ? t.terrain : "open ground") : "world edge"}`;
    }
    case "gather": return `gather on ${obs.tile.obj ?? obs.tile.terrain}${obs.tile.obj && obs.tile.charges <= 0 ? " (depleted)" : ""}`;
    case "experiment": case "craft": return `combine ${(rest[0] ?? "").split("+").sort().join(" + ")}`;
    case "hunt": return `hunt ${(obs.inventory["spear"] ?? 0) > 0 ? "with spear" : "bare-handed"}`;
    case "plant": return `plant on ${obs.tile.terrain}${obs.tile.obj || obs.tile.struct ? " (occupied)" : ""}`;
    case "build": return `build with ${rest[0]}`;
    case "eat": return `eat ${rest[0] ?? "food"}`;
    case "rest": return `rest${obs.tile.struct === "shelter" ? " in shelter" : ""} at ${obs.phase}`;
    case "give": return `give ${rest[1]}`;
    case "trade": return `trade ${rest[1]} for ${rest[2]}`;
    case "teach": return "teach";
    case "say": return "say";
    default: return verb ?? "unknown";
  }
}

/** Reduce an outcome to a comparable effect (drops energy costs and coordinates). */
export function summarize(actual: Outcome): string {
  const eff = actual.changes.filter((c) => !c.startsWith("energy -") && !c.startsWith("position →"));
  if (actual.changes.some((c) => c.startsWith("position →"))) eff.unshift("position changes");
  return eff.join(", ") || (actual.success ? "success" : "no effect");
}

/* ---------------- prediction + learning ---------------- */

export function predict(mind: MindState, action: string, obs: Observation): { text: string; confidence: number } {
  const key = ctxKey(action, obs);
  const r = findRule(mind, key);
  if (r) {
    const effect = r.text.split(" → ").slice(1).join(" → ");
    return { text: effect, confidence: r.confidence };
  }
  // Generalise from similar experience: an untested combination is predicted from base rates.
  if (key.startsWith("combine")) {
    const tried = Object.values(mind.recipes);
    const hits = tried.filter((v) => v !== "nothing").length;
    return tried.length
      ? { text: hits / tried.length >= 0.5 ? "new item" : "nothing happens", confidence: 0.2 }
      : { text: "unknown outcome", confidence: 0 };
  }
  return { text: "unknown outcome", confidence: 0 };
}

/** Compare a prediction with the observed result of an experiment.
 * Broad predictions ("new item") are evaluated at category level; unknown predictions
 * are inconclusive rather than being incorrectly counted as a success or failure.
 */
export function evaluateHypothesis(prediction: string, observedResult: string): Hypothesis["status"] {
  const observed = observedResult.trim().toLowerCase() === "nothing"
    ? "nothing happens"
    : observedResult.trim().toLowerCase();
  const p = prediction.trim().toLowerCase();
  if (!p || p === "unknown outcome") return "inconclusive";
  if (p === "new item") return observed === "nothing happens" ? "refuted" : "supported";
  if (p.includes("nothing happens")) return observed === "nothing happens" ? "supported" : "refuted";
  // Predictions based on a learned rule may describe the full inventory delta. Extract
  // the produced item (the +1 effect) so it can be compared to the observed product.
  const predictedItem = p.match(/(?:^|,\\s*)([a-z][a-z0-9_ -]*)\\s+\\+1/)?.[1]?.trim() ?? p;
  return predictedItem === observed ? "supported" : "refuted";
}

/** Compare prediction to outcome, revise the rule, update memory. Returns prediction error 0..1. */
export function learn(
  s: WorldState, a: AgentState, action: string, obs: Observation,
  predicted: { text: string; confidence: number }, actual: Outcome,
): { error: number; changed: RuleState | null } {
  const m = a.mind;
  const key = ctxKey(action, obs);
  const effect = summarize(actual);
  let r = findRule(m, key);
  const before = r ? { kind: r.kind, evidence: r.evidence } : null;
  if (!r) {
    r = { key, text: `${key} → ${effect}`, kind: "hypothesis", confidence: 0.35, evidence: 0, step: s.clock, shared: false, source: "self" };
    m.rules.push(r);
  }
  const ruleEffect = r.text.split(" → ").slice(1).join(" → ");
  const consistent = ruleEffect === effect;
  r.evidence++;
  if (consistent) {
    r.confidence = Math.min(0.99, r.confidence + 0.2);
    if (r.evidence >= 3 && r.confidence >= 0.75) r.kind = "confirmed";
    if (r.source && r.source !== "self" && r.kind === "hypothesis" && r.evidence >= 1) r.confidence = Math.max(r.confidence, 0.7);
  } else {
    r.confidence = Math.max(0.05, r.confidence - 0.3);
    if (r.confidence <= 0.15) {
      // Revise: a contradicted belief is marked incorrect and replaced with the observed effect.
      if (r.kind === "confirmed" || (r.source && r.source !== "self")) r.kind = "incorrect";
      r.text = `${key} → ${effect}`;
      r.confidence = 0.35;
      r.evidence = 1;
      if (r.kind === "incorrect") r.kind = "hypothesis";
    }
  }

  // Memory updates.
  const verb = action.split(":")[0]!;
  const fkey = `${key}@${obs.position.x},${obs.position.y}`;
  if (!actual.success) {
    const f = m.failures[fkey] ?? { count: 0, last: 0 };
    f.count++; f.last = s.clock;
    m.failures[fkey] = f;
    if (verb === "move") {
      const d = DELTA[action.split(":")[1] ?? ""];
      if (d) m.failures[`blocked@${obs.position.x + d[0]},${obs.position.y + d[1]}`] = { count: 99, last: s.clock };
    }
  }
  if (verb === "gather" && actual.success && obs.tile.obj) {
    const item = actual.changes.find((c) => /\+\d/.test(c) && !c.startsWith("energy"))?.split(" ")[0];
    if (item) m.sources[item] = obs.tile.obj;
    if (actual.changes.some((c) => c.includes("(tool)"))) m.uses["tool"] = "doubles gathering";
    if (actual.changes.some((c) => c.startsWith("seed"))) m.sources["seed"] = "berry";
  }
  if (verb === "experiment" || verb === "craft") {
    const pair = (action.split(":")[1] ?? "").split("+").sort().join("+");
    const result = actual.changes.find((c) => c.endsWith("+1"))?.split(" ")[0] ?? (actual.changes.includes("nothing happens") ? "nothing" : undefined);
    if (result) {
      m.recipes[pair] = result;
      const h = m.hypotheses.find((x) => x.action === action && x.status === "untested");
      if (h) {
        h.status = evaluateHypothesis(h.prediction, result);
        h.result = result === "nothing" ? "nothing happens" : result;
      }
    }
  }
  if (verb === "hunt" && actual.success && (obs.inventory["spear"] ?? 0) > 0) m.uses["spear"] = "makes hunting reliable";
  if (verb === "hunt" && actual.success) m.sources["meat"] = "hunt";
  if (verb === "plant" && actual.success) m.uses["seed"] = "plant to grow a farm";
  if (verb === "build" && actual.success) m.uses[action.split(":")[1]!] = "builds a shelter";
  if (verb === "eat" && actual.success) {
    const g = actual.changes.find((c) => c.startsWith("energy +"));
    if (g) m.uses[action.split(":")[1] ?? "food"] = `edible (${g})`;
  }
  if (verb === "rest" && actual.changes.some((c) => c.includes("(shelter)"))) m.uses["shelter"] = "doubles rest";
  if (actual.success) {
    const skill = verb === "gather" ? actual.changes[1]?.split(" ")[0] ?? "gather" : verb;
    if (ROLE_OF[skill]) m.skills[skill] = (m.skills[skill] ?? 0) + 1;
  }
  const top = Object.entries(m.skills).sort((x, y) => y[1] - x[1])[0];
  const total = Object.values(m.skills).reduce((x, y) => x + y, 0);
  if (top && total >= 8 && top[1] / total >= 0.35) a.role = ROLE_OF[top[0]] ?? "generalist";

  let error: number;
  if (verb === "experiment" || verb === "craft") {
    const result = actual.changes.find((c) => c.endsWith("+1"))?.split(" ")[0]
      ?? (actual.changes.includes("nothing happens") ? "nothing" : undefined);
    const assessment = result ? evaluateHypothesis(predicted.text, result) : "inconclusive";
    error = assessment === "supported" ? 0 : assessment === "refuted" ? 1 : 0.5;
  } else {
    error = predicted.text === "unknown outcome" ? 1 : predicted.text === effect ? 0 : 1;
  }
  s.stats.predictions++;
  s.stats.predictionErrors += error;
  const changed = !before || before.kind !== r.kind || before.evidence !== r.evidence ? r : null;
  return { error, changed };
}

/** A nearby agent teaches a recipe; the listener stores it as an untested, attributed hypothesis. */
export function receiveTeaching(listener: AgentState, teacher: string, pair: string, result: string, step: number): boolean {
  const m = listener.mind;
  if (m.recipes[pair]) return false;
  const key = `combine ${pair.split("+").join(" + ")}`;
  if (!findRule(m, key)) {
    m.rules.push({ key, text: `${key} → ${pair.split("+").map((i) => `${i} -1`).join(", ")}, ${result} +1`, kind: "hypothesis", confidence: 0.5, evidence: 0, step, shared: false, source: teacher });
  }
  if (!m.hypotheses.some((h) => h.action === `experiment:${pair}`)) {
    m.hypotheses.push({ id: `${listener.name}-${step}-${pair}`, action: `experiment:${pair}`, prediction: result, confidence: 0.5, status: "untested", step, source: teacher });
  }
  return true;
}

/** Partner policy for trade offers: accept when the offer fills a need and the request is surplus. */
export function acceptTrade(partner: AgentState, give: string, get: string): boolean {
  const has = (k: string) => partner.inventory[k] ?? 0;
  const wants = partner.mind.plan.includes(give) || has(give) < 1 || (EDIBLE_GUESS.includes(give) && partner.energy < 60);
  return wants && has(get) >= 2;
}

/* ---------------- memory map + navigation ---------------- */

function remember(m: MindState, obs: Observation) {
  for (const v of obs.view) {
    m.seen[`${obs.position.x + v.dx},${obs.position.y + v.dy}`] = `${v.terrain}/${v.obj ?? ""}/${v.ready ? 1 : 0}/${v.struct ?? ""}`;
  }
}

function nearestSeen(m: MindState, obs: Observation, pred: (terrain: string, obj: string, ready: boolean, struct: string, key: string) => boolean, step: number, dayLength: number) {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const [key, v] of Object.entries(m.seen)) {
    const [terrain, obj, ready, struct] = v.split("/") as [string, string, string, string];
    if (!pred(terrain, obj, ready === "1", struct, key)) continue;
    const dep = Object.entries(m.failures).find(([k]) => k.endsWith(`(depleted)@${key}`) || k === `gather on ${obj} (depleted)@${key}`);
    if (dep && step - dep[1].last < dayLength) continue;
    const [x, y] = key.split(",").map(Number) as [number, number];
    const d = Math.abs(x - obs.position.x) + Math.abs(y - obs.position.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}

function walkableKnown(m: MindState, x: number, y: number) {
  if (m.failures[`blocked@${x},${y}`]) return false;
  const v = m.seen[`${x},${y}`];
  if (!v) return true; // unknown → worth trying
  const t = v.split("/")[0];
  return t !== "water" && t !== "rock";
}

function stepToward(m: MindState, obs: Observation, tx: number, ty: number, r: () => number): string {
  const { x, y } = obs.position;
  const opts = Object.entries(DELTA)
    .filter(([, [dx, dy]]) => walkableKnown(m, x + dx, y + dy))
    .map(([d, [dx, dy]]) => ({ d, dist: Math.abs(tx - x - dx) + Math.abs(ty - y - dy) + r() * 0.5 }))
    .sort((p, q) => p.dist - q.dist);
  return `move:${opts[0]?.d ?? "NSEW"[Math.floor(r() * 4)]}`;
}

function frontier(m: MindState, obs: Observation, r: () => number) {
  // Nearest remembered walkable tile that has not been visited — an exploration incentive.
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (const [key, v] of Object.entries(m.seen)) {
    if (m.visited.includes(key)) continue;
    const t = v.split("/")[0];
    if (t === "water" || t === "rock") continue;
    const [x, y] = key.split(",").map(Number) as [number, number];
    const d = Math.abs(x - obs.position.x) + Math.abs(y - obs.position.y) + r() * 3;
    if (d > 0 && d < bestScore) { bestScore = d; best = { x, y }; }
  }
  return best;
}

/* ---------------- planning ---------------- */

/** Resolve the raw materials needed to make `item` from learned recipes. */
export function planFor(m: MindState, item: string, inv: Record<string, number>, depth = 0): string[] | null {
  if ((inv[item] ?? 0) > 0) return [];
  if (m.sources[item]) return [item];
  if (depth > 3) return null;
  const recipe = Object.entries(m.recipes).find(([, res]) => res === item);
  if (!recipe) return null;
  const parts = recipe[0].split("+");
  const need: string[] = [];
  const pool = { ...inv };
  for (const p of parts) {
    if ((pool[p] ?? 0) > 0) { pool[p]!--; continue; }
    const sub = planFor(m, p, pool, depth + 1);
    if (!sub) return null;
    need.push(...sub);
  }
  return need;
}

/** Items worth making, given what the agent has learned they are for. */
function desiredItems(m: MindState, inv: Record<string, number>): string[] {
  const wish: string[] = [];
  if (!inv["tool"]) wish.push("tool");
  if (!inv["spear"] && (m.recipes["tool+wood"] === "spear" || m.uses["spear"])) wish.push("spear");
  if (!inv["shelter_kit"] && !m.uses["shelter_kit"] && Object.values(m.recipes).includes("shelter_kit")) wish.push("shelter_kit");
  if (!inv["plank"] && !Object.values(m.recipes).includes("shelter_kit")) wish.push("plank");
  return wish;
}

/** Candidate hypotheses: every untried pair of held materials plus untested affordances. */
export function candidateHypotheses(m: MindState, obs: Observation): string[] {
  const items = Object.entries(obs.inventory).filter(([, n]) => n > 0);
  const out: string[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i; j < items.length; j++) {
      const [a, na] = items[i]!; const [b] = items[j]!;
      if (a === b && na < 2) continue;
      const pair = [a, b].sort().join("+");
      if (m.recipes[pair]) continue;
      out.push(`experiment:${pair}`);
    }
  }
  for (const [item, n] of items) {
    if (n > 0 && !m.uses[item] && !["food", "meat", "cooked_meat", "seed", "wood", "stone", "clay"].includes(item) && !m.failures[`build with ${item}@${obs.position.x},${obs.position.y}`])
      out.push(`build:${item}`);
  }
  return out;
}

/* ---------------- decision ---------------- */

export interface Drive { name: string; score: number; action: string; why: string }

/** Utility-based goal selection. Mutates goal/plan/drives on the agent's own mind. */
export function decide(a: AgentState, obs: Observation, dayLength: number): string {
  const m = a.mind;
  const r = mulberry32(hashStr(a.name) + obs.clock * 7919);
  remember(m, obs);
  const inv = obs.inventory;
  const has = (k: string) => (inv[k] ?? 0) > 0;
  const here = obs.tile;
  const step = obs.clock;
  const near = (pred: Parameters<typeof nearestSeen>[2]) => nearestSeen(m, obs, pred, step, dayLength);
  const go = (t: { x: number; y: number } | null, why: string) => {
    if (!t) return null;
    m.target = { ...t, why };
    return t.x === obs.position.x && t.y === obs.position.y ? null : stepToward(m, obs, t.x, t.y, r);
  };
  const skillBias = (k: string) => {
    const total = Object.values(m.skills).reduce((x, y) => x + y, 0) || 1;
    return 1 + 0.3 * ((m.skills[k] ?? 0) / total);
  };
  const drives: Drive[] = [];
  const add = (name: string, score: number, action: string | null, why: string) => { if (action) drives.push({ name, score, action, why }); };

  // Survival — hunger.
  const hunger = Math.max(0, (65 - obs.energy) / 65);
  if (hunger > 0) {
    const edible = ["cooked_meat", "food", "meat"].find((k) => has(k));
    if (edible) add("hunger", 0.4 + hunger, `eat:${edible}`, `eat ${edible}`);
    else if (has("meat") && has("wood") && m.recipes["meat+wood"] === "cooked_meat") add("hunger", 0.4 + hunger, "experiment:meat+wood", "cook meat");
    else if (here.obj === "berry" && here.charges > 0) add("hunger", 0.3 + hunger, "gather", "pick berries");
    else add("hunger", 0.25 + hunger, go(near((_t, o, ready) => o === "berry" && ready), "food"), "find food");
  }
  // Fatigue.
  if (obs.energy < 22) {
    const shelter = near((_t, _o, _r, st) => st === "shelter");
    const onShelter = here.struct === "shelter";
    const dist = shelter ? Math.abs(shelter.x - obs.position.x) + Math.abs(shelter.y - obs.position.y) : 99;
    add("fatigue", 1.1 - obs.energy / 40, onShelter || dist > 4 ? "rest" : go(shelter, "shelter"), "recover energy");
  }
  // Safety — wolves at night.
  const wolf = obs.nearbyAnimals.find((n) => n.species === "wolf");
  if (wolf && obs.phase === "night" && here.struct !== "shelter") {
    const shelter = near((_t, _o, _r, st) => st === "shelter");
    const flee = go({ x: obs.position.x - Math.sign(wolf.dx || 1) * 3, y: obs.position.y - Math.sign(wolf.dy || 1) * 3 }, "flee wolf");
    add("safety", 0.95, shelter ? go(shelter, "shelter from wolves") ?? "rest" : flee, "avoid wolves");
  }

  // Curiosity — genuine experimentation loop.
  const cands = candidateHypotheses(m, obs).filter((c) => {
    if (!c.startsWith("experiment:")) return true;
    // Never burn the last food on a blind experiment while hungry.
    return !(c.includes("food") && obs.energy < 60);
  });
  if (cands.length) {
    const pick = cands[Math.floor(r() * cands.length)]!;
    const p = predict(m, pick, obs);
    if (!m.hypotheses.some((h) => h.action === pick && h.status === "untested")) {
      m.hypotheses.push({ id: `${a.name}-${step}-${pick}`, action: pick, prediction: p.text, confidence: p.confidence, status: "untested", step, source: "self" });
      if (m.hypotheses.length > 60) m.hypotheses.shift();
    }
    add("curiosity", (0.45 + Math.min(0.25, cands.length * 0.05)) * skillBias("experiment"), pick, `test hypothesis: ${pick.replace("experiment:", "").replace("+", " + ")}`);
  }
  // Taught hypotheses awaiting verification.
  const taught = m.hypotheses.find((h) => h.status === "untested" && h.source !== "self");
  if (taught) {
    const pair = taught.action.split(":")[1]!;
    const need = planFor({ ...m, recipes: {} }, pair.split("+")[0]!, inv) ?? [];
    if (pair.split("+").every((p) => has(p))) add("verify", 0.6, taught.action, `verify ${taught.source}'s lesson`);
    else m.plan = [...new Set([...m.plan, ...need])];
  }

  // Progress — plan toward useful items.
  const wishes = desiredItems(m, inv);
  for (const w of wishes) {
    const recipe = Object.entries(m.recipes).find(([, res]) => res === w);
    if (recipe && recipe[0].split("+").every((p, i, arr) => (inv[p] ?? 0) >= arr.filter((q) => q === p).length)) {
      add("progress", 0.7, `experiment:${recipe[0]}`, `craft ${w}`);
      break;
    }
    const need = recipe ? planFor(m, w, inv) : (w === "tool" || w === "plank") ? ["wood", w === "tool" ? "stone" : "wood"] : null;
    if (need && need.length) {
      m.plan = need;
      const raw = need[0]!;
      const obj = m.sources[raw] ?? (raw === "wood" ? "tree" : raw);
      if (obj === "hunt") continue;
      if (here.obj === obj && here.charges > 0) add("progress", 0.55 * skillBias(raw), "gather", `gather ${raw} for ${w}`);
      else add("progress", 0.5 * skillBias(raw), go(near((_t, o, ready) => o === obj && ready), `${raw} for ${w}`), `fetch ${raw} for ${w}`);
      break;
    }
  }
  // Construction.
  if (has("shelter_kit") && !here.obj && !here.struct) add("build", 0.75 * skillBias("build"), "build:shelter_kit", "build a shelter");
  else if (has("shelter_kit")) add("build", 0.5, go(near((t, o, _r, st, key) => t === "grass" && !o && !st && !m.failures[`build with shelter_kit@${key}`]), "building site"), "find a building site");
  // Agriculture.
  if (has("seed")) {
    const tried = m.uses["seed"] || findRule(m, "plant on grass");
    if (here.terrain === "grass" && !here.obj && !here.struct) add("farm", (tried ? 0.6 : 0.45) * skillBias("plant"), "plant", "plant a seed");
    else add("farm", 0.35, go(near((t, o, _r, st) => t === "grass" && !o && !st), "farmland"), "find farmland");
  }
  // Hunting.
  const deer = obs.nearbyAnimals.find((n) => n.species === "deer" && Math.abs(n.dx) + Math.abs(n.dy) <= 1);
  if (deer && (has("spear") || hunger > 0.3 || !findRule(m, "hunt bare-handed"))) add("hunt", (has("spear") ? 0.65 : 0.4) * skillBias("hunt"), "hunt", "hunt deer");
  else if (has("spear") && hunger > 0.2) {
    const far = obs.nearbyAnimals.find((n) => n.species === "deer");
    if (far) add("hunt", 0.5, go({ x: obs.position.x + far.dx, y: obs.position.y + far.dy }, "stalk deer"), "stalk deer");
  }

  // Social — teaching, trade, gifts.
  if (obs.comms && obs.nearbyAgents.length) {
    const other = obs.nearbyAgents[0]!;
    const lesson = Object.entries(m.recipes).find(([pair, res]) => res !== "nothing" && !m.rules.find((x) => x.key === `combine ${pair.split("+").join(" + ")}`)?.shared);
    if (obs.sharing && lesson && r() < 0.7) {
      const rule = m.rules.find((x) => x.key === `combine ${lesson[0].split("+").join(" + ")}`);
      if (rule) rule.shared = true;
      add("social", 0.5 * skillBias("teach"), `teach:${lesson[0]}=${lesson[1]}`, `teach ${other.name} ${lesson[1]}`);
    }
    const need = m.plan[0];
    const surplus = Object.entries(inv).find(([k, n]) => n >= 3 && k !== need);
    if (need && surplus && (other.inventory[need] ?? 0) >= 2) add("social", 0.45 * skillBias("trade"), `trade:${other.id}:${surplus[0]}:${need}`, `trade ${surplus[0]} for ${need}`);
    else if ((inv["food"] ?? 0) > 2 && !other.inventory["food"]) add("social", 0.3, `give:${other.id}:food`, `share food with ${other.name}`);
  }

  // Exploration incentive — scales with unexplored territory and boredom.
  const fr = frontier(m, obs, r);
  add("explore", 0.3 + (fr ? 0.1 : 0), fr ? go(fr, "unexplored land") : `move:${"NSEW"[Math.floor(r() * 4)]}`, "explore");

  // Pick the highest utility with a little noise.
  for (const d of drives) d.score += r() * 0.08;
  drives.sort((x, y) => y.score - x.score);
  const best = drives[0] ?? { name: "rest", score: 0, action: "rest", why: "rest" };
  m.drives = Object.fromEntries(drives.slice(0, 6).map((d) => [d.name, +d.score.toFixed(2)]));
  a.goal = `${best.why} (${best.name})`;
  return best.action;
}

export type { Hypothesis };
