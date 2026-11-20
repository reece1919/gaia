/* Conservatory MCP: user-scoped OAuth server.
 * Private care uses Supabase Auth and owner-only PostgreSQL RLS.
 * The middleware uses the caller's JWT, never a service key.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { z } from "npm:zod@^4.3.6";
import { describeBearerSession } from "./auth-status.mjs";

const catalogUrl = "https://reece1919.github.io/gaia/plants.json";
type PublicPlant = { id?: string; name?: string; species?: string };
function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}
async function readCatalog(): Promise<PublicPlant[]> {
  const response = await fetch(catalogUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("The plant catalog could not be loaded.");
  const result = await response.json();
  if (!result || !Array.isArray(result.plants)) throw new Error("Invalid plant catalog.");
  // Whitelist only identification fields. Do not forward public-history notes,
  // photos or other fields merely because they are in plants.json.
  return result.plants.map((p: PublicPlant) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? "").slice(0, 100),
    species: String(p.species ?? "").slice(0, 200),
  })).filter((p: PublicPlant) => p.id && p.name);
}

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
    async (request, { supabase }) => {
      const handler = createMcpHandler(() => {
        const mcp = new McpServer({ name: "conservatory", version: "0.2.0" });
        // Read-only diagnostic. Never expose bearer tokens, user IDs, emails,
        // MFA factors, or session IDs through this tool.
        mcp.registerTool("get_connection_status", {
          title: "Check Conservatory sign-in",
          description: "Reports whether the OAuth connection has a verified Supabase user session. MFA is optional for plant-care records. Returns no personal records.",
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        }, async () => {
          const authorization = request.headers.get("authorization") || "";
          const jwt = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
          if (!jwt) throw new Error("No OAuth bearer session was provided.");
          // Verify the supplied bearer against Supabase Auth. The decoded claims
          // are descriptive only and are never used as authorization.
          const { data, error } = await supabase.auth.getUser(jwt);
          if (error || !data?.user) throw new Error("The OAuth session could not be verified.");
          const state = describeBearerSession(authorization);
          return {
            content: [{ type: "text", text: JSON.stringify({
              authenticated: true,
              assurance_level: state.assuranceLevel,
              mfa_required_for_private_care: false,
              signed_in_identity_present: state.hasSubject,
            }) }],
          };
        });

        mcp.registerTool("search_plants", {
          title: "Search plants in The Conservatory",
          description: "Find plant IDs and names from the published Conservatory catalog. Only identification fields are returned; private care details require a separate authenticated tool.",
          inputSchema: z.object({
            query: z.string().trim().max(100).default(""),
            limit: z.number().int().min(1).max(30).default(10),
          }),
          annotations: { readOnlyHint: true },
        }, async ({ query, limit }) => {
          const plants = await readCatalog();
          const q = normalized(query);
          const matches = plants.filter((p) =>
            !q || normalized(p.name ?? "").includes(q) ||
            normalized(p.species ?? "").includes(q) ||
            p.id === q
          ).slice(0, limit);
          return { content: [{ type: "text", text: JSON.stringify(matches) }] };
        });

        mcp.registerTool("get_care_history", {
          title: "Read private care history",
          description: "Read private care history for an exact plant ID using the signed-in user's owner-only Supabase row-level permissions.",
          inputSchema: z.object({
            plant_id: z.string().regex(/^\d{2,3}$/),
            limit: z.number().int().min(1).max(100).default(20),
          }),
          annotations: { readOnlyHint: true },
        }, async ({ plant_id, limit }) => {
          const { data, error } = await supabase
            .from("plant_care_events")
            .select("id,plant_id,action_type,happened_on,note,created_at")
            .eq("plant_id", plant_id)
            .order("happened_on", { ascending: false })
            .limit(limit);
          if (error) throw new Error("Private care history is unavailable. Check the signed-in account and owner permissions.");
          return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
        });
        return mcp;
      });
      return handler.fetch(request);
    },
  ),
);
