import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGenesisExperiments } from "@/lib/genesis/queries";
import { StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/experiments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Experiments — Genesis" },
      { name: "description", content: "Run controlled A/B simulations with different seeds and agent settings, then compare outcomes." },
      { property: "og:title", content: "Experiments — Genesis" },
      { property: "og:description", content: "Controlled comparisons of agent populations and world configurations." },
    ],
  }),
  component: ExperimentsPage,
});

function ExperimentsPage() {
  const { data: exps, isLoading } = useGenesisExperiments();
  const [compare, setCompare] = useState<string[]>([]);

  const done = useMemo(() => (exps ?? []).filter((e) => e.status === "completed"), [exps]);
  const pair = compare.length === 2 ? done.filter((e) => compare.includes(e.id)) : [];

  const toggle = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 2 ? [...c, id] : [c[1]!, id]));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">§5 · Experiments</p>
          <h1 className="text-2xl">Controlled runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every run below was actually simulated in this lab — no fabricated results.</p>
        </div>
        <Button asChild><Link to="/experiments/new">New experiment</Link></Button>
      </div>

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left eyebrow">
              <th className="p-3" />
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3">Seed</th>
              <th className="p-3">Agents</th>
              <th className="p-3">Steps</th>
              <th className="p-3">Rules learned</th>
              <th className="p-3">Prediction acc.</th>
              <th className="p-3">Coverage</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {(exps ?? []).map((e) => {
              const r = e.results as { totalRules?: number; accuracy?: number; coverage?: number } | null;
              const cfg = e.config as { agents?: number; steps?: number } | null;
              return (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    {e.status === "completed" && (
                      <input type="checkbox" checked={compare.includes(e.id)} onChange={() => toggle(e.id)} aria-label={`Compare ${e.name}`} />
                    )}
                  </td>
                  <td className="p-3 font-medium">{e.name}</td>
                  <td className="p-3"><StatusBadge s={e.status} /></td>
                  <td className="figure-num p-3">{e.seed}</td>
                  <td className="figure-num p-3">{cfg?.agents ?? "—"}</td>
                  <td className="figure-num p-3">{cfg?.steps ?? "—"}</td>
                  <td className="figure-num p-3">{r?.totalRules ?? "—"}</td>
                  <td className="figure-num p-3">{r?.accuracy != null ? `${r.accuracy}%` : "—"}</td>
                  <td className="figure-num p-3">{r?.coverage != null ? `${r.coverage}%` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {!isLoading && (exps ?? []).length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No experiments yet — create your first controlled run.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pair.length === 2 && (
        <section className="rounded border border-border bg-card p-5">
          <p className="eyebrow">Comparison</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {pair.map((e) => {
              const r = e.results as { totalRules?: number; confirmed?: number; accuracy?: number; coverage?: number; exchanges?: number; discoveries?: number } | null;
              const cfg = e.config as { comms?: boolean; sharing?: boolean; agents?: number; steps?: number } | null;
              return (
                <div key={e.id} className="rounded border border-border p-4">
                  <h3>{e.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">seed {e.seed} · {cfg?.agents} agents · {cfg?.steps} steps · comms {cfg?.comms ? "on" : "off"} · sharing {cfg?.sharing ? "on" : "off"}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Rules learned</dt><dd className="figure-num text-right">{r?.totalRules ?? 0}</dd>
                    <dt className="text-muted-foreground">Confirmed</dt><dd className="figure-num text-right">{r?.confirmed ?? 0}</dd>
                    <dt className="text-muted-foreground">Prediction accuracy</dt><dd className="figure-num text-right">{r?.accuracy ?? 0}%</dd>
                    <dt className="text-muted-foreground">World coverage</dt><dd className="figure-num text-right">{r?.coverage ?? 0}%</dd>
                    <dt className="text-muted-foreground">Exchanges</dt><dd className="figure-num text-right">{r?.exchanges ?? 0}</dd>
                    <dt className="text-muted-foreground">Discoveries</dt><dd className="figure-num text-right">{r?.discoveries ?? 0}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
