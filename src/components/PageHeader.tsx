import type { ReactNode } from "react";

export function PageHeader({ section, title, children }: { section: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 border-b border-foreground pb-5">
      <p className="eyebrow">{section}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-l border-border pl-3">
      <p className="eyebrow">{label}</p>
      <p className="figure-num mt-1 text-xl">{value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" ? "text-success border-success" :
    status === "running" ? "text-primary border-primary animate-pulse" :
    status === "failed" ? "text-destructive border-destructive" : "text-muted-foreground border-border";
  return <span className={`figure-num inline-block border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider ${tone}`}>{status}</span>;
}
