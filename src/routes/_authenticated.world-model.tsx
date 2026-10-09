import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getController, loadController } from "@/lib/genesis/session";
import type { SimController } from "@/lib/genesis/controller";
import { TRUE_RULES } from "@/lib/genesis/world";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/world-model")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "World Model — Genesis" },
      { name: "description", content: "Predictive learning dashboard: learned rules, confidence, evidence, and prediction error over time." },
      { property: "og:title", content: "World Model — Genesis" },
      { property: "og:description", content: "The symbolic world model: hypotheses, confirmed rules, and prediction errors." },
    ],
  }),
  component: WorldModelPage,
});

const KIND_STYLE: Record<string, string> = {
  confirmed: "text-success",
  hypothesis: "text-chart-4",
  incorrect: "text-destructive",
};

function WorldModelPage() {
  const { user } = useAuth();
  const [ctrl, setCtrl] = useState<SimController | null>(getController());
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [ruleFilter, setRuleFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    loadController(user.id).then((c) => { setCtrl(c); unsub = c.subscribe(force); });
    return () => unsub?.();
  }, [user]);

  if (!ctrl) return <p className="eyebrow p-10">Loading world model…</p>;
  const s = ctrl.state;
  const allRules = s.agents.flatMap((a) => a.mind.rules.map((r) => ({ ...r, agent: a.name, color: a.color })));
  const filtered = ruleFilter === "all" ? allRules : allRules.filter((r) => r.kind === ruleFilter);

  // Prediction error over time from actual recorded steps.
  const errSeries: { step: number; accuracy: number }[] = [];
  const sorted = [...ctrl.recentSteps].sort((a, b) => a.step - b.step);
  let correct = 0;
  sorted.forEach((r, i) => {
    if (r.error === 0) correct++;
    if (i % 5 === 4 || i === sorted.length - 1) errSeries.push({ step: r.step, accuracy: +(correct / (i + 1) * 100).toFixed(1) });
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">§3 · World model</p>
        <h1 className="text-2xl">Predictive learning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The implemented model is an explicit <strong>symbolic transition table</strong> learned from experience — not a neural network. A neural predictive model is a documented extension point.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Rules discovered", allRules.length],
          ["Confirmed", allRules.filter((r) => r.kind === "confirmed").length],
          ["Hypotheses", allRules.filter((r) => r.kind === "hypothesis").length],
          ["Falsified", allRules.filter((r) => r.kind === "incorrect").length],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded border border-border bg-card p-4">
            <p className="eyebrow">{label}</p>
            <p className="figure-num mt-1 text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <section className="rounded border border-border bg-card p-5">
        <p className="eyebrow">Prediction accuracy over time (from recorded steps)</p>
        <div className="mt-3 h-56">
          {errSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errSeries}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="step" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} unit="%" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="accuracy" stroke="var(--primary)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="pt-16 text-center text-sm text-muted-foreground">Run the simulation — accuracy appears once agents have made predictions.</p>
          )}
        </div>
      </section>

      <section className="rounded border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Learned rules</p>
          <div className="ml-auto flex gap-1">
            {["all", "confirmed", "hypothesis", "incorrect"].map((k) => (
              <button key={k} onClick={() => setRuleFilter(k)}
                className={`rounded border px-2 py-0.5 text-xs ${ruleFilter === k ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {filtered.map((r, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-2 rounded border border-border p-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="font-medium">{r.agent}</span>
              <span className={KIND_STYLE[r.kind]}>{r.kind}</span>
              <span className="figure-num text-muted-foreground">conf {Math.round(r.confidence * 100)}% · evidence {r.evidence} · t={r.step}</span>
              <p className="w-full text-muted-foreground">{r.text}</p>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-muted-foreground">No rules in this category yet.</li>}
        </ul>
      </section>

      <section className="rounded border border-dashed border-border bg-card/50 p-5">
        <p className="eyebrow">Ground truth — hidden from agents (researcher view)</p>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
          {TRUE_RULES.map((r) => {
            const discovered = allRules.some((ar) => ar.kind === "confirmed" && r.toLowerCase().includes(ar.text.split("→")[0]?.split(" ").slice(0, 2).join(" ").toLowerCase() ?? "~~~"));
            return (
              <li key={r} className="flex gap-2">
                <span className={discovered ? "text-success" : "text-muted-foreground"}>{discovered ? "◉" : "○"}</span>
                {r}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">◉ = at least one agent has confirmed a matching rule through interaction. Agents never see this list.</p>
      </section>
    </div>
  );
}
