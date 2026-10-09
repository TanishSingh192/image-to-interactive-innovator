import { supabase } from "@/integrations/supabase/client";
import { SimController } from "./controller";
import { DEFAULT_CONFIG, WORLD_VERSION, type WorldState } from "./world";

/** Module-level singleton so the simulation keeps running across page navigation. */
let current: SimController | null = null;
let loading: Promise<SimController> | null = null;

export function getController() { return current; }

export async function loadController(userId: string): Promise<SimController> {
  if (current) return current;
  if (loading) return loading;
  loading = (async () => {
    const { data } = await supabase.from("genesis_worlds").select("*")
      .order("created_at", { ascending: false }).limit(1);
    const w = data?.[0];
    if (w && w.state && (w.state as Record<string, unknown>)["version"] === WORLD_VERSION) {
      current = new SimController(userId, DEFAULT_CONFIG, w.id, w.state as unknown as WorldState);
    } else {
      current = new SimController(userId, DEFAULT_CONFIG);
      await current.persistNewWorld("Genesis I");
    }
    loading = null;
    return current;
  })();
  return loading;
}

export async function newWorld(userId: string, seed: number, agentCount: number) {
  current?.dispose();
  current = new SimController(userId, { ...DEFAULT_CONFIG, seed, agentCount });
  await current.persistNewWorld(`Genesis (seed ${seed})`);
  return current;
}
