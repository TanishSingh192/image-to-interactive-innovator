import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExperiments(refetch?: number) {
  return useQuery({
    queryKey: ["experiments"],
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("experiments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRuns(experimentId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["runs", experimentId],
    enabled: !!experimentId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("runs").select("*").eq("experiment_id", experimentId!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useSteps(runId?: string, refetch?: number) {
  return useQuery({
    queryKey: ["steps", runId],
    enabled: !!runId,
    refetchInterval: refetch ?? false,
    queryFn: async () => {
      const { data, error } = await supabase.from("steps").select("*").eq("run_id", runId!).order("step_index");
      if (error) throw error;
      return data;
    },
  });
}
