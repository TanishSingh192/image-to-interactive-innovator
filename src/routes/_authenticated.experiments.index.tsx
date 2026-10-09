import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { useExperiments } from "@/lib/queries";
import { agentById, envName } from "@/lib/lab";

export const Route = createFileRoute("/_authenticated/experiments/")({
  head: () => ({
    meta: [
      { title: "Experiments — AI Benchmarking Lab" },
      { name: "description", content: "All experiments, their configuration and status." },
      { property: "og:title", content: "Experiments — AI Benchmarking Lab" },
      { property: "og:description", content: "Browse queued, running and completed experiments." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data = [], isLoading } = useExperiments(3000);
  return (
    <>
      <PageHeader section="§0 Index" title="Experiments">
        <Button asChild><Link to="/experiments/new">New experiment</Link></Button>
      </PageHeader>
      {isLoading ? <p className="eyebrow">Loading…</p> : data.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center">
          <p className="font-serif text-lg italic">No experiments yet.</p>
          <Button asChild className="mt-4"><Link to="/experiments/new">Design your first experiment</Link></Button>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-foreground text-left">
            {["Name", "Agents", "Environments", "Budget", "Status", "Created", ""].map((h) => <th key={h} className="eyebrow py-2 pr-3 font-normal">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id} className="border-b border-border align-top">
                <td className="py-3 pr-3"><p className="font-serif">{e.name}</p><p className="text-xs text-muted-foreground line-clamp-1">{e.hypothesis}</p></td>
                <td className="py-3 pr-3 text-xs">{e.agents.map((a) => agentById(a)?.name).join(", ")}</td>
                <td className="py-3 pr-3 text-xs">{e.environments.map(envName).join(", ")}</td>
                <td className="figure-num py-3 pr-3">{e.action_budget}</td>
                <td className="py-3 pr-3"><StatusBadge status={e.status} /></td>
                <td className="figure-num py-3 pr-3 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                <td className="py-3 text-right text-xs">
                  {e.status === "running" ? <Link className="underline" to="/live" search={{ exp: e.id }}>Watch</Link>
                    : <Link className="underline" to="/compare" search={{ exp: e.id }}>Results</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
