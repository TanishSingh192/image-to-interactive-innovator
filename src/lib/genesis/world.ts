import { mulberry32 } from "./rng";

export type Terrain = "grass" | "forest" | "water" | "sand" | "rock";
export type ObjType = "tree" | "stone" | "berry" | null;

export interface Tile { terrain: Terrain; obj: ObjType; charges: number; regrowAt: number }
export interface Message { step: number; from: string; text: string }
export interface RuleState {
  key: string; text: string;
  kind: "hypothesis" | "confirmed" | "incorrect";
  confidence: number; evidence: number; step: number; shared: boolean;
}
export interface MindState { rules: RuleState[]; visited: string[]; }
export interface AgentState {
  id: string; name: string; color: string;
  x: number; y: number; energy: number;
  inventory: Record<string, number>;
  goal: string; status: string;
  mind: MindState;
}
export interface WorldConfig {
  width: number; height: number; seed: number;
  agentCount: number; allowComms: boolean; allowSharing: boolean; dayLength: number;
}
export interface WorldState {
  config: WorldConfig; clock: number; tiles: Tile[][];
  agents: AgentState[]; messages: Message[];
  stats: { gathered: number; crafted: number; exchanges: number; predictions: number; predictionErrors: number };
}

export const DEFAULT_CONFIG: WorldConfig = {
  width: 26, height: 18, seed: 7, agentCount: 3,
  allowComms: true, allowSharing: true, dayLength: 40,
};

export const AGENT_NAMES = ["Ada", "Boru", "Cyra", "Dain", "Ela", "Fenn", "Gaia", "Hoku"];
export const AGENT_COLORS = ["#d4653a", "#5b8dd9", "#5fae6e", "#c9a227", "#a06fd6", "#4fb3a9", "#d66f9e", "#8a8f3c"];

/**
 * The simulator's ground truth. NEVER included in agent observations —
 * agents must discover these through interaction. Shown in the research UI
 * labelled as hidden ground truth.
 */
export const TRUE_RULES = [
  "gather on tree → +1 wood (+2 with tool)",
  "gather on stone → +1 stone (+2 with tool)",
  "gather on berry bush → +1 food; bush depletes and regrows after one day",
  "experiment wood + stone → tool (the hidden crafting recipe)",
  "tool doubles gather yield",
  "eat food → +25 energy",
  "moving costs 1 energy (2 at night); water and rock block movement",
  "rest restores energy (+8 day, +14 night)",
] as const;

const WALKABLE: Terrain[] = ["grass", "forest", "sand"];

export function generateWorld(config: WorldConfig): WorldState {
  const r = mulberry32(config.seed);
  const tiles: Tile[][] = [];
  for (let y = 0; y < config.height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < config.width; x++) {
      const n = r();
      let terrain: Terrain = "grass";
      if (n < 0.12) terrain = "water";
      else if (n < 0.3) terrain = "forest";
      else if (n < 0.38) terrain = "rock";
      else if (n < 0.46) terrain = "sand";
      let obj: ObjType = null;
      let charges = 0;
      const o = r();
      if (terrain === "forest" && o < 0.7) { obj = "tree"; charges = 99; }
      else if (terrain === "grass" && o < 0.12) { obj = "tree"; charges = 99; }
      else if (terrain === "grass" && o < 0.3) { obj = "berry"; charges = 2; }
      else if ((terrain === "rock" || terrain === "sand") && o < 0.5) { obj = "stone"; charges = 99; }
      row.push({ terrain, obj, charges, regrowAt: 0 });
    }
    tiles.push(row);
  }
  const agents: AgentState[] = [];
  for (let i = 0; i < config.agentCount; i++) {
    let x = 0, y = 0, tries = 0;
    do {
      x = Math.floor(r() * config.width);
      y = Math.floor(r() * config.height);
      tries++;
    } while (tries < 200 && !WALKABLE.includes(tiles[y]![x]!.terrain));
    agents.push({
      id: `agent-${i + 1}`,
      name: AGENT_NAMES[i % AGENT_NAMES.length]!,
      color: AGENT_COLORS[i % AGENT_COLORS.length]!,
      x, y, energy: 100,
      inventory: {},
      goal: "explore",
      status: "active",
      mind: { rules: [], visited: [`${x},${y}`] },
    });
  }
  return {
    config, clock: 0, tiles, agents, messages: [],
    stats: { gathered: 0, crafted: 0, exchanges: 0, predictions: 0, predictionErrors: 0 },
  };
}

export const isNight = (s: WorldState) => (s.clock % s.config.dayLength) / s.config.dayLength >= 0.5;

/** Agent-facing observation. Excludes ground-truth rules and other agents' minds. */
export function observe(s: WorldState, a: AgentState) {
  const R = 2;
  const view: { dx: number; dy: number; terrain: Terrain; obj: ObjType }[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const t = s.tiles[a.y + dy]?.[a.x + dx];
      if (t) view.push({ dx, dy, terrain: t.terrain, obj: t.obj });
    }
  }
  return {
    clock: s.clock,
    phase: isNight(s) ? "night" : "day",
    position: { x: a.x, y: a.y },
    energy: a.energy,
    inventory: { ...a.inventory },
    view,
    nearbyAgents: s.agents
      .filter((o) => o.id !== a.id && Math.abs(o.x - a.x) + Math.abs(o.y - a.y) <= 2)
      .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y })),
    tile: s.tiles[a.y]![a.x]!,
  };
}
export type Observation = ReturnType<typeof observe>;

export interface Outcome { success: boolean; changes: string[]; events: string[] }

const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Applies a validated action. The environment is the source of truth. */
export function applyAction(s: WorldState, a: AgentState, action: string): Outcome {
  const out: Outcome = { success: false, changes: [], events: [] };
  const night = isNight(s);
  const [verb, ...rest] = action.split(":");

  if (a.energy <= 0 && verb !== "rest" && verb !== "eat") {
    out.changes.push("exhausted — must rest or eat");
    return out;
  }

  if (verb === "move") {
    const d = DIRS[rest[0] ?? ""];
    if (!d) { out.changes.push("invalid direction"); return out; }
    const nx = a.x + d[0], ny = a.y + d[1];
    const t = s.tiles[ny]?.[nx];
    const cost = night ? 2 : 1;
    a.energy = Math.max(0, a.energy - cost);
    out.changes.push(`energy -${cost}`);
    if (!t || !WALKABLE.includes(t.terrain)) {
      out.changes.push(`blocked by ${t ? t.terrain : "world edge"}`);
      return out;
    }
    a.x = nx; a.y = ny;
    const key = `${nx},${ny}`;
    if (!a.mind.visited.includes(key)) a.mind.visited.push(key);
    out.success = true;
    out.changes.push(`position → ${nx},${ny}`);
    return out;
  }

  if (verb === "gather") {
    const t = s.tiles[a.y]![a.x]!;
    const hasTool = (a.inventory["tool"] ?? 0) > 0;
    const yieldN = hasTool ? 2 : 1;
    if (t.obj === "tree") {
      a.inventory["wood"] = (a.inventory["wood"] ?? 0) + yieldN;
      s.stats.gathered += yieldN;
      out.success = true;
      out.changes.push(`wood +${yieldN}${hasTool ? " (tool)" : ""}`);
      out.events.push(`${a.name} gathered ${yieldN} wood from a tree`);
    } else if (t.obj === "stone") {
      a.inventory["stone"] = (a.inventory["stone"] ?? 0) + yieldN;
      s.stats.gathered += yieldN;
      out.success = true;
      out.changes.push(`stone +${yieldN}${hasTool ? " (tool)" : ""}`);
      out.events.push(`${a.name} gathered ${yieldN} stone`);
    } else if (t.obj === "berry" && t.charges > 0) {
      t.charges--;
      if (t.charges === 0) t.regrowAt = s.clock + s.config.dayLength;
      a.inventory["food"] = (a.inventory["food"] ?? 0) + 1;
      s.stats.gathered += 1;
      out.success = true;
      out.changes.push("food +1", t.charges === 0 ? "bush depleted" : "bush has berries left");
      out.events.push(`${a.name} picked berries`);
    } else {
      out.changes.push(t.obj ? "nothing to gather here right now" : "nothing to gather on this tile");
    }
    a.energy = Math.max(0, a.energy - 1);
    out.changes.push("energy -1");
    return out;
  }

  if (verb === "experiment" || verb === "craft") {
    const [i1, i2] = (rest[0] ?? "").split("+");
    if (!i1 || !i2 || (a.inventory[i1] ?? 0) < 1 || (a.inventory[i2] ?? 0) < 1) {
      out.changes.push("missing materials");
      return out;
    }
    a.inventory[i1]!--; a.inventory[i2]!--;
    const pair = [i1, i2].sort().join("+");
    if (pair === "stone+wood") {
      a.inventory["tool"] = (a.inventory["tool"] ?? 0) + 1;
      s.stats.crafted++;
      out.success = true;
      out.changes.push(`${i1} -1`, `${i2} -1`, "tool +1");
      out.events.push(`${a.name} discovered: wood + stone → tool`);
    } else {
      out.changes.push(`${i1} -1`, `${i2} -1`, "nothing happens");
      out.events.push(`${a.name} experimented with ${i1} + ${i2} — nothing happened`);
    }
    a.energy = Math.max(0, a.energy - 2);
    out.changes.push("energy -2");
    return out;
  }

  if (verb === "eat") {
    if ((a.inventory["food"] ?? 0) < 1) { out.changes.push("no food"); return out; }
    a.inventory["food"]!--;
    a.energy = Math.min(100, a.energy + 25);
    out.success = true;
    out.changes.push("food -1", "energy +25");
    return out;
  }

  if (verb === "rest") {
    const gain = night ? 14 : 8;
    a.energy = Math.min(100, a.energy + gain);
    out.success = true;
    out.changes.push(`energy +${gain}`);
    return out;
  }

  if (verb === "give" && s.config.allowComms) {
    const [targetId, res] = rest;
    const target = s.agents.find((o) => o.id === targetId);
    if (!target || Math.abs(target.x - a.x) + Math.abs(target.y - a.y) > 2) {
      out.changes.push("no such agent nearby"); return out;
    }
    if ((a.inventory[res ?? ""] ?? 0) < 1) { out.changes.push(`no ${res} to give`); return out; }
    a.inventory[res!]!--;
    target.inventory[res!] = (target.inventory[res!] ?? 0) + 1;
    s.stats.exchanges++;
    out.success = true;
    out.changes.push(`${res} -1`, `${target.name} received ${res}`);
    out.events.push(`${a.name} gave 1 ${res} to ${target.name}`);
    return out;
  }

  if (verb === "say" && s.config.allowComms) {
    const text = rest.join(":").slice(0, 120);
    s.messages.push({ step: s.clock, from: a.name, text });
    if (s.messages.length > 200) s.messages.shift();
    out.success = true;
    out.changes.push("message broadcast to nearby agents");
    return out;
  }

  out.changes.push("unknown action");
  return out;
}

/** World tick: berry regrowth, exhaustion status. */
export function tickWorld(s: WorldState) {
  s.clock++;
  for (const row of s.tiles)
    for (const t of row)
      if (t.obj === "berry" && t.charges === 0 && s.clock >= t.regrowAt) t.charges = 2;
  for (const a of s.agents) a.status = a.energy <= 0 ? "exhausted" : "active";
}

export const coverage = (s: WorldState, a: AgentState) =>
  a.mind.visited.length / (s.config.width * s.config.height);
