import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorlds from "./tools/list-worlds";
import listKnowledge from "./tools/list-knowledge";
import listExperiments from "./tools/list-experiments";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "world-model",
  title: "World Model",
  version: "0.1.0",
  instructions:
    "Read-only access to your Genesis simulation data: worlds, rules agents learned, and recorded experiments. All data is measured simulation output.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWorlds, listKnowledge, listExperiments],
});
