import { useEffect, useRef, useState } from "react";
import type { WorldState } from "@/lib/genesis/world";
import { isNight } from "@/lib/genesis/world";

const TERRAIN_COLORS: Record<string, string> = {
  grass: "#3d6b35", forest: "#2c5230", water: "#2b5a8a", sand: "#8a7a3c", rock: "#55524a",
};

interface Props {
  state: WorldState;
  selectedAgent: string | null;
  onSelectAgent: (id: string | null) => void;
  onSelectTile: (x: number, y: number) => void;
}

export function WorldCanvas({ state, selectedAgent, onSelectAgent, onSelectTile }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ zoom: 26, ox: 0, oy: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const { width, height } = state.config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const z = view.zoom;

    ctx.fillStyle = "#141310";
    ctx.fillRect(0, 0, parent.clientWidth, parent.clientHeight);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = state.tiles[y]![x]!;
        const px = view.ox + x * z, py = view.oy + y * z;
        ctx.fillStyle = TERRAIN_COLORS[t.terrain]!;
        ctx.fillRect(px, py, z - 1, z - 1);
        if (t.obj === "tree") {
          ctx.fillStyle = "#5fae6e";
          ctx.beginPath();
          ctx.arc(px + z / 2, py + z / 2, z * 0.32, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.obj === "stone") {
          ctx.fillStyle = "#9a958a";
          ctx.fillRect(px + z * 0.3, py + z * 0.3, z * 0.4, z * 0.4);
        } else if (t.obj === "berry") {
          ctx.fillStyle = t.charges > 0 ? "#d4653a" : "#6b4a3a";
          ctx.beginPath();
          ctx.arc(px + z / 2, py + z / 2, z * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const a of state.agents) {
      const px = view.ox + a.x * z + z / 2, py = view.oy + a.y * z + z / 2;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(px, py, z * 0.38, 0, Math.PI * 2);
      ctx.fill();
      if (a.id === selectedAgent) {
        ctx.strokeStyle = "#f7f4ec";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, z * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#141310";
      ctx.font = `bold ${Math.max(9, z * 0.34)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.name[0]!, px, py + 1);
    }

    if (isNight(state)) {
      ctx.fillStyle = "rgba(10, 12, 40, 0.35)";
      ctx.fillRect(0, 0, parent.clientWidth, parent.clientHeight);
    }
  }, [state, view, selectedAgent, width, height]);

  const toTile = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - view.ox) / view.zoom);
    const y = Math.floor((e.clientY - rect.top - view.oy) / view.zoom);
    return { x, y };
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-grab touch-none"
      onWheel={(e) => setView((v) => ({ ...v, zoom: Math.min(60, Math.max(10, v.zoom - Math.sign(e.deltaY) * 3)) }))}
      onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }}
      onMouseMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => ({ ...v, ox: v.ox + dx, oy: v.oy + dy }));
      }}
      onMouseUp={(e) => {
        const moved = drag.current && Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 4;
        drag.current = null;
        if (moved) return;
        const { x, y } = toTile(e);
        const agent = state.agents.find((a) => a.x === x && a.y === y);
        if (agent) onSelectAgent(agent.id === selectedAgent ? null : agent.id);
        else if (x >= 0 && y >= 0 && x < width && y < height) { onSelectAgent(null); onSelectTile(x, y); }
      }}
      onMouseLeave={() => { drag.current = null; }}
    />
  );
}
