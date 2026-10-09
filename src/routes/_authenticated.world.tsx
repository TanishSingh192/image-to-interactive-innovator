import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import { Play, Pause, StepForward, RotateCcw, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getController, loadController, newWorld } from "@/lib/genesis/session";
import type { SimController } from "@/lib/genesis/controller";
import { isNight } from "@/lib/genesis/world";
import { WorldCanvas } from "@/components/WorldCanvas";
import { World3D } from "@/components/World3D";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/world")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "World — Genesis" },
      { name: "description", content: "Watch agents explore and learn a simulated world in real time." },
      { property: "og:title", content: "World — Genesis" },
      { property: "og:description", content: "The live simulation: terrain, resources, agents, and the event feed." },
    ],
  }),
  component: WorldPage,
});

function WorldPage() {
  const { user } = useAuth();
  const [ctrl, setCtrl] = useState<SimController | null>(getController());
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tile, setTile] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">("3d");

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    loadController(user.id).then((c) => {
      setCtrl(c);
      unsub = c.subscribe(force);
    });
    return () => unsub?.();
  }, [user]);

  if (!ctrl) return <p className="eyebrow p-10">Growing a world…</p>;


  const s = ctrl.state;
  const agent = s.agents.find((a) => a.id === selectedAgent);
  const tileInfo = tile ? s.tiles[tile.y]?.[tile.x] : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="eyebrow">§1 · World</p>
          <h1 className="text-2xl">The living world</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="figure-num rounded border border-border px-2 py-1 text-xs">
            t={s.clock} · {isNight(s) ? "night" : "day"} · seed {s.config.seed}
          </span>
          <Button size="sm" variant={ctrl.playing ? "secondary" : "default"} onClick={() => (ctrl.playing ? ctrl.pause() : ctrl.play())}>
            {ctrl.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {ctrl.playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => ctrl.step()}><StepForward className="h-4 w-4" />Step</Button>
          <div className="flex w-32 items-center gap-2">
            <span className="eyebrow">speed</span>
            <Slider value={[ctrl.speed]} min={1} max={20} step={1} onValueChange={([v]) => ctrl.setSpeed(v!)} />
          </div>
          <Button size="sm" variant="outline" onClick={() => void ctrl.reset()}><RotateCcw className="h-4 w-4" />Reset</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const seed = Math.floor(Math.random() * 100000);
            void newWorld(user!.id, seed, s.config.agentCount).then((c) => { c.subscribe(force); setCtrl(c); });
          }}><Plus className="h-4 w-4" />New world</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[320px] overflow-hidden rounded border border-border bg-card">
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            {(["3d", "2d"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m.toUpperCase()}</Button>
            ))}
          </div>
          {mode === "3d"
            ? <World3D state={s} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} onSelectTile={(x, y) => setTile({ x, y })} />
            : <WorldCanvas state={s} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} onSelectTile={(x, y) => setTile({ x, y })} />}
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {agent && (
            <section className="rounded border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
                <h3>{agent.name}</h3>
                <span className="ml-auto eyebrow">{agent.status}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Position</dt><dd className="figure-num">{agent.x},{agent.y}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Energy</dt><dd className="figure-num">{agent.energy}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Goal</dt><dd>{agent.goal}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Inventory</dt><dd className="figure-num">{Object.entries(agent.inventory).map(([k, v]) => `${k}×${v}`).join(" ") || "empty"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tiles visited</dt><dd className="figure-num">{agent.mind.visited.length}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Rules learned</dt><dd className="figure-num">{agent.mind.rules.length}</dd></div>
              </dl>
            </section>
          )}
          {tileInfo && tile && (
            <section className="rounded border border-border bg-card p-4">
              <h3>Tile {tile.x},{tile.y}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Terrain: {tileInfo.terrain} · Object: {tileInfo.obj ?? "none"}
                {tileInfo.obj === "berry" && ` · charges ${tileInfo.charges}`}
              </p>
            </section>
          )}
          <section className="min-h-0 flex-1 rounded border border-border bg-card p-4">
            <p className="eyebrow">Event feed</p>
            <ul className="mt-2 space-y-1.5 overflow-y-auto text-sm">
              {[...ctrl.events].reverse().slice(0, 40).map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="figure-num shrink-0 text-muted-foreground">{e.step}</span>
                  <span className={e.kind === "discovery" ? "text-primary" : ""}>{e.message}</span>
                </li>
              ))}
              {ctrl.events.length === 0 && <li className="text-muted-foreground">Press play — events appear as agents act.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
