export function ArcGrid({ grid, size = 20 }: { grid: number[][]; size?: number }) {
  if (!grid?.length) return null;
  return (
    <div
      className="inline-grid gap-px border border-foreground bg-foreground p-px"
      style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${size}px)` }}
    >
      {grid.flat().map((v, i) => (
        <div key={i} style={{ width: size, height: size, background: `var(--arc-${v})` }} />
      ))}
    </div>
  );
}
