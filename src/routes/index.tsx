import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Genesis — Artificial Civilization & World Model Lab" },
      { name: "description", content: "Deploy AI agents into an unfamiliar simulated world and watch them explore, form hypotheses, and learn its hidden rules." },
      { property: "og:title", content: "Genesis — Artificial Civilization & World Model Lab" },
      { property: "og:description", content: "A browser-based research environment where AI agents discover the rules of a simulated world through experience." },
    ],
  }),
  component: Index,
});

function Index() {
  const { session } = useAuth();
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between border-b border-foreground pb-3">
        <p className="eyebrow">Genesis · Artificial Civilization & World Model Lab</p>
        <p className="eyebrow">Vol. 1</p>
      </div>
      <div className="grid gap-12 py-14 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <h1 className="text-5xl leading-[1.05] md:text-6xl">
            Drop an agent into a world it <em className="text-primary">does not understand</em> — and watch it learn.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Agents begin with no map, no rules, and no recipes. They explore, form hypotheses, test them against the environment, and build a predictive world model — alone or as a small civilization.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/world" : "/auth"}>{session ? "Enter the lab" : "Sign in to begin"}</Link>
            </Button>
          </div>
        </div>
        <figure className="justify-self-center">
          <div className="grid grid-cols-6 gap-0.5">
            {["grass","grass","forest","water","grass","sand","forest","tree","forest","water","grass","grass","grass","forest","berry","grass","sand","rock","water","grass","grass","tree","grass","rock","grass","stone","grass","forest","water","grass","grass","sand","rock","grass","grass"].map((t, i) => (
              <div key={i} className="h-9 w-9" style={{
                background: t === "water" ? "var(--t-water)" : t === "forest" || t === "tree" ? "var(--t-forest)" : t === "sand" ? "var(--t-sand)" : t === "rock" || t === "stone" ? "var(--t-rock)" : "var(--t-grass)",
              }}>
                {t === "tree" && <div className="mx-auto mt-1.5 h-5 w-5 rounded-full bg-success/70" />}
                {t === "berry" && <div className="mx-auto mt-2.5 h-3.5 w-3.5 rounded-full bg-primary" />}
                {t === "stone" && <div className="mx-auto mt-2 h-4 w-4 rotate-45 bg-muted-foreground/60" />}
              </div>
            ))}
          </div>
          <figcaption className="mt-3 font-serif text-sm italic text-muted-foreground">Fig. 1 — A world an agent has never seen.</figcaption>
        </figure>
      </div>
      <section className="grid gap-8 border-t border-foreground pt-8 md:grid-cols-4">
        {[
          ["§1", "World", "A living 2D world with terrain, resources, and a day-night clock."],
          ["§2", "Agents", "Observe, hypothesize, act, learn — every step recorded."],
          ["§3", "World model", "Symbolic rules with confidence, evidence, and prediction error."],
          ["§4", "Civilization", "Multiple agents that exchange resources and teach each other."],
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
