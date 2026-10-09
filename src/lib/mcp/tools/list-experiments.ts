import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_experiments",
  title: "List experiments",
  description: "List your recorded Genesis experiments with hypothesis, status and measured results.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10).describe("Maximum experiments to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("genesis_experiments")
      .select("id,name,hypothesis,seed,status,results,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  },
});
