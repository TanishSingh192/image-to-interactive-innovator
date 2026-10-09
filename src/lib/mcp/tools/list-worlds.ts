import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_worlds",
  title: "List worlds",
  description: "List your Genesis simulation worlds with seed, clock and status.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10).describe("Maximum worlds to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("genesis_worlds")
      .select("id,name,seed,clock,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const worlds = (data ?? []).map((w) => ({
      id: w.id, name: w.name, seed: w.seed, clock: w.clock, status: w.status,
      created_at: w.created_at, updated_at: w.updated_at,
    }));
    return { content: [{ type: "text", text: JSON.stringify(worlds) }], structuredContent: { worlds } };
  },
});
