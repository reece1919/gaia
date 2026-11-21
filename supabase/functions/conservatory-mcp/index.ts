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
import { saveVerifiedCareEvent } from "./write-care.mjs";
import { getPropagationNursery, createPropagationBatch, createPropagationCutting, updatePropagationCutting, METHODS, STAGES, DESTINATIONS } from "./propagation-tools.mjs";

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
        const mcp = new McpServer({ name: "conservatory", version: "0.4.0" });
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
        // Only explicit, completed-care requests should invoke this tool.
        // The stable caller-provided UUID makes retries idempotent. Ownership
        // comes only from the verified Supabase Auth session, never the model.
        mcp.registerTool("record_care_event", {
          title: "Record a plant care event",
          description: "Record ONE completed action in the signed-in owner's Conservatory journal. Only invoke when the user explicitly asks to log completed care. Confirm the plant ID and date; do not log future plans. Provide a unique v4 UUID as id for each new action and reuse it for retries. Returns the exact saved record after a database read-back. Requires login; MFA is optional for plant care.",
          inputSchema: z.object({
            id: z.string().uuid(),
            plant_id: z.string().regex(/^\d{2,3}$/),
            action_type: z.enum(["prune","fertilize","repot","pest","bath","inspect","water","note"]),
            happened_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            note: z.string().max(1000).default(""),
          }),
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
        }, async ({ id, plant_id, action_type, happened_on, note }) => {
          // en-CA is ordinarily YYYY-MM-DD; build explicitly to avoid runtime
          // locale-dependent variations when checking the date.
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Los_Angeles", year: "numeric",
            month: "2-digit", day: "2-digit",
          }).formatToParts(new Date());
          const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
          const today = part("year") + "-" + part("month") + "-" + part("day");
          const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
          if (!bearer) throw new Error("A signed-in Conservatory session is required.");
          const {data: identity, error: identityError} = await supabase.auth.getUser(bearer);
          if (identityError || !identity?.user) throw new Error("The connected account session could not be verified.");

          const saved = await saveVerifiedCareEvent({
            entry: {id, plant_id, action_type, happened_on, note},
            today,
            userId: identity.user.id,
            catalog: await readCatalog(),
            db: supabase,
          });
          return {content:[{type:"text",text:JSON.stringify(saved)}]};
        });


        // The Nursery already exists in GAIA. Keep its existing owner + AAL2
        // RLS policies intact, unlike the lower-sensitivity care journal.
        // The decoded assurance label is only an early UX check; PostgreSQL
        // RLS is the authorization boundary for all Nursery reads/writes.
        async function nurseryOwner() {
          const authorization=request.headers.get("authorization")||"";
          const bearer=/^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
          if(!bearer) throw Error("Sign in to The Conservatory to access the private Nursery.");
          const {data,error}=await supabase.auth.getUser(bearer);
          if(error||!data?.user) throw Error("The Conservatory session could not be verified.");
          if(describeBearerSession(authorization).assuranceLevel!=="aal2")
            throw Error("The private Propagation Nursery still requires authenticator MFA (AAL2). Complete verification in your Conservatory account.");
          return data.user.id;
        }
        function localToday() {
          const parts=new Intl.DateTimeFormat("en-US",{
            timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"
          }).formatToParts(new Date());
          const get=(key:string)=>parts.find(p=>p.type===key)?.value??"";
          return get("year")+"-"+get("month")+"-"+get("day");
        }

        mcp.registerTool("get_propagation_nursery",{
          title:"Read the private propagation nursery",
          description:"Read the signed-in owner's existing propagation batches and individually tracked cuttings, including exact IDs and timestamps needed for safe updates. Requires AAL2 authenticator MFA. An empty result must not be interpreted as an empty Nursery when MFA has not been verified.",
          inputSchema:z.object({limit:z.number().int().min(1).max(100).default(30)}),
          annotations:{readOnlyHint:true}
        },async({limit})=>{
          const result=await getPropagationNursery({db:supabase,userId:await nurseryOwner(),limit});
          return {content:[{type:"text",text:JSON.stringify(result)}]};
        });

        mcp.registerTool("start_propagation_batch",{
          title:"Record a propagation batch",
          description:"Record ONE propagation batch the owner already started; not a future plan. Use a new UUID v4 id for each distinct batch and reuse it on retries. The optional parent ID must already exist in the permanent plant catalog. Saves to the existing GAIA Nursery, not the permanent collection. Requires AAL2 authenticator MFA and database read-back.",
          inputSchema:z.object({
            id:z.string().uuid(),
            label:z.string().trim().min(1).max(100),
            parent_plant_id:z.string().regex(/^\d{2,3}$/).nullable().optional(),
            method:z.enum(METHODS).default("soil"),
            started_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            notes:z.string().max(1500).default("")
          }),
          annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}
        },async(entry)=>{
          const result=await createPropagationBatch({
            db:supabase,userId:await nurseryOwner(),entry,today:localToday(),catalog:await readCatalog()
          });
          return {content:[{type:"text",text:JSON.stringify(result)}]};
        });

        mcp.registerTool("add_propagation_cutting",{
          title:"Record one cutting in an existing batch",
          description:"Record ONE real cutting in an existing, owner-owned propagation batch. A cutting is not a new permanent plant. Use a new UUID v4 id, reuse on retries, and never invent roots or stages. Requires AAL2 authenticator MFA and read-back verification.",
          inputSchema:z.object({
            id:z.string().uuid(),
            batch_id:z.string().uuid(),
            nickname:z.string().max(100).default(""),
            stage:z.enum(STAGES).default("cutting"),
            destination:z.enum(DESTINATIONS).default("undecided"),
            notes:z.string().max(1500).default("")
          }),
          annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}
        },async(entry)=>{
          const result=await createPropagationCutting({db:supabase,userId:await nurseryOwner(),entry});
          return {content:[{type:"text",text:JSON.stringify(result)}]};
        });

        mcp.registerTool("update_propagation_cutting",{
          title:"Update an existing cutting's observed progress",
          description:"Update one existing cutting's actual stage, destination, dates or notes. Read the Nursery first and supply the exact expected_updated_at to prevent overwriting newer changes. Never infer rooting or establish a permanent collection plant automatically. Reuse the same input on retry. Requires AAL2 authenticator MFA and read-back verification.",
          inputSchema:z.object({
            id:z.string().uuid(),
            expected_updated_at:z.string(),
            nickname:z.string().max(100).optional(),
            stage:z.enum(STAGES).optional(),
            destination:z.enum(DESTINATIONS).optional(),
            rooted_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            potted_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            established_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            linked_plant_id:z.string().regex(/^\d{2,3}$/).nullable().optional(),
            notes:z.string().max(1500).optional()
          }),
          annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}
        },async(entry)=>{
          const result=await updatePropagationCutting({
            db:supabase,userId:await nurseryOwner(),entry,today:localToday(),catalog:await readCatalog()
          });
          return {content:[{type:"text",text:JSON.stringify(result)}]};
        });

        return mcp;
      });
      return handler.fetch(request);
    },
  ),
);
