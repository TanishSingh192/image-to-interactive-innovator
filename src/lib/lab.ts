import { supabase } from "@/integrations/supabase/client";

export type AgentDef = {
  id: string;
  name: string;
  mode: "hosted" | "local";
  provider: string;
  model: string;
  skill: number; // simulator only
  latency: number; // ms mean
  costPer1k: number; // USD per 1k tokens
  color: string; // css var
};

export const AGENTS: AgentDef[] = [
  { id: "gpt", name: "GPT-5.5", mode: "hosted", provider: "OpenAI API", model: "openai/gpt-5.5", skill: 0.62, latency: 1800, costPer1k: 0.01, color: "var(--chart-1)" },
  { id: "claude", name: "Claude Sonnet 5", mode: "hosted", provider: "Anthropic API", model: "anthropic/claude-sonnet-5", skill: 0.58, latency: 1500, costPer1k: 0.009, color: "var(--chart-2)" },
  { id: "qwen", name: "Qwen-VL 32B", mode: "local", provider: "Ollama", model: "qwen2.5vl:32b", skill: 0.34, latency: 3200, costPer1k: 0, color: "var(--chart-3)" },
  { id: "llama", name: "Llama 4 Scout", mode: "local", provider: "Ollama", model: "llama4:scout", skill: 0.27, latency: 2600, costPer1k: 0, color: "var(--chart-4)" },
];

export const ENVIRONMENTS = [
  { id: "ls20", name: "LS20 · Locksmith" },
  { id: "ft09", name: "FT09 · Fill Tiles" },
  { id: "vc33", name: "VC33 · Vacuum" },
  { id: "sp80", name: "SP80 · Sprite Pusher" },
];

export const ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "ACTION5", "CLICK", "RESET"];

export const agentById = (id: string) => AGENTS.find((a) => a.id === id);
export const envName = (id: string) => ENVIRONMENTS.find((e) => e.id === id)?.name ?? id;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
const hash = (str: string) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export type Grid = number[][];

/** Simulated trajectory generator. Clearly labelled as simulated in the UI. */
export function simulateEpisode(agent: AgentDef, env: string, rep: number, seed: number, budget: number) {
  const r = rng(seed + hash(agent.id + env) + rep * 101);
  const size = 8;
  let grid: Grid = Array.from({ length: size }, () => Array.from({ length: size }, () => (r() < 0.25 ? Math.floor(r() * 9) + 1 : 0)));
  let pos = [Math.floor(r() * size), Math.floor(r() * size)];
  const difficulty = 0.3 + (Math.abs(hash(env)) % 40) / 100;
  const solved = r() < agent.skill * (1.1 - difficulty);
  const length = solved ? Math.max(6, Math.floor(budget * (0.25 + r() * 0.5 * (1 - agent.skill)))) : budget;
  const steps = [];
  let failures = 0, retries = 0, tokens = 0, duration = 0;
  for (let i = 0; i < length; i++) {
    const proposed = ACTIONS[Math.floor(r() * (ACTIONS.length - 1))];
    const valid = r() > 0.06 + (1 - agent.skill) * 0.08;
    const executed = valid ? proposed : "NOOP";
    let error: string | null = null;
    if (!valid) { failures++; error = "Invalid action: failed schema validation"; }
    if (r() < 0.02) { retries++; error = "Timeout — retried (1/3)"; }
    const [y, x] = pos;
    if (executed === "UP") pos = [Math.max(0, y - 1), x];
    if (executed === "DOWN") pos = [Math.min(size - 1, y + 1), x];
    if (executed === "LEFT") pos = [y, Math.max(0, x - 1)];
    if (executed === "RIGHT") pos = [y, Math.min(size - 1, x + 1)];
    grid = grid.map((row) => [...row]);
    if (executed === "CLICK" || executed === "ACTION5") grid[pos[0]][pos[1]] = (grid[pos[0]][pos[1]] + 1) % 10;
    const obs = grid.map((row) => [...row]);
    obs[pos[0]][pos[1]] = 4;
    const lat = Math.round(agent.latency * (0.6 + r() * 0.8));
    const tk = Math.round(900 + r() * 700);
    tokens += tk; duration += lat;
    steps.push({
      step_index: i,
      observation: obs,
      proposed_action: proposed,
      executed_action: executed,
      valid,
      latency_ms: lat,
      tokens: tk,
      state_change: i === length - 1 && solved ? "LEVEL_COMPLETE" : executed === "NOOP" ? "none" : "frame_update",
      error,
    });
  }
  const score = solved ? Math.round(100 * (1 - length / (budget * 1.4))) : 0;
  return {
    steps,
    summary: { solved, score: Math.max(score, 0), actions: length, tokens, duration_ms: duration, cost: +(tokens / 1000 * agent.costPer1k).toFixed(4), failures, retries },
  };
}

const cancelled = new Set<string>();
export const cancelExperiment = (id: string) => cancelled.add(id);

/** Runs an experiment in the background, writing progress as it goes. */
export async function executeExperiment(exp: {
  id: string; agents: string[]; environments: string[]; repetitions: number; seed: number; action_budget: number;
}) {
  await supabase.from("experiments").update({ status: "running", started_at: new Date().toISOString() }).eq("id", exp.id);
  for (const env of exp.environments) {
    for (let rep = 1; rep <= exp.repetitions; rep++) {
      for (const agentId of exp.agents) {
        if (cancelled.has(exp.id)) {
          await supabase.from("experiments").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", exp.id);
          return;
        }
        const agent = agentById(agentId)!;
        const { steps, summary } = simulateEpisode(agent, env, rep, exp.seed, exp.action_budget);
        const { data: run, error } = await supabase.from("runs")
          .insert({ experiment_id: exp.id, agent: agentId, environment: env, repetition: rep, status: "running" })
          .select().single();
        if (error || !run) {
          await supabase.from("experiments").update({ status: "failed" }).eq("id", exp.id);
          return;
        }
        const chunk = 10;
        for (let i = 0; i < steps.length; i += chunk) {
          const part = steps.slice(i, i + chunk);
          await supabase.from("steps").insert(part.map((s) => ({ ...s, run_id: run.id })));
          const acc = steps.slice(0, i + part.length);
          await supabase.from("runs").update({
            actions: acc.length,
            failures: acc.filter((s) => !s.valid).length,
            tokens: acc.reduce((a, s) => a + s.tokens, 0),
            duration_ms: acc.reduce((a, s) => a + s.latency_ms, 0),
          }).eq("id", run.id);
          await new Promise((res) => setTimeout(res, 250));
        }
        await supabase.from("runs").update({ ...summary, status: "completed" }).eq("id", run.id);
      }
    }
  }
  await supabase.from("experiments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", exp.id);
}

export function download(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
