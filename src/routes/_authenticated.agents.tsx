import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getController, loadController } from "@/lib/genesis/session";
import type { SimController } from "@/lib/genesis/controller";
import { coverage } from "@/lib/genesis/world";

export const Route = createFileRoute("/_authenticated/agents")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Agents — Genesis" },
      { name: "description", content: "Inspect every agent: goals, inventory, learned rules, hypotheses, and prediction errors." },
      { property: "og:title", content: "Agents — Genesis" },
      { property: "og:description", content: "Agent inspection: observations, actions, hypotheses, and memory." },
    ],
  }),
  component: AgentsPage,
});

const KIND_STYLE: Record<string, string> = {
  confirmed: "text-success",
  hypothesis: "text-chart-4",
  incorrect: "text-destructive",
};

function AgentsPage() {
  const { user } = useAuth();
  const [ctrl, setCtrl] = useState<SimController | null>(getController());
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    loadController(user.id).then((c) => { setCtrl(c); unsub = c.subscribe(force); });
    return () => unsub?.();
  }, [user]);

  if (!ctrl) return <p className="eyebrow p-10">Loading agents…</p>;
  const s = ctrl.state;
  const agent = s.agents.find((a) => a.id === selected);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">§2 · Agents</p>
        <h1 className="text-2xl">Population of {s.agents.length}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every agent runs the built-in baseline policy over a symbolic learned model. Rules below are learned from outcomes — never given.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.agents.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id === selected ? null : a.id)}
            className={`rounded border p-4 text-left transition-colors ${selected === a.id ? "border-primary bg-card" : "border-border bg-card hover:bg-accent"}`}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: a.color }} />
              <h3>{a.name}</h3>
              <span className={`ml-auto eyebrow ${a.status === "exhausted" ? "text-destructive" : ""}`}>{a.status}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Position</dt><dd className="figure-num text-right">{a.x},{a.y}</dd>
              <dt className="text-muted-foreground">Goal</dt><dd className="text-right">{a.goal}</dd>
              <dt className="text-muted-foreground">Energy</dt><dd className="figure-num text-right">{a.energy}/100</dd>
              <dt className="text-muted-foreground">Inventory</dt><dd className="figure-num text-right">{Object.entries(a.inventory).map(([k, v]) => `${k}×${v}`).join(" ") || "—"}</dd>
              <dt className="text-muted-foreground">Coverage</dt><dd className="figure-num text-right">{(coverage(s, a) * 100).toFixed(0)}%</dd>
              <dt className="text-muted-foreground">Memory</dt><dd className="figure-num text-right">{a.mind.rules.length} rules · {a.mind.visited.length} tiles</dd>
              <dt className="text-muted-foreground">Model</dt><dd className="text-right text-xs">built-in baseline</dd>
            </dl>
          </button>
        ))}
      </div>

      {agent && (
        <section className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
            <h2 className="text-xl">{agent.name} — inspection</h2>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Knowledge store ({agent.mind.rules.length} rules)</p>
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-sm">
                {[...agent.mind.rules].sort((x, y) => y.evidence - x.evidence).map((r) => (
                  <li key={r.key} className="rounded border border-border p-2">
                    <span className={KIND_STYLE[r.kind]}>{r.kind}</span> · <span className="figure-num">{Math.round(r.confidence * 100)}%</span> · evidence {r.evidence}
                    {r.shared && <span className="text-chart-2"> · taught to others</span>}
                    <p className="mt-0.5 text-muted-foreground">{r.text}</p>
                  </li>
                ))}
                {agent.mind.rules.length === 0 && <li className="text-muted-foreground">Nothing learned yet — run the simulation.</li>}
              </ul>
            </div>
            <div>
              <p className="eyebrow">Recent experiences (predicted vs actual)</p>
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-sm">
                {[...ctrl.recentSteps].filter((r) => r.agentId === agent.id).reverse().slice(0, 25).map((r, i) => (
                  <li key={i} className="rounded border border-border p-2">
                    <div className="flex justify-between">
                      <span className="figure-num text-muted-foreground">t={r.step}</span>
                      <span className="font-mono text-xs">{r.action}</span>
                      <span className={r.error > 0 ? "text-destructive" : "text-success"}>{r.error > 0 ? "error" : "matched"}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">predicted: {r.predicted} ({Math.round(r.confidence * 100)}%) → actual: {r.actual}</p>
                  </li>
                ))}
                {ctrl.recentSteps.length === 0 && <li className="text-muted-foreground">No steps recorded yet.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
