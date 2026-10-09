import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, Stat, StatusBadge } from "@/components/PageHeader";
import { ExperimentPicker } from "@/components/ExperimentPicker";
import { ArcGrid } from "@/components/ArcGrid";
import { Button } from "@/components/ui/button";
import { useExperiments, useRuns, useSteps } from "@/lib/queries";
import { agentById, cancelExperiment, envName } from "@/lib/lab";

export const Route = createFileRoute("/_authenticated/live")({
  validateSearch: (s: Record<string, unknown>) => ({ exp: typeof s.exp === "string" ? s.exp : undefined }),
  head: () => ({
    meta: [
      { title: "Live runs — AI Benchmarking Lab" },
      { name: "description", content: "Monitor running experiments: actions, latest observation, failures and retries." },
      { property: "og:title", content: "Live runs — AI Benchmarking Lab" },
      { property: "og:description", content: "Watch agents act in real time." },
    ],
  }),
  component: Page,
});

function Page() {
  const { exp } = Route.useSearch();
  const nav = useNavigate({ from: "/live" });
  const { data: exps = [] } = useExperiments(2000);
  const current = exps.find((e) => e.id === exp) ?? exps.find((e) => e.status === "running");
  const { data: runs = [] } = useRuns(current?.id, 1000);
  const active = runs.find((r) => r.status === "running") ?? runs[runs.length - 1];
  const { data: steps = [] } = useSteps(active?.id, 1000);
  const last = steps[steps.length - 1];
  const elapsed = current?.started_at ? Math.round(((current.completed_at ? new Date(current.completed_at) : new Date()).getTime() - new Date(current.started_at).getTime()) / 1000) : 0;

  return (
    <>
      <PageHeader section="§2 Live" title="Live runs">
        <div className="flex gap-2">
          <ExperimentPicker value={current?.id} onChange={(id) => nav({ search: { exp: id } })} />
          {current?.status === "running" && <Button variant="outline" onClick={() => cancelExperiment(current.id)}>Cancel</Button>}
        </div>
      </PageHeader>
      {!current ? <p className="font-serif italic">Nothing running. Launch an experiment from Setup.</p> : (
        <>
          <div className="mb-8 flex flex-wrap items-center gap-8">
            <StatusBadge status={current.status} />
            <Stat label="Active agent" value={active ? agentById(active.agent)?.name : "—"} />
            <Stat label="Environment" value={active ? envName(active.environment) : "—"} />
            <Stat label="Actions" value={`${active?.actions ?? 0}/${current.action_budget}`} />
            <Stat label="Elapsed" value={`${elapsed}s`} />
            <Stat label="Runs done" value={`${runs.filter((r) => r.status === "completed").length}/${current.agents.length * current.environments.length * current.repetitions}`} />
          </div>
          <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
            <figure>
              <p className="eyebrow mb-2">Latest observation</p>
              {last ? <ArcGrid grid={last.observation as number[][]} size={28} /> : <p className="text-sm italic">Waiting…</p>}
            </figure>
            <div>
              <p className="eyebrow mb-2">Recent actions</p>
              <table className="w-full text-sm">
                <tbody>
                  {steps.slice(-12).reverse().map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="figure-num w-12 py-1.5 text-muted-foreground">#{s.step_index}</td>
                      <td className="figure-num py-1.5">{s.executed_action}</td>
                      <td className="figure-num py-1.5 text-muted-foreground">{s.latency_ms}ms</td>
                      <td className={`py-1.5 text-xs ${s.error ? "text-destructive" : "text-muted-foreground"}`}>{s.error ?? s.state_change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <h2 className="mt-10 mb-3 text-xl">All runs</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-foreground text-left">{["Agent", "Environment", "Rep", "Actions", "Failures", "Retries", "Status"].map((h) => <th key={h} className="eyebrow py-2 font-normal">{h}</th>)}</tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="py-2">{agentById(r.agent)?.name}</td><td className="figure-num">{envName(r.environment)}</td>
                <td className="figure-num">{r.repetition}</td><td className="figure-num">{r.actions}</td>
                <td className="figure-num">{r.failures}</td><td className="figure-num">{r.retries}</td><td><StatusBadge status={r.status} /></td>
              </tr>))}</tbody>
          </table>
        </>
      )}
    </>
  );
}
