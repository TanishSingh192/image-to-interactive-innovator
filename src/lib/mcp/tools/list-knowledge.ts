import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_knowledge",
  title: "List learned rules",
  description: "List rules agents learned in a world, with kind, confidence and evidence.",
  inputSchema: {
    world_id: z.string().uuid().describe("World id from list_worlds."),
    kind: z.enum(["confirmed", "hypothesis", "incorrect"]).optional().describe("Filter by rule status."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rules to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ world_id, kind, limit }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("genesis_knowledge")
      .select("rule,kind,confidence,evidence,discovery_step,shared,agent_id")
      .eq("world_id", world_id)
      .order("evidence", { ascending: false })
      .limit(limit);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rules = (data ?? []).map((r) => ({
      rule: r.rule, kind: r.kind, confidence: r.confidence, evidence: r.evidence,
      discovery_step: r.discovery_step, shared: r.shared, agent_id: r.agent_id,
    }));
    return { content: [{ type: "text", text: JSON.stringify(rules) }], structuredContent: { rules } };
  },
});
