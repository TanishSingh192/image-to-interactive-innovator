import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ExperimentPicker } from "@/components/ExperimentPicker";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useExperiments, useRuns } from "@/lib/queries";
import { AGENTS, download, toCSV } from "@/lib/lab";

export const Route = createFileRoute("/_authenticated/export")({
  validateSearch: (s: Record<string, unknown>) => ({ exp: typeof s.exp === "string" ? s.exp : undefined }),
  head: () => ({
    meta: [
      { title: "Research export — AI Benchmarking Lab" },
      { name: "description", content: "Export runs as CSV, traces as JSONL and experiment manifests as JSON." },
      { property: "og:title", content: "Research export — AI Benchmarking Lab" },
      { property: "og:description", content: "Research-ready data exports with provenance." },
    ],
  }),
  component: Page,
});

const METRICS = {
  score: "Mean per-episode score, 0–100 (simulated; not an official ARC-AGI-3 scorecard).",
  success: "Share of episodes reaching LEVEL_COMPLETE within the action budget.",
  actions_per_solve: "Mean executed actions across solved episodes only.",
  invalid_rate: "Actions failing schema validation ÷ all actions.",
};

function Page() {
  const { exp } = Route.useSearch();
  const nav = useNavigate({ from: "/export" });
  const { data: exps = [] } = useExperiments();
  const current = exps.find((e) => e.id === exp) ?? exps[0];
  const { data: runs = [] } = useRuns(current?.id);
  const [busy, setBusy] = useState(false);
  const slug = current?.name.toLowerCase().replace(/\W+/g, "-") ?? "experiment";

  const manifest = () => ({
    experiment: current,
    agents: AGENTS.filter((a) => current?.agents.includes(a.id)).map(({ skill: _s, color: _c, ...a }) => a),
    benchmark: { name: "ARC-AGI-3", environment_adapter: "simulated", official: false },
    metric_definitions: METRICS,
    exported_at: new Date().toISOString(),
  });

  async function traces() {
    setBusy(true);
    const { data, error } = await supabase.from("steps").select("*").in("run_id", runs.map((r) => r.id)).order("step_index");
    setBusy(false);
    if (error) return toast.error(error.message);
    download(`${slug}-traces.jsonl`, (data ?? []).map((d) => JSON.stringify(d)).join("\n"), "application/x-ndjson");
  }

  const items = [
    { t: "Per-run results", f: "CSV", d: "One row per episode: agent, environment, score, actions, latency, cost, failures.", go: () => download(`${slug}-runs.csv`, toCSV(runs), "text/csv") },
    { t: "Per-run results", f: "JSONL", d: "Same as above, line-delimited JSON.", go: () => download(`${slug}-runs.jsonl`, runs.map((r) => JSON.stringify(r)).join("\n")) },
    { t: "Step traces", f: "JSONL", d: "Every observation, proposed and executed action, latency and error.", go: traces },
    { t: "Experiment manifest", f: "JSON", d: "Full configuration, agent versions, benchmark info and metric definitions.", go: () => download(`${slug}-manifest.json`, JSON.stringify(manifest(), null, 2)) },
  ];

  return (
    <>
      <PageHeader section="§5 Export" title="Research export">
        <ExperimentPicker value={current?.id} onChange={(id) => nav({ search: { exp: id } })} />
      </PageHeader>
      {!current ? <p className="font-serif italic">No experiments yet.</p> : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((it) => (
              <div key={it.t + it.f} className="flex flex-col border border-border bg-card p-5">
                <p className="eyebrow">{it.f}</p>
                <h3 className="mt-1 text-lg">{it.t}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{it.d}</p>
                <Button variant="outline" className="mt-4 self-start" disabled={!runs.length || busy} onClick={it.go}>Download</Button>
              </div>
            ))}
          </div>
          <h2 className="mt-10 mb-3 text-xl">Metric definitions</h2>
          <dl className="space-y-2 text-sm">
            {Object.entries(METRICS).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[160px_1fr] border-b border-border pb-2"><dt className="figure-num">{k}</dt><dd className="text-muted-foreground">{v}</dd></div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}
