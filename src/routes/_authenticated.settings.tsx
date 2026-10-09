import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getController } from "@/lib/genesis/session";
import { download } from "@/lib/genesis/controller";
import { useKnowledge, useExperiences } from "@/lib/genesis/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Genesis" },
      { name: "description", content: "Model provider configuration, data export, and lab preferences." },
      { property: "og:title", content: "Settings — Genesis" },
      { property: "og:description", content: "Configure model providers and export research data." },
    ],
  }),
  component: SettingsPage,
});

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k])).join(","))].join("\n");
}

function SettingsPage() {
  const { user } = useAuth();
  const { data: knowledge } = useKnowledge();
  const { data: experiences } = useExperiences();
  const [provider, setProvider] = useState(localStorageSafe("genesis_provider") ?? "");
  const [model, setModel] = useState(localStorageSafe("genesis_model") ?? "");

  const saveProvider = () => {
    localStorage.setItem("genesis_provider", provider);
    localStorage.setItem("genesis_model", model);
    toast.success("Saved. Agents currently run the built-in baseline policy; external models are a planned extension point.");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="eyebrow">§7 · Settings</p>
        <h1 className="text-2xl">Lab settings</h1>
      </div>

      <section className="space-y-4 rounded border border-border bg-card p-5">
        <div>
          <h3>Model providers</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Agents currently run the built-in symbolic baseline policy. Pluggable hosted and local models (with per-agent model choice) are the documented extension point — the controller calls <code className="font-mono text-xs">decide(agent, world)</code>, which any model adapter can implement.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prov">Provider (e.g. openai, ollama)</Label>
            <Input id="prov" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="built-in" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model name</Label>
            <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="baseline-v1" />
          </div>
        </div>
        <Button variant="outline" onClick={saveProvider}>Save provider preference</Button>
      </section>

      <section className="space-y-4 rounded border border-border bg-card p-5">
        <div>
          <h3>Export research data</h3>
          <p className="mt-1 text-sm text-muted-foreground">Exports contain only data actually recorded by the simulation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!knowledge?.length} onClick={() => {
            download("knowledge.json", JSON.stringify(knowledge, null, 2));
          }}>Knowledge JSON ({knowledge?.length ?? 0})</Button>
          <Button variant="outline" disabled={!knowledge?.length} onClick={() => {
            download("knowledge.csv", toCSV((knowledge ?? []) as unknown as Record<string, unknown>[]), "text/csv");
          }}>Knowledge CSV</Button>
          <Button variant="outline" disabled={!experiences?.length} onClick={() => {
            download("experiences.json", JSON.stringify(experiences, null, 2));
          }}>Experiences JSON ({experiences?.length ?? 0})</Button>
          <Button variant="outline" disabled={!experiences?.length} onClick={() => {
            download("experiences.csv", toCSV((experiences ?? []) as unknown as Record<string, unknown>[]), "text/csv");
          }}>Experiences CSV</Button>
        </div>
      </section>

      <section className="space-y-2 rounded border border-border bg-card p-5">
        <h3>Session</h3>
        <p className="text-sm text-muted-foreground">Signed in as {user?.email}. The live world persists between visits; use Reset on the World page to start the current world over.</p>
        <p className="text-xs text-muted-foreground">World id: <span className="font-mono">{getController()?.worldId ?? "—"}</span></p>
      </section>
    </div>
  );
}

function localStorageSafe(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
