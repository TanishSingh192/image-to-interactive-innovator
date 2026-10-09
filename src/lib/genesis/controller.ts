import { supabase } from "@/integrations/supabase/client";
import {
  applyAction, generateWorld, observe, tickWorld,
  type WorldConfig, type WorldState,
} from "./world";
import { decide, learn, predict } from "./agent";

export interface StepRecord {
  step: number; agentId: string; agentName: string;
  action: string; predicted: string; confidence: number;
  actual: string; error: number; success: boolean;
}
export interface WorldEvent { step: number; kind: string; message: string }

type Listener = () => void;

/**
 * Client-side simulation controller. The engine state is authoritative and
 * lives here; Supabase is written through throttled snapshots + event and
 * experience rows so runs survive reloads and feed the research pages.
 */
export class SimController {
  state: WorldState;
  worldId: string | null = null;
  userId: string;
  playing = false;
  speed = 4; // steps per second
  recentSteps: StepRecord[] = [];
  events: WorldEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private pendingExperiences: Record<string, unknown>[] = [];
  private stepsSinceSave = 0;

  constructor(userId: string, config: WorldConfig, worldId?: string, saved?: WorldState) {
    this.userId = userId;
    this.worldId = worldId ?? null;
    this.state = saved ?? generateWorld(config);
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.timer = setInterval(() => this.step(), 1000 / this.speed);
    this.emit();
  }
  pause() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.flush();
    this.emit();
  }
  setSpeed(s: number) {
    this.speed = s;
    if (this.playing) { this.pause(); this.play(); }
  }

  step() {
    const s = this.state;
    for (const a of s.agents) {
      const obs = observe(s, a);
      const action = decide(s, a, obs, 0);
      const predicted = predict(a.mind, action, obs);
      const actual = applyAction(s, a, action);
      const { error, changed } = learn(s, a, action, obs, predicted, actual);
      const rec: StepRecord = {
        step: s.clock, agentId: a.id, agentName: a.name, action,
        predicted: predicted.text, confidence: predicted.confidence,
        actual: actual.changes.join("; "), error, success: actual.success,
      };
      this.recentSteps.push(rec);
      if (this.recentSteps.length > 300) this.recentSteps.shift();
      for (const e of actual.events) this.pushEvent(s.clock, "action", e);
      if (changed && changed.kind === "confirmed" && changed.evidence === 3)
        this.pushEvent(s.clock, "discovery", `${a.name} confirmed a rule: ${changed.text}`);
      this.pendingExperiences.push({
        world_id: this.worldId, agent_id: a.id, user_id: this.userId,
        step: s.clock, observation: { pos: obs.position, energy: obs.energy, inventory: obs.inventory, phase: obs.phase },
        action, predicted: { text: predicted.text, confidence: predicted.confidence },
        actual: { success: actual.success, changes: actual.changes },
        prediction_error: error,
      });
    }
    tickWorld(s);
    this.stepsSinceSave++;
    if (this.stepsSinceSave % 10 === 0) void this.flush();
    this.emit();
  }

  private pushEvent(step: number, kind: string, message: string) {
    this.events.push({ step, kind, message });
    if (this.events.length > 200) this.events.shift();
    if (this.worldId)
      void supabase.from("genesis_events").insert({ world_id: this.worldId, user_id: this.userId, step, kind, message });
  }

  /** Persist snapshot + buffered experiences + knowledge. */
  async flush() {
    if (!this.worldId) return;
    const s = this.state;
    await supabase.from("genesis_worlds").update({
      state: s as unknown as Record<string, unknown>,
      clock: s.clock,
      status: this.playing ? "running" : "paused",
      updated_at: new Date().toISOString(),
    }).eq("id", this.worldId);
    if (this.pendingExperiences.length) {
      const batch = this.pendingExperiences.splice(0, this.pendingExperiences.length);
      await supabase.from("genesis_experiences").insert(batch as never);
    }
    for (const a of s.agents) {
      for (const rule of a.mind.rules) {
        await supabase.from("genesis_knowledge").upsert({
          world_id: this.worldId, agent_id: a.id, user_id: this.userId,
          rule: rule.text, kind: rule.kind, confidence: rule.confidence,
          evidence: rule.evidence, shared: rule.shared, discovery_step: rule.step,
        }, { onConflict: "agent_id,rule" });
      }
      await supabase.from("genesis_agents").update({
        position: { x: a.x, y: a.y }, status: a.status, objective: a.goal, resources: a.inventory,
      }).eq("id", a.id);
    }
  }

  /** Create DB rows for a fresh world, then reset state. */
  async persistNewWorld(name: string) {
    const s = this.state;
    const { data: w, error } = await supabase.from("genesis_worlds").insert({
      user_id: this.userId, name, seed: s.config.seed,
      config: s.config as unknown as Record<string, unknown>,
      state: s as unknown as Record<string, unknown>, clock: 0,
    }).select().single();
    if (error || !w) throw error ?? new Error("world insert failed");
    this.worldId = w.id;
    await supabase.from("genesis_agents").insert(s.agents.map((a) => ({
      id: a.id, world_id: w.id, user_id: this.userId, name: a.name, color: a.color,
      model_config: { provider: "built-in baseline", model: "symbolic-heuristic-v1" },
      position: { x: a.x, y: a.y }, status: a.status, objective: a.goal, resources: a.inventory,
    })));
    return w.id;
  }

  async reset(config?: Partial<WorldConfig>) {
    this.pause();
    const cfg = { ...this.state.config, ...config };
    this.state = generateWorld(cfg);
    this.recentSteps = [];
    this.events = [];
    this.pendingExperiences = [];
    if (this.worldId) {
      await supabase.from("genesis_experiences").delete().eq("world_id", this.worldId);
      await supabase.from("genesis_knowledge").delete().eq("world_id", this.worldId);
      await supabase.from("genesis_events").delete().eq("world_id", this.worldId);
      await supabase.from("genesis_agents").delete().eq("world_id", this.worldId);
      await supabase.from("genesis_agents").insert(this.state.agents.map((a) => ({
        id: a.id, world_id: this.worldId, user_id: this.userId, name: a.name, color: a.color,
        model_config: { provider: "built-in baseline", model: "symbolic-heuristic-v1" },
        position: { x: a.x, y: a.y }, status: a.status, objective: a.goal, resources: a.inventory,
      })));
      await this.flush();
    }
    this.emit();
  }

  dispose() { this.pause(); this.listeners.clear(); }
}
