import { createClient } from "npm:@supabase/supabase-js@2.57.0";
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/.test(auth)) return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return new Response("Configuration unavailable", { status: 503 });
  const client = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: identity, error: identityError } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (identityError || !identity.user) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const id = (body && typeof body === "object" && "photo_id" in body) ? (body as {photo_id:unknown}).photo_id : null;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid photo_id", { status: 400 });
  const { data: photo, error } = await client.from("plant_photos").select("id,user_id,object_path").eq("id",id).eq("user_id",identity.user.id).maybeSingle();
  if (error) return new Response("Photo lookup failed", { status: 500 });
  if (!photo || !photo.object_path.startsWith(identity.user.id + "/")) return new Response("Not found", { status: 404 });
  const { data, error: signedError } = await client.storage.from("gaia-plant-photos").createSignedUrl(photo.object_path, 60);
  if (signedError || !data?.signedUrl) return new Response("Photo access failed", { status: 502 });
  return new Response(JSON.stringify({ photo_id: photo.id, signed_url: data.signedUrl, expires_in: 60 }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
});