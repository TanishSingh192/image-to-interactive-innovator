import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArcGrid } from "@/components/ArcGrid";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Benchmarking Lab — Reproducible agent experiments" },
      { name: "description", content: "Configure, run, replay and export reproducible AI agent experiments on interactive reasoning tasks." },
      { property: "og:title", content: "AI Benchmarking Lab" },
      { property: "og:description", content: "Reproducible experiments comparing AI agents on interactive reasoning environments." },
    ],
  }),
  component: Index,
});

const sample = [
  [0, 0, 1, 1, 0, 0, 2, 0],
  [0, 3, 3, 1, 0, 2, 2, 0],
  [0, 3, 4, 0, 0, 0, 2, 0],
  [0, 0, 0, 0, 8, 8, 0, 0],
  [6, 6, 0, 0, 8, 7, 0, 0],
  [6, 0, 0, 5, 5, 5, 0, 9],
  [0, 0, 0, 5, 0, 5, 0, 9],
  [1, 1, 0, 0, 0, 0, 0, 9],
];

function Index() {
  const { session } = useAuth();
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between border-b border-foreground pb-3">
        <p className="eyebrow">AI Benchmarking Lab · Vol. 1</p>
        <p className="eyebrow">ARC-AGI-3 Edition</p>
      </div>
      <div className="grid gap-12 py-14 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <h1 className="text-5xl leading-[1.05] md:text-6xl">
            Not only <em>which</em> agent wins — but <em className="text-primary">how</em>, and why.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            A laboratory for configuring experiments, running four agents side by side, replaying every step, and exporting results ready for a paper.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/experiments" : "/auth"}>{session ? "Open the lab" : "Sign in to begin"}</Link>
            </Button>
          </div>
        </div>
        <figure className="justify-self-center">
          <ArcGrid grid={sample} size={30} />
          <figcaption className="mt-3 font-serif text-sm italic text-muted-foreground">Fig. 1 — An observation frame.</figcaption>
        </figure>
      </div>
      <section className="grid gap-8 border-t border-foreground pt-8 md:grid-cols-4">
        {[
          ["§1", "Setup", "Hypothesis, agents, budgets, seeds."],
          ["§2", "Live", "Watch actions and failures as they happen."],
          ["§3", "Compare", "Scores, cost, latency, failure rates."],
          ["§4", "Replay & export", "Step through traces; CSV, JSONL, manifests."],
        ].map(([n, t, d]) => (
          <div key={t}>
            <p className="figure-num text-primary">{n}</p>
            <h3 className="mt-1 text-lg">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
