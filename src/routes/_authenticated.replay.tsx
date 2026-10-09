import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Stat } from "@/components/PageHeader";
import { ExperimentPicker } from "@/components/ExperimentPicker";
import { ArcGrid } from "@/components/ArcGrid";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRuns, useSteps } from "@/lib/queries";
import { agentById, envName } from "@/lib/lab";

export const Route = createFileRoute("/_authenticated/replay")({
  validateSearch: (s: Record<string, unknown>) => ({
    run: typeof s["run"] === "string" ? s["run"] : undefined,
    exp: typeof s["exp"] === "string" ? s["exp"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Episode replay — AI Benchmarking Lab" },
      { name: "description", content: "Step through recorded observations, proposed and executed actions." },
      { property: "og:title", content: "Episode replay — AI Benchmarking Lab" },
      { property: "og:description", content: "Inspect agent trajectories step by step." },
    ],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const nav = useNavigate({ from: "/replay" });
  const { data: runMeta } = useQuery({
    queryKey: ["run", search.run], enabled: !!search.run,
    queryFn: async () => (await supabase.from("runs").select("*").eq("id", search.run!).single()).data,
  });
  const expId = search.exp ?? runMeta?.experiment_id;
  const { data: runs = [] } = useRuns(expId);
  const run = runs.find((r) => r.id === search.run) ?? runs[0];
  const { data: steps = [] } = useSteps(run?.id);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setI(0), [run?.id]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x + 1 >= steps.length ? (setPlaying(false), x) : x + 1)), 300);
    return () => clearInterval(t);
  }, [playing, steps.length]);
  const s = steps[i];

  return (
    <>
      <PageHeader section="§4 Replay" title="Episode replay">
        <div className="flex flex-wrap gap-2">
          <ExperimentPicker value={expId} onChange={(id) => nav({ search: { exp: id } })} />
          <Select value={run?.id} onValueChange={(id) => nav({ search: { exp: expId, run: id } })}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Episode" /></SelectTrigger>
            <SelectContent>{runs.map((r) => <SelectItem key={r.id} value={r.id}>{agentById(r.agent)?.name} · {r.environment.toUpperCase()} · rep {r.repetition}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </PageHeader>
      {!run ? <p className="font-serif italic">Choose an experiment to replay.</p> : !s ? <p className="eyebrow">Loading trace…</p> : (
        <>
          <div className="mb-6 flex flex-wrap gap-8">
            <Stat label="Agent" value={agentById(run.agent)?.name} />
            <Stat label="Environment" value={envName(run.environment)} />
            <Stat label="Outcome" value={run.solved ? `Solved · ${Number(run.score)}` : "Unsolved"} />
            <Stat label="Step" value={`${i + 1}/${steps.length}`} />
          </div>
          <div className="grid gap-10 lg:grid-cols-[auto_1fr]">
            <figure><ArcGrid grid={s.observation as number[][]} size={34} />
              <figcaption className="mt-2 font-serif text-sm italic text-muted-foreground">Observation at step {s.step_index}</figcaption></figure>
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 border border-border bg-card p-4 text-sm">
                <div><dt className="eyebrow">Proposed</dt><dd className="figure-num mt-1 text-lg">{s.proposed_action}</dd></div>
                <div><dt className="eyebrow">Executed</dt><dd className={`figure-num mt-1 text-lg ${s.valid ? "" : "text-destructive"}`}>{s.executed_action}</dd></div>
                <div><dt className="eyebrow">State change</dt><dd className="figure-num mt-1">{s.state_change}</dd></div>
                <div><dt className="eyebrow">Latency · tokens</dt><dd className="figure-num mt-1">{s.latency_ms}ms · {s.tokens}</dd></div>
                {s.error && <div className="col-span-2"><dt className="eyebrow">Error</dt><dd className="mt-1 text-destructive">{s.error}</dd></div>}
              </dl>
              <Slider value={[i]} max={steps.length - 1} step={1} onValueChange={([v]) => setI(v)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setI(Math.max(0, i - 1))}>Prev</Button>
                <Button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</Button>
                <Button variant="outline" onClick={() => setI(Math.min(steps.length - 1, i + 1))}>Next</Button>
              </div>
              <div className="flex flex-wrap gap-px">
                {steps.map((x, k) => (
                  <button key={x.id} title={`#${k} ${x.executed_action}`} onClick={() => setI(k)}
                    className={`h-4 w-2 ${k === i ? "bg-foreground" : x.error ? "bg-destructive" : x.state_change === "LEVEL_COMPLETE" ? "bg-success" : "bg-secondary"}`} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
