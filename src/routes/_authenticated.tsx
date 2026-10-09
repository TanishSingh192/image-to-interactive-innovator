import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

const NAV = [
  { to: "/world", n: "§1", label: "World" },
  { to: "/agents", n: "§2", label: "Agents" },
  { to: "/world-model", n: "§3", label: "World Model" },
  { to: "/civilization", n: "§4", label: "Civilization" },
  { to: "/experiments", n: "§5", label: "Experiments" },
  { to: "/analytics", n: "§6", label: "Analytics" },
  { to: "/settings", n: "§7", label: "Settings" },
] as const;

function Layout() {
  const { session, loading, user } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !session) nav({ to: "/auth" }); }, [loading, session, nav]);
  if (!session) return <div className="p-10 eyebrow">Loading…</div>;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border bg-sidebar p-5 md:min-h-screen md:border-b-0 md:border-r">
        <Link to="/" className="block font-serif text-lg leading-tight">Genesis<br /><em className="text-primary">World Model Lab</em></Link>
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
      <main className="w-full p-4 md:p-8"><Outlet /></main>
    </div>
  );
}
