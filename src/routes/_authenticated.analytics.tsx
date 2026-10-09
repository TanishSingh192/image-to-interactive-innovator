import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGenesisExperiments, useKnowledge } from "@/lib/genesis/queries";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Analytics — Genesis" },
      { name: "description", content: "Learning curves and discovery patterns computed from stored experiment and knowledge data." },
      { property: "og:title", content: "Analytics — Genesis" },
      { property: "og:description", content: "Measured learning curves, discovery patterns, and experiment outcomes." },
    ],
  }),
  component: AnalyticsPage,
});

const TOOLTIP = { background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 } as const;

function AnalyticsPage() {
  const { data: exps } = useGenesisExperiments();
  const { data: knowledge } = useKnowledge();

  const completed = useMemo(() => (exps ?? []).filter((e) => e.status === "completed"), [exps]);

  const outcomeSeries = completed.map((e) => {
    const r = e.results as { totalRules?: number; accuracy?: number; coverage?: number };
    return { name: e.name.slice(0, 14), rules: r?.totalRules ?? 0, accuracy: r?.accuracy ?? 0, coverage: r?.coverage ?? 0 };
  });

  const sharingCompare = useMemo(() => {
    const on = completed.filter((e) => (e.config as { sharing?: boolean })?.sharing);
    const off = completed.filter((e) => !(e.config as { sharing?: boolean })?.sharing);
    const avg = (arr: typeof completed, key: string) =>
      arr.length ? +(arr.reduce((a, e) => a + (((e.results as Record<string, number>) ?? {})[key] ?? 0), 0) / arr.length).toFixed(1) : 0;
    return [
      { group: `sharing on (n=${on.length})`, rules: avg(on, "totalRules"), accuracy: avg(on, "accuracy") },
      { group: `sharing off (n=${off.length})`, rules: avg(off, "totalRules"), accuracy: avg(off, "accuracy") },
    ];
  }, [completed]);

  const discoveryTimeline = useMemo(() => {
    const rows = (knowledge ?? []).filter((k) => k.discovery_step != null);
    const buckets = new Map<number, number>();
    for (const k of rows) {
      const b = Math.floor(k.discovery_step! / 25) * 25;
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([step, count]) => ({ step, discoveries: count }));
  }, [knowledge]);

  const empty = completed.length === 0 && (knowledge ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">§6 · Analytics</p>
        <h1 className="text-2xl">Measured outcomes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every chart is computed from stored simulation data. Empty charts mean no data has been recorded yet.</p>
      </div>

      {empty && (
        <div className="rounded border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          No analytics yet — run the live world or an experiment first.
        </div>
      )}

      <section className="rounded border border-border bg-card p-5">
        <p className="eyebrow">Experiment outcomes</p>
        <div className="mt-3 h-64">
          {outcomeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomeSeries}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="rules" fill="var(--chart-1)" name="Rules learned" />
                <Bar dataKey="accuracy" fill="var(--chart-2)" name="Accuracy %" />
                <Bar dataKey="coverage" fill="var(--chart-3)" name="Coverage %" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="pt-20 text-center text-sm text-muted-foreground">No completed experiments.</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-border bg-card p-5">
          <p className="eyebrow">Knowledge sharing: average outcomes</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sharingCompare}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="group" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="rules" fill="var(--chart-1)" name="Avg rules" />
                <Bar dataKey="accuracy" fill="var(--chart-2)" name="Avg accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded border border-border bg-card p-5">
          <p className="eyebrow">Discoveries over simulation time (live world)</p>
          <div className="mt-3 h-56">
            {discoveryTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={discoveryTimeline}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="step" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Line type="monotone" dataKey="discoveries" stroke="var(--chart-4)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="pt-16 text-center text-sm text-muted-foreground">No rules discovered in the live world yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
