import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { runSim } from "@/lib/genesis/controller";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/experiments/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New Experiment — Genesis" },
      { name: "description", content: "Configure a controlled simulation run with a hypothesis, seed, and agent settings." },
      { property: "og:title", content: "New Experiment — Genesis" },
      { property: "og:description", content: "Configure and run a controlled world-model experiment." },
    ],
  }),
  component: NewExperiment,
});

function NewExperiment() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [notes, setNotes] = useState("");
  const [seed, setSeed] = useState(7);
  const [steps, setSteps] = useState(300);
  const [agents, setAgents] = useState(3);
  const [comms, setComms] = useState(true);
  const [sharing, setSharing] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const run = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!name.trim()) { toast.error("Give the experiment a name"); return; }
    setRunning(true);
    setProgress(0);
    cancelled.current = false;

    const { data: row, error } = await supabase.from("genesis_experiments").insert({
      user_id: user.id, name: name.trim(), hypothesis: hypothesis || null, notes: notes || null,
      seed, status: "running",
      config: { seed, steps, agents, comms, sharing },
    }).select("id").single();
    if (error || !row) { toast.error(error?.message ?? "Could not create experiment"); setRunning(false); return; }

    runSim(
      { width: 26, height: 18, seed, agentCount: agents, allowComms: comms, allowSharing: sharing, dayLength: 40 },
      steps,
      (p) => setProgress(Math.round(p * 100)),
      () => cancelled.current,
    ).then(async (result) => {
      if (cancelled.current) {
        await supabase.from("genesis_experiments").update({ status: "cancelled" }).eq("id", row.id);
        return;
      }
      const { error: upErr } = await supabase.from("genesis_experiments").update({
        status: "completed", results: result, completed_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (upErr) toast.error(upErr.message);
      else toast.success(`Done: ${result.totalRules} rules learned, ${result.accuracy}% prediction accuracy.`);
      nav({ to: "/experiments" });
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="eyebrow">§5 · Experiments</p>
        <h1 className="text-2xl">New experiment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runs a full offline simulation (no effect on the live world) and stores measured outcomes only.
        </p>
      </div>

      <div className="space-y-4 rounded border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharing accelerates tool discovery" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hyp">Hypothesis</Label>
          <Input id="hyp" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="e.g. Agents with sharing confirm more rules in 300 steps" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="seed">Seed</Label>
            <Input id="seed" type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="steps">Steps</Label>
            <Input id="steps" type="number" value={steps} onChange={(e) => setSteps(Math.min(2000, Math.max(50, +e.target.value || 300)))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agents">Agents</Label>
            <Input id="agents" type="number" value={agents} onChange={(e) => setAgents(Math.min(6, Math.max(1, +e.target.value || 3)))} />
          </div>
        </div>
        <div className="flex gap-8">
          <label className="flex items-center gap-2 text-sm"><Switch checked={comms} onCheckedChange={setComms} />Communication</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={sharing} onCheckedChange={setSharing} />Knowledge sharing</label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        {running ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="eyebrow">Simulating… {progress}%</p>
              <Button size="sm" variant="outline" onClick={() => { cancelled.current = true; }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => void run()}>Run experiment</Button>
        )}
      </div>
    </div>
  );
}
