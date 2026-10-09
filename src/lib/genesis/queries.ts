import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWorlds() {
  return useQuery({
    queryKey: ["genesis-worlds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_worlds").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useWorldAgents(worldId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["genesis-agents", worldId],
    enabled: !!worldId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_agents").select("*").eq("world_id", worldId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useKnowledge(worldId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["genesis-knowledge", worldId],
    enabled: !!worldId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_knowledge").select("*").eq("world_id", worldId!).order("discovery_step");
      if (error) throw error;
      return data;
    },
  });
}

export function useExperiences(worldId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["genesis-experiences", worldId],
    enabled: !!worldId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_experiences").select("*").eq("world_id", worldId!).order("step");
      if (error) throw error;
      return data;
    },
  });
}

export function useWorldEvents(worldId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["genesis-events", worldId],
    enabled: !!worldId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_events").select("*").eq("world_id", worldId!).order("step", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useGenesisExperiments() {
  return useQuery({
    queryKey: ["genesis-experiments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genesis_experiments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
