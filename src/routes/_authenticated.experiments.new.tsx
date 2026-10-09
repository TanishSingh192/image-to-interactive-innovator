import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AGENTS, ENVIRONMENTS, executeExperiment } from "@/lib/lab";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/experiments/new")({
  head: () => ({
    meta: [
      { title: "Experiment setup — AI Benchmarking Lab" },
      { name: "description", content: "Configure agents, environments, budgets and seeds, then launch." },
      { property: "og:title", content: "Experiment setup — AI Benchmarking Lab" },
      { property: "og:description", content: "Design a reproducible agent experiment." },
    ],
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "", hypothesis: "", agents: AGENTS.map((a) => a.id), environments: ["ls20", "ft09"],
    action_budget: 60, timeout_s: 300, repetitions: 1, seed: 42, prompt_version: "v1", temperature: 0.2,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const toggle = (k: "agents" | "environments", id: string) =>
    set(k, f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id]);

  const totalRuns = f.agents.length * f.environments.length * f.repetitions;
  const estCost = AGENTS.filter((a) => f.agents.includes(a.id))
    .reduce((s, a) => s + a.costPer1k * 1.3 * f.action_budget * 0.7 * f.environments.length * f.repetitions, 0);

  async function launch() {
    if (!f.name.trim()) { toast.error("Give the experiment a name.");
    if (!f.agents.length || !f.environments.length) { toast.error("Pick at least one agent and environment.");
    setBusy(true);
    const { data, error } = await supabase.from("experiments").insert(f).select().single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "Could not create experiment");
    executeExperiment(data).finally(() => qc.invalidateQueries());
    nav({ to: "/live", search: { exp: data.id } });
  }

  return (
    <>
      <PageHeader section="§1 Setup" title="New experiment" />
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Hosted vs local on navigation tasks" /></div>
            <div className="space-y-1.5"><Label>Hypothesis</Label><Textarea value={f.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} placeholder="Hosted models need fewer actions per completed level than local models." /></div>
          </section>
          <section>
            <h2 className="mb-3 text-xl">Agents</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {AGENTS.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-start gap-3 border border-border bg-card p-3 hover:border-foreground">
                  <Checkbox checked={f.agents.includes(a.id)} onCheckedChange={() => toggle("agents", a.id)} />
                  <span><span className="block font-medium">{a.name}</span>
                    <span className="figure-num text-xs text-muted-foreground">{a.mode} · {a.provider} · {a.model}</span></span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xl">Environments</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {ENVIRONMENTS.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-3 border border-border bg-card p-3 hover:border-foreground">
                  <Checkbox checked={f.environments.includes(e.id)} onCheckedChange={() => toggle("environments", e.id)} />
                  <span className="figure-num text-sm">{e.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xl">Limits & parameters</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {([["action_budget", "Action budget"], ["timeout_s", "Timeout (s)"], ["repetitions", "Repetitions"], ["seed", "Seed"], ["temperature", "Temperature"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1.5"><Label>{l}</Label>
                  <Input type="number" step={k === "temperature" ? 0.1 : 1} value={f[k]} onChange={(e) => set(k, Number(e.target.value))} /></div>
              ))}
              <div className="space-y-1.5"><Label>Prompt version</Label><Input value={f.prompt_version} onChange={(e) => set("prompt_version", e.target.value)} /></div>
            </div>
          </section>
        </div>
        <aside className="h-fit border border-foreground bg-card p-5 lg:sticky lg:top-6">
          <p className="eyebrow">Configuration preview</p>
          <pre className="figure-num mt-3 max-h-72 overflow-auto bg-muted p-3 text-[0.7rem] leading-relaxed">{JSON.stringify(f, null, 2)}</pre>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Runs</dt><dd className="figure-num">{totalRuns}</dd></div>
            <div className="flex justify-between"><dt>Est. cost</dt><dd className="figure-num">${estCost.toFixed(2)}</dd></div>
          </dl>
          <Button className="mt-5 w-full" onClick={launch} disabled={busy}>Launch experiment</Button>
          <p className="mt-3 text-xs italic text-muted-foreground">Runs currently use a simulated environment; results are labelled as simulated and are not official scores.</p>
        </aside>
      </div>
    </>
  );
}
