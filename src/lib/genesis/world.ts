import { mulberry32 } from "./rng";

/** Bump when the world state shape changes; older saved snapshots are regenerated. */
export const WORLD_VERSION = 2;

export type Terrain = "grass" | "forest" | "water" | "sand" | "rock";
export type ObjType = "tree" | "stone" | "berry" | "clay" | null;
export type Structure = "shelter" | "farm" | null;
export type Species = "deer" | "wolf";

export interface Tile {
  terrain: Terrain; obj: ObjType; charges: number; regrowAt: number;
  /** Grazing cover 0..1 (grass/forest only). */
  grass: number;
  struct: Structure; structOwner: string | null; ripeAt: number;
}
export interface Animal { id: string; species: Species; x: number; y: number; energy: number; age: number }
export interface Message { step: number; from: string; text: string }
export interface RuleState {
  key: string; text: string;
  kind: "hypothesis" | "confirmed" | "incorrect";
  confidence: number; evidence: number; step: number; shared: boolean;
  /** Who it came from: own experience, or the name of a teacher. */
  source?: string;
}
export interface Hypothesis {
  id: string; action: string; prediction: string; confidence: number;
  status: "untested" | "supported" | "refuted";
  step: number; result?: string; source: string;
}
export interface MindState {
  rules: RuleState[];
  visited: string[];
  /** Remembered map: tile key → last seen "terrain/obj". */
  seen: Record<string, string>;
  /** Failure memory: action@context → count and last step. */
  failures: Record<string, { count: number; last: number }>;
  /** Learned crafting results: sorted pair "a+b" → result item or "nothing". */
  recipes: Record<string, string>;
  /** Learned sources: item → object/action that yields it. */
  sources: Record<string, string>;
  /** Learned item uses (e.g. "tool" → "doubles gathering"). */
  uses: Record<string, string>;
  hypotheses: Hypothesis[];
  /** Activity counts → specialization. */
  skills: Record<string, number>;
  target: { x: number; y: number; why: string } | null;
  plan: string[];
  drives: Record<string, number>;
}
export interface AgentState {
  id: string; name: string; color: string;
  x: number; y: number; energy: number;
  inventory: Record<string, number>;
  goal: string; status: string;
  role: string;
  mind: MindState;
}
export interface WorldConfig {
  width: number; height: number; seed: number;
  agentCount: number; allowComms: boolean; allowSharing: boolean; dayLength: number;
  /** Optional ecosystem toggle (defaults on). */
  ecosystem?: boolean;
}
export interface WorldStats {
  gathered: number; crafted: number; exchanges: number; predictions: number; predictionErrors: number;
  hunted: number; planted: number; harvested: number; built: number; trades: number; taught: number;
  experiments: number; births: number; deaths: number; wolfAttacks: number;
}
export interface WorldState {
  version: number;
  config: WorldConfig; clock: number; tiles: Tile[][];
  agents: AgentState[]; animals: Animal[]; messages: Message[];
  /** Civilization tech tree: first creation of each item. */
  tech: Record<string, { by: string; step: number }>;
  stats: WorldStats;
}

export const DEFAULT_CONFIG: WorldConfig = {
  width: 26, height: 18, seed: 7, agentCount: 3,
  allowComms: true, allowSharing: true, dayLength: 40, ecosystem: true,
};

export const AGENT_NAMES = ["Ada", "Boru", "Cyra", "Dain", "Ela", "Fenn", "Gaia", "Hoku"];
export const AGENT_COLORS = ["#d4653a", "#5b8dd9", "#5fae6e", "#c9a227", "#a06fd6", "#4fb3a9", "#d66f9e", "#8a8f3c"];

/**
 * Hidden crafting table — the simulator's ground truth. Agents never read it;
 * they must combine materials and observe results. Key = sorted pair.
 */
const RECIPES: Record<string, string> = {
  "stone+wood": "tool",
  "tool+wood": "spear",
  "wood+wood": "plank",
  "clay+plank": "shelter_kit",
  "meat+wood": "cooked_meat",
  "food+stone": "seed",
};
const FOOD_VALUE: Record<string, number> = { food: 25, meat: 15, cooked_meat: 45 };

export const TRUE_RULES = [
  "gather on tree → +1 wood (+2 with tool); trees deplete and regrow after two days",
  "gather on stone → +1 stone (+2 with tool); gather on clay → +1 clay",
  "gather on berry bush → +1 food (sometimes +1 seed); bush regrows after one day",
  "combine stone + wood → tool (tool doubles wood/stone gathering)",
  "combine tool + wood → spear (spear makes hunting reliable)",
  "combine wood + wood → plank; plank + clay → shelter_kit",
  "combine meat + wood → cooked_meat; food + stone → seed (grinding)",
  "hunt deer on or next to your tile → +2 meat (80% with spear, 15% without)",
  "plant a seed on empty grass → farm that ripens into a berry bush after half a day",
  "build with shelter_kit → shelter; resting in a shelter doubles recovery and blocks wolves",
  "eat food +25, meat +15, cooked_meat +45 energy",
  "moving costs 1 energy (2 at night); water and rock block movement",
  "rest restores energy (+8 day, +14 night)",
  "deer graze and breed; wolves hunt deer and drain 6 energy from unsheltered agents at night",
  "trade:partner:give:get swaps one unit if the partner has surplus and wants the offer",
] as const;

const WALKABLE: Terrain[] = ["grass", "forest", "sand"];
export const isWalkable = (t: Tile | undefined) => !!t && WALKABLE.includes(t.terrain);

function mkTile(terrain: Terrain, obj: ObjType, charges: number): Tile {
  return { terrain, obj, charges, regrowAt: 0, grass: terrain === "grass" || terrain === "forest" ? 1 : 0, struct: null, structOwner: null, ripeAt: 0 };
}

export function emptyMind(x: number, y: number): MindState {
  return {
    rules: [], visited: [`${x},${y}`], seen: {}, failures: {}, recipes: {}, sources: {}, uses: {},
    hypotheses: [], skills: {}, target: null, plan: [], drives: {},
  };
}

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
      if (terrain === "forest" && o < 0.7) { obj = "tree"; charges = 6; }
      else if (terrain === "grass" && o < 0.12) { obj = "tree"; charges = 6; }
      else if (terrain === "grass" && o < 0.3) { obj = "berry"; charges = 2; }
      else if (terrain === "sand" && o < 0.25) { obj = "clay"; charges = 6; }
      else if ((terrain === "rock" || terrain === "sand") && o < 0.5) { obj = "stone"; charges = 8; }
      row.push(mkTile(terrain, obj, charges));
    }
    tiles.push(row);
  }
  const randWalkable = () => {
    let x = 0, y = 0, tries = 0;
    do {
      x = Math.floor(r() * config.width);
      y = Math.floor(r() * config.height);
      tries++;
    } while (tries < 300 && !isWalkable(tiles[y]![x]));
    return { x, y };
  };
  const agents: AgentState[] = [];
  for (let i = 0; i < config.agentCount; i++) {
    const { x, y } = randWalkable();
    agents.push({
      id: crypto.randomUUID(),
      name: AGENT_NAMES[i % AGENT_NAMES.length]!,
      color: AGENT_COLORS[i % AGENT_COLORS.length]!,
      x, y, energy: 100, inventory: {}, goal: "explore", status: "active", role: "generalist",
      mind: emptyMind(x, y),
    });
  }
  const animals: Animal[] = [];
  if (config.ecosystem !== false) {
    for (let i = 0; i < 8; i++) { const p = randWalkable(); animals.push({ id: `deer-${i}`, species: "deer", ...p, energy: 60, age: 0 }); }
    for (let i = 0; i < 2; i++) { const p = randWalkable(); animals.push({ id: `wolf-${i}`, species: "wolf", ...p, energy: 70, age: 0 }); }
  }
  return {
    version: WORLD_VERSION, config, clock: 0, tiles, agents, animals, messages: [], tech: {},
    stats: {
      gathered: 0, crafted: 0, exchanges: 0, predictions: 0, predictionErrors: 0,
      hunted: 0, planted: 0, harvested: 0, built: 0, trades: 0, taught: 0,
      experiments: 0, births: 0, deaths: 0, wolfAttacks: 0,
    },
  };
}

export const isNight = (s: WorldState) => (s.clock % s.config.dayLength) / s.config.dayLength >= 0.5;

/**
 * Agent-facing observation — the only input a policy receives.
 * Excludes ground-truth rules, the recipe table, and other agents' minds.
 */
export function observe(s: WorldState, a: AgentState) {
  const R = 2;
  const view: { dx: number; dy: number; terrain: Terrain; obj: ObjType; struct: Structure; ready: boolean }[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const t = s.tiles[a.y + dy]?.[a.x + dx];
      if (t) view.push({ dx, dy, terrain: t.terrain, obj: t.obj, struct: t.struct, ready: t.charges > 0 });
    }
  }
  const here = s.tiles[a.y]![a.x]!;
  return {
    clock: s.clock,
    phase: (isNight(s) ? "night" : "day") as "night" | "day",
    position: { x: a.x, y: a.y },
    energy: a.energy,
    inventory: { ...a.inventory },
    view,
    nearbyAgents: s.agents
      .filter((o) => o.id !== a.id && Math.abs(o.x - a.x) + Math.abs(o.y - a.y) <= 2)
      .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, role: o.role, inventory: { ...o.inventory } })),
    nearbyAnimals: s.animals
      .filter((n) => Math.abs(n.x - a.x) + Math.abs(n.y - a.y) <= 2)
      .map((n) => ({ species: n.species, dx: n.x - a.x, dy: n.y - a.y })),
    tile: { terrain: here.terrain, obj: here.obj, charges: here.charges, struct: here.struct },
    comms: s.config.allowComms,
    sharing: s.config.allowSharing,
  };
}
export type Observation = ReturnType<typeof observe>;

export interface Outcome { success: boolean; changes: string[]; events: string[] }

const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const inc = (inv: Record<string, number>, k: string, n = 1) => { inv[k] = (inv[k] ?? 0) + n; };
function recordTech(s: WorldState, item: string, by: string) {
  if (!s.tech[item]) s.tech[item] = { by, step: s.clock };
}

/** Context passed by the controller for decisions that belong to other agents. */
export interface ActionContext {
  acceptTrade?: (partner: AgentState, give: string, get: string) => boolean;
  rand?: () => number;
}

/** Applies a validated action. The environment is the source of truth. */
export function applyAction(s: WorldState, a: AgentState, action: string, ctx: ActionContext = {}): Outcome {
  const out: Outcome = { success: false, changes: [], events: [] };
  const night = isNight(s);
  const rand = ctx.rand ?? Math.random;
  const [verb, ...rest] = action.split(":");
  const here = s.tiles[a.y]![a.x]!;

  if (a.energy <= 0 && verb !== "rest" && verb !== "eat") {
    out.changes.push("exhausted — must rest or eat");
    return out;
  }
  const spend = (n: number) => { a.energy = Math.max(0, a.energy - n); out.changes.push(`energy -${n}`); };

  if (verb === "move") {
    const d = DIRS[rest[0] ?? ""];
    if (!d) { out.changes.push("invalid direction"); return out; }
    const nx = a.x + d[0], ny = a.y + d[1];
    const t = s.tiles[ny]?.[nx];
    spend(night ? 2 : 1);
    if (!isWalkable(t)) { out.changes.push(`blocked by ${t ? t.terrain : "world edge"}`); return out; }
    a.x = nx; a.y = ny;
    const key = `${nx},${ny}`;
    if (!a.mind.visited.includes(key)) a.mind.visited.push(key);
    out.success = true;
    out.changes.push(`position → ${nx},${ny}`);
    return out;
  }

  if (verb === "gather") {
    const hasTool = (a.inventory["tool"] ?? 0) > 0;
    spend(1);
    const t = here;
    if (t.charges <= 0 || !t.obj) { out.changes.push(t.obj ? "depleted — nothing to gather now" : "nothing to gather here"); return out; }
    if (t.obj === "tree" || t.obj === "stone" || t.obj === "clay") {
      const item = t.obj === "tree" ? "wood" : t.obj;
      const n = hasTool && t.obj !== "clay" ? 2 : 1;
      inc(a.inventory, item, n);
      t.charges--;
      if (t.charges === 0) t.regrowAt = s.clock + s.config.dayLength * (t.obj === "tree" ? 2 : 3);
      s.stats.gathered += n;
      out.success = true;
      out.changes.push(`${item} +${n}${n === 2 ? " (tool)" : ""}`);
      out.events.push(`${a.name} gathered ${n} ${item}`);
      return out;
    }
    if (t.obj === "berry") {
      t.charges--;
      if (t.charges === 0) t.regrowAt = s.clock + s.config.dayLength;
      inc(a.inventory, "food");
      s.stats.gathered++;
      out.success = true;
      out.changes.push("food +1");
      if (rand() < 0.3) { inc(a.inventory, "seed"); out.changes.push("seed +1"); }
      if (t.struct === "farm") { s.stats.harvested++; out.events.push(`${a.name} harvested a farm`); }
      return out;
    }
  }

  if (verb === "experiment" || verb === "craft") {
    const [i1, i2] = (rest[0] ?? "").split("+");
    if (!i1 || !i2) { out.changes.push("invalid combination"); return out; }
    const need: Record<string, number> = {};
    need[i1] = (need[i1] ?? 0) + 1; need[i2] = (need[i2] ?? 0) + 1;
    if (Object.entries(need).some(([k, n]) => (a.inventory[k] ?? 0) < n)) { out.changes.push("missing materials"); return out; }
    for (const [k, n] of Object.entries(need)) a.inventory[k]! -= n;
    spend(2);
    s.stats.experiments++;
    const pair = [i1, i2].sort().join("+");
    const result = RECIPES[pair];
    out.changes.push(`${i1} -1`, `${i2} -1`);
    if (result) {
      inc(a.inventory, result);
      s.stats.crafted++;
      out.success = true;
      out.changes.push(`${result} +1`);
      if (!s.tech[result]) out.events.push(`${a.name} invented ${result} (${pair})`);
      recordTech(s, result, a.name);
    } else {
      out.changes.push("nothing happens");
    }
    return out;
  }

  if (verb === "hunt") {
    spend(3);
    const prey = s.animals.find((n) => n.species === "deer" && Math.abs(n.x - a.x) + Math.abs(n.y - a.y) <= 1);
    if (!prey) { out.changes.push("no prey within reach"); return out; }
    const p = (a.inventory["spear"] ?? 0) > 0 ? 0.8 : 0.15;
    if (rand() < p) {
      s.animals = s.animals.filter((n) => n.id !== prey.id);
      inc(a.inventory, "meat", 2);
      s.stats.hunted++; s.stats.deaths++;
      out.success = true;
      out.changes.push("meat +2");
      out.events.push(`${a.name} hunted a deer${p > 0.5 ? " with a spear" : ""}`);
    } else {
      out.changes.push("prey escaped");
    }
    return out;
  }

  if (verb === "plant") {
    if ((a.inventory["seed"] ?? 0) < 1) { out.changes.push("no seed"); return out; }
    spend(1);
    if (here.terrain !== "grass" || here.obj || here.struct) { out.changes.push("ground not suitable"); return out; }
    a.inventory["seed"]!--;
    here.struct = "farm"; here.structOwner = a.name; here.ripeAt = s.clock + Math.round(s.config.dayLength / 2);
    s.stats.planted++;
    recordTech(s, "agriculture", a.name);
    out.success = true;
    out.changes.push("seed -1", "farm planted");
    out.events.push(`${a.name} planted a farm`);
    return out;
  }

  if (verb === "build") {
    const item = rest[0] ?? "";
    if ((a.inventory[item] ?? 0) < 1) { out.changes.push(`no ${item || "item"}`); return out; }
    spend(3);
    if (item !== "shelter_kit") { out.changes.push(`${item} cannot be built into anything`); return out; }
    if (here.struct || here.obj) { out.changes.push("tile occupied"); return out; }
    a.inventory[item]!--;
    here.struct = "shelter"; here.structOwner = a.name;
    s.stats.built++;
    recordTech(s, "shelter", a.name);
    out.success = true;
    out.changes.push(`${item} -1`, "shelter built");
    out.events.push(`${a.name} built a shelter`);
    return out;
  }

  if (verb === "eat") {
    const item = rest[0] ?? (["cooked_meat", "food", "meat"].find((k) => (a.inventory[k] ?? 0) > 0) ?? "food");
    if ((a.inventory[item] ?? 0) < 1) { out.changes.push(`no ${item}`); return out; }
    const v = FOOD_VALUE[item];
    if (!v) { out.changes.push(`${item} is not edible`); return out; }
    a.inventory[item]!--;
    a.energy = Math.min(100, a.energy + v);
    out.success = true;
    out.changes.push(`${item} -1`, `energy +${v}`);
    return out;
  }

  if (verb === "rest") {
    const sheltered = here.struct === "shelter";
    const gain = (night ? 14 : 8) * (sheltered ? 2 : 1);
    a.energy = Math.min(100, a.energy + gain);
    out.success = true;
    out.changes.push(`energy +${gain}${sheltered ? " (shelter)" : ""}`);
    return out;
  }

  if ((verb === "give" || verb === "trade" || verb === "say" || verb === "teach") && !s.config.allowComms) {
    out.changes.push("communication disabled");
    return out;
  }

  if (verb === "give") {
    const [targetId, res] = rest;
    const target = s.agents.find((o) => o.id === targetId);
    if (!target || Math.abs(target.x - a.x) + Math.abs(target.y - a.y) > 2) { out.changes.push("no such agent nearby"); return out; }
    if ((a.inventory[res ?? ""] ?? 0) < 1) { out.changes.push(`no ${res} to give`); return out; }
    a.inventory[res!]!--;
    inc(target.inventory, res!);
    s.stats.exchanges++;
    out.success = true;
    out.changes.push(`${res} -1`, `${target.name} received ${res}`);
    out.events.push(`${a.name} gave 1 ${res} to ${target.name}`);
    return out;
  }

  if (verb === "trade") {
    const [targetId, give, get] = rest;
    const target = s.agents.find((o) => o.id === targetId);
    if (!target || !give || !get || Math.abs(target.x - a.x) + Math.abs(target.y - a.y) > 2) { out.changes.push("no trade partner nearby"); return out; }
    if ((a.inventory[give] ?? 0) < 1 || (target.inventory[get] ?? 0) < 1) { out.changes.push("goods unavailable"); return out; }
    if (ctx.acceptTrade && !ctx.acceptTrade(target, give, get)) { out.changes.push(`${target.name} declined`); return out; }
    a.inventory[give]!--; inc(target.inventory, give);
    target.inventory[get]!--; inc(a.inventory, get);
    s.stats.trades++; s.stats.exchanges++;
    recordTech(s, "trade", a.name);
    out.success = true;
    out.changes.push(`${give} -1`, `${get} +1`);
    out.events.push(`${a.name} traded ${give} for ${target.name}'s ${get}`);
    return out;
  }

  if (verb === "say" || verb === "teach") {
    const text = rest.join(":").slice(0, 120);
    s.messages.push({ step: s.clock, from: a.name, text: verb === "teach" ? `teaches: ${text}` : text });
    if (s.messages.length > 200) s.messages.shift();
    if (verb === "teach") s.stats.taught++;
    out.success = true;
    out.changes.push(verb === "teach" ? "lesson shared with nearby agents" : "message broadcast to nearby agents");
    return out;
  }

  out.changes.push("unknown action");
  return out;
}

function stepAnimals(s: WorldState, rand: () => number) {
  const night = isNight(s);
  const born: Animal[] = [];
  const deerCount = s.animals.filter((n) => n.species === "deer").length;
  const wolfCount = s.animals.length - deerCount;
  for (const n of s.animals) {
    n.age++;
    n.energy -= n.species === "deer" ? 1 : 1.2;
    const t = s.tiles[n.y]![n.x]!;
    if (n.species === "deer") {
      if (t.grass > 0.3) { t.grass -= 0.3; n.energy = Math.min(100, n.energy + 6); }
      if (n.energy > 70 && n.age > 30 && deerCount + born.length < 24 && rand() < 0.05) {
        n.energy -= 30; born.push({ id: `deer-${s.clock}-${born.length}`, species: "deer", x: n.x, y: n.y, energy: 40, age: 0 });
      }
    } else {
      const prey = s.animals.find((d) => d.species === "deer" && Math.abs(d.x - n.x) + Math.abs(d.y - n.y) <= 1 && d.energy > 0);
      if (prey && rand() < 0.35) { prey.energy = -999; n.energy = Math.min(100, n.energy + 45); s.stats.deaths++; }
      if (night) {
        const victim = s.agents.find((a) => Math.abs(a.x - n.x) + Math.abs(a.y - n.y) <= 1 && s.tiles[a.y]![a.x]!.struct !== "shelter");
        if (victim && rand() < 0.25) { victim.energy = Math.max(0, victim.energy - 6); s.stats.wolfAttacks++; }
      }
      if (n.energy > 80 && n.age > 60 && wolfCount + born.filter((b) => b.species === "wolf").length < 5 && rand() < 0.02) {
        n.energy -= 40; born.push({ id: `wolf-${s.clock}-${born.length}`, species: "wolf", x: n.x, y: n.y, energy: 40, age: 0 });
      }
    }
    // Move: deer seek grass, wolves seek deer, both with noise.
    const opts = Object.values(DIRS).filter(([dx, dy]) => isWalkable(s.tiles[n.y + dy]?.[n.x + dx]));
    if (opts.length && rand() < 0.7) {
      let pick = opts[Math.floor(rand() * opts.length)]!;
      if (n.species === "deer") {
        pick = opts.reduce((b, o) => ((s.tiles[n.y + o[1]]![n.x + o[0]]!.grass > s.tiles[n.y + b[1]]![n.x + b[0]]!.grass) && rand() < 0.6 ? o : b), pick);
      } else {
        const target = s.animals.find((d) => d.species === "deer" && Math.abs(d.x - n.x) + Math.abs(d.y - n.y) <= 4);
        if (target) {
          const best = opts.reduce((b, o) => (Math.abs(target.x - n.x - o[0]) + Math.abs(target.y - n.y - o[1]) < Math.abs(target.x - n.x - b[0]) + Math.abs(target.y - n.y - b[1]) ? o : b), pick);
          if (rand() < 0.7) pick = best;
        }
      }
      n.x += pick[0]; n.y += pick[1];
    }
  }
  const before = s.animals.length;
  s.animals = s.animals.filter((n) => n.energy > 0 && n.age < (n.species === "deer" ? 600 : 800));
  s.stats.deaths += Math.max(0, before - s.animals.length - 0);
  if (born.length) { s.animals.push(...born); s.stats.births += born.length; }
}

/** World tick: renewal, farms, ecosystem, exhaustion status. */
export function tickWorld(s: WorldState, rand: () => number = Math.random) {
  s.clock++;
  for (const row of s.tiles) {
    for (const t of row) {
      if (t.obj && t.charges === 0 && s.clock >= t.regrowAt) t.charges = t.obj === "berry" ? 2 : t.obj === "tree" ? 6 : t.obj === "clay" ? 6 : 8;
      if ((t.terrain === "grass" || t.terrain === "forest") && t.grass < 1) t.grass = Math.min(1, t.grass + 0.02);
      if (t.struct === "farm" && !t.obj && s.clock >= t.ripeAt) { t.obj = "berry"; t.charges = 3; t.regrowAt = 0; }
    }
  }
  if (s.config.ecosystem !== false) stepAnimals(s, rand);
  for (const a of s.agents) a.status = a.energy <= 0 ? "exhausted" : "active";
}

export const coverage = (s: WorldState, a: AgentState) =>
  a.mind.visited.length / (s.config.width * s.config.height);

/** Count of distinct technologies the civilization has produced. */
export const techLevel = (s: WorldState) => Object.keys(s.tech).length;
