import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

const NAV = [
  { to: "/experiments", n: "§0", label: "Experiments" },
  { to: "/experiments/new", n: "§1", label: "Setup" },
  { to: "/live", n: "§2", label: "Live runs" },
  { to: "/compare", n: "§3", label: "Comparison" },
  { to: "/replay", n: "§4", label: "Replay" },
  { to: "/export", n: "§5", label: "Export" },
] as const;

function Layout() {
  const { session, loading, user } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !session) nav({ to: "/auth" }); }, [loading, session, nav]);
  if (!session) return <div className="p-10 eyebrow">Loading…</div>;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border bg-sidebar p-5 md:min-h-screen md:border-b-0 md:border-r">
        <Link to="/" className="block font-serif text-lg leading-tight">AI Benchmarking<br /><em className="text-primary">Lab</em></Link>
        <nav className="mt-8 flex flex-wrap gap-1 md:flex-col">
          {NAV.map((i) => (
            <Link key={i.to} to={i.to} activeOptions={{ exact: true }}
              className="flex gap-3 px-2 py-1.5 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-semibold" }}>
              <span className="figure-num text-primary">{i.n}</span>{i.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 hidden md:block">
          <p className="eyebrow truncate">{user?.email}</p>
          <button className="mt-2 text-xs underline underline-offset-4" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl p-6 md:p-10"><Outlet /></main>
    </div>
  );
}
