import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getController, loadController } from "@/lib/genesis/session";
import type { SimController } from "@/lib/genesis/controller";

export const Route = createFileRoute("/_authenticated/civilization")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Civilization — Genesis" },
      { name: "description", content: "Collective behavior: exchanges, shared knowledge, communication, and the civilization timeline." },
      { property: "og:title", content: "Civilization — Genesis" },
      { property: "og:description", content: "How the agent society develops: trade, teaching, and shared discoveries." },
    ],
  }),
  component: CivilizationPage,
});

function CivilizationPage() {
  const { user } = useAuth();
  const [ctrl, setCtrl] = useState<SimController | null>(getController());
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    loadController(user.id).then((c) => { setCtrl(c); unsub = c.subscribe(force); });
    return () => unsub?.();
  }, [user]);

  if (!ctrl) return <p className="eyebrow p-10">Loading civilization…</p>;
  const s = ctrl.state;

  const resourceTotals: Record<string, number> = {};
  for (const a of s.agents) for (const [k, v] of Object.entries(a.inventory)) resourceTotals[k] = (resourceTotals[k] ?? 0) + v;
  const sharedRules = s.agents.flatMap((a) => a.mind.rules.filter((r) => r.shared).map((r) => ({ ...r, agent: a.name })));
  const discoveries = ctrl.events.filter((e) => e.kind === "discovery");
  const exchanges = ctrl.events.filter((e) => e.message.includes(" gave "));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">§4 · Civilization</p>
        <h1 className="text-2xl">Collective behavior</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Communication {s.config.allowComms ? "enabled" : "disabled"} · knowledge sharing {s.config.allowSharing ? "enabled" : "disabled"}.
          Only behaviors actually recorded in the simulation appear here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Population", s.agents.length],
          ["Resources held", Object.values(resourceTotals).reduce((a, b) => a + b, 0)],
          ["Exchanges", s.stats.exchanges],
          ["Discoveries", discoveries.length],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded border border-border bg-card p-4">
            <p className="eyebrow">{label}</p>
            <p className="figure-num mt-1 text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-border bg-card p-5">
          <p className="eyebrow">Resource distribution</p>
          <ul className="mt-3 space-y-2 text-sm">
            {s.agents.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                <span className="w-16">{a.name}</span>
                <span className="figure-num text-muted-foreground">{Object.entries(a.inventory).map(([k, v]) => `${k}×${v}`).join(" ") || "empty"}</span>
                <span className="ml-auto figure-num text-xs text-muted-foreground">({a.x},{a.y})</span>
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-5">Specialization</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {s.agents.map((a) => {
              const confirmed = a.mind.rules.filter((r) => r.kind === "confirmed").length;
              const spec = (a.inventory["tool"] ?? 0) > 0 ? "toolmaker" : confirmed >= 3 ? "surveyor" : (a.inventory["food"] ?? 0) > 2 ? "forager" : "wanderer";
              return <li key={a.id}>{a.name}: <span className="text-foreground">{spec}</span> · {confirmed} confirmed rules</li>;
            })}
          </ul>
        </section>

        <section className="rounded border border-border bg-card p-5">
          <p className="eyebrow">Communication log</p>
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-sm">
            {[...s.messages].reverse().slice(0, 30).map((m, i) => (
              <li key={i} className="rounded border border-border p-2">
                <span className="figure-num text-muted-foreground">t={m.step}</span> <strong>{m.from}</strong>: {m.text}
              </li>
            ))}
            {s.messages.length === 0 && <li className="text-muted-foreground">No messages yet. Agents speak when they meet and have something to teach.</li>}
          </ul>
          <p className="eyebrow mt-5">Taught rules ({sharedRules.length})</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {sharedRules.slice(0, 10).map((r, i) => <li key={i}>{r.agent} taught: {r.text}</li>)}
            {sharedRules.length === 0 && <li>No knowledge has been transmitted between agents yet.</li>}
          </ul>
        </section>
      </div>

      <section className="rounded border border-border bg-card p-5">
        <p className="eyebrow">Civilization timeline</p>
        <ol className="mt-3 space-y-0 text-sm">
          {[...ctrl.events].sort((a, b) => a.step - b.step).slice(-40).map((e, i) => (
            <li key={i} className="flex gap-3 border-l border-border pb-3 pl-4">
              <span className="figure-num w-10 shrink-0 text-muted-foreground">t={e.step}</span>
              <span className={e.kind === "discovery" ? "text-primary" : ""}>{e.message}</span>
            </li>
          ))}
          {ctrl.events.length === 0 && <li className="text-muted-foreground">The timeline fills as the simulation runs.</li>}
        </ol>
      </section>
    </div>
  );
}
