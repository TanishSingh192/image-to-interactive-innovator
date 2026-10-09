import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { ExperimentPicker } from "@/components/ExperimentPicker";
import { useExperiments, useRuns } from "@/lib/queries";
import { AGENTS, agentById, envName } from "@/lib/lab";

export const Route = createFileRoute("/_authenticated/compare")({
  validateSearch: (s: Record<string, unknown>) => ({ exp: typeof s["exp"] === "string" ? s["exp"] : undefined }),
  head: () => ({
    meta: [
      { title: "Model comparison — AI Benchmarking Lab" },
      { name: "description", content: "Compare agents by score, success rate, actions, latency, cost and failures." },
      { property: "og:title", content: "Model comparison — AI Benchmarking Lab" },
      { property: "og:description", content: "Side-by-side agent performance tables and charts." },
    ],
  }),
  component: Page,
});

function Page() {
  const { exp } = Route.useSearch();
  const nav = useNavigate({ from: "/compare" });
  const { data: exps = [] } = useExperiments();
  const current = exps.find((e) => e.id === exp) ?? exps.find((e) => e.status === "completed") ?? exps[0];
  const { data: runs = [] } = useRuns(current?.id);
  const done = runs.filter((r) => r.status === "completed");

  const rows = AGENTS.filter((a) => current?.agents.includes(a.id)).map((a) => {
    const rs = done.filter((r) => r.agent === a.id);
    const n = rs.length || 1;
    const solved = rs.filter((r) => r.solved);
    const totalActions = rs.reduce((s, r) => s + r.actions, 0);
    return {
      agent: a.name, id: a.id, mode: a.mode, n: rs.length,
      score: +(rs.reduce((s, r) => s + Number(r.score), 0) / n).toFixed(1),
      success: +((solved.length / n) * 100).toFixed(0),
      actionsPerSolve: solved.length ? +(solved.reduce((s, r) => s + r.actions, 0) / solved.length).toFixed(1) : null,
      latency: totalActions ? Math.round(rs.reduce((s, r) => s + r.duration_ms, 0) / totalActions) : 0,
      cost: +rs.reduce((s, r) => s + Number(r.cost), 0).toFixed(3),
      failRate: totalActions ? +((rs.reduce((s, r) => s + r.failures, 0) / totalActions) * 100).toFixed(1) : 0,
    };
  });

  const byEnv = (current?.environments ?? []).map((env) => {
    const o: Record<string, string | number> = { env: envName(env).split(" · ")[0] ?? env };
    for (const a of current!.agents) {
      const rs = done.filter((r) => r.agent === a && r.environment === env);
      o[agentById(a)!.name] = rs.length ? +(rs.reduce((s, r) => s + Number(r.score), 0) / rs.length).toFixed(1) : 0;
    }
    return o;
  });

  return (
    <>
      <PageHeader section="§3 Results" title="Model comparison">
        <ExperimentPicker value={current?.id} onChange={(id) => nav({ search: { exp: id } })} />
      </PageHeader>
      {!current ? <p className="font-serif italic">No experiments yet.</p> : (
        <>
          <p className="mb-6 max-w-2xl font-serif italic text-muted-foreground">{current.hypothesis || "No hypothesis recorded."}</p>
          <p className="eyebrow mb-2">Table 1 — Aggregate performance (simulated, n = completed runs)</p>
          <table className="mb-10 w-full text-sm">
            <thead><tr className="border-y border-foreground text-left">
              {["Agent", "Mode", "n", "Mean score", "Success %", "Actions / solve", "ms / action", "Cost $", "Invalid %"].map((h) => <th key={h} className="eyebrow py-2 pr-2 font-normal">{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="py-2 font-serif">{r.agent}</td><td className="text-xs">{r.mode}</td>
                {[r.n, r.score, r.success, r.actionsPerSolve ?? "—", r.latency, r.cost, r.failRate].map((v, i) => <td key={i} className="figure-num">{v}</td>)}
              </tr>))}</tbody>
          </table>
          <div className="grid gap-10 lg:grid-cols-2">
            <figure>
              <p className="eyebrow mb-2">Fig. 2 — Mean score by environment</p>
              <div className="h-72"><ResponsiveContainer>
                <BarChart data={byEnv}><CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="env" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {current.agents.map((a) => <Bar key={a} dataKey={agentById(a)!.name} fill={agentById(a)!.color} />)}
                </BarChart></ResponsiveContainer></div>
            </figure>
            <figure>
              <p className="eyebrow mb-2">Fig. 3 — Latency per action (ms) and invalid-action rate (%)</p>
              <div className="h-72"><ResponsiveContainer>
                <BarChart data={rows}><CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="agent" tick={{ fontSize: 10 }} /><YAxis yAxisId="l" tick={{ fontSize: 11 }} /><YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="latency" name="ms / action" fill="var(--chart-2)" />
                  <Bar yAxisId="r" dataKey="failRate" name="Invalid %" fill="var(--chart-1)" />
                </BarChart></ResponsiveContainer></div>
            </figure>
          </div>
          <h2 className="mt-10 mb-3 text-xl">Episodes</h2>
          <table className="w-full text-sm">
            <tbody>{done.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="py-1.5">{agentById(r.agent)?.name}</td><td className="figure-num">{envName(r.environment)}</td>
                <td className="figure-num">rep {r.repetition}</td><td className={r.solved ? "text-success" : "text-muted-foreground"}>{r.solved ? "solved" : "unsolved"}</td>
                <td className="figure-num">{Number(r.score)}</td>
                <td className="text-right"><Link className="text-xs underline" to="/replay" search={{ run: r.id, exp: current.id }}>Replay</Link></td>
              </tr>))}</tbody>
          </table>
        </>
      )}
    </>
  );
}
