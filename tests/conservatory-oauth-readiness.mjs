// Public, read-only readiness probe. Reports only status and public key algorithms.
// It never uses a user's token, password, service key, or personal plant data.
const root = "https://zdurujqwhxqrwbhwzzxg.supabase.co";
const urls = {
  jwks: root + "/auth/v1/.well-known/jwks.json",
  discovery: root + "/.well-known/oauth-authorization-server/auth/v1",
  consent: "https://reece1919.github.io/gaia/oauth/consent/",
  home: "https://reece1919.github.io/gaia/",
  sdk: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.1",
  mcpMetadata: root + "/functions/v1/conservatory-mcp/oauth-protected-resource",
};
async function check(name, url) {
  try {
    const result = await fetch(url, {signal: AbortSignal.timeout(12000), redirect: "follow", headers: {"accept":"application/json, text/html"}});
    let detail = "";
    if (name === "jwks" && result.ok) {
      const body=await result.json();
      const algorithms=[...new Set((body.keys || []).map(k=>k.alg || k.kty || "unspecified"))];
      detail="keys="+(body.keys || []).length+", algorithms="+algorithms.join(",");
      if (!(body.keys || []).some(k=>["RSA","EC","OKP"].includes(k.kty))) detail += "; ASYMMETRIC SIGNING KEY NOT PUBLISHED";
    } else if(name==="discovery" && result.ok){
      const body=await result.json();
      detail="issuer="+String(body.issuer || "not supplied");
    } else if(name==="consent" && result.ok){
      const body=await result.text();
      detail=body.includes("Authorize a connection") ? "CONSENT PAGE PUBLISHED" : "PAGE FOUND, CONTENT NOT VERIFIED";
    }
    console.log(name+": HTTP "+result.status+(detail?"; "+detail:""));
  }catch(err) {
    console.log(name+": request failed ("+err.name+")");
  }
}
await Promise.all(Object.entries(urls).map(([name,url])=>check(name,url)));

// Verify the deployed function rejects unauthenticated MCP tool traffic.
// The gateway must allow discovery through, but middleware must never expose tools.
const endpoint = root + "/functions/v1/conservatory-mcp";
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"content-type":"application/json","accept":"application/json, text/event-stream"},
    body: JSON.stringify({
      jsonrpc:"2.0",id:1,method:"initialize",
      params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"security-probe",version:"1"}}
    }),
    signal: AbortSignal.timeout(12000)
  });
  const challenge=response.headers.get("www-authenticate") || "";
  console.log("unauthenticated_mcp: HTTP "+response.status+", challenge="+(challenge ? "present" : "missing"));
  if(response.status!==401 || !challenge.toLowerCase().includes("bearer")) {
    console.error("SECURITY CHECK FAILED: protected MCP endpoint did not return a bearer 401.");
    process.exitCode=1;
  }
}catch(e){
  console.error("SECURITY CHECK FAILED: MCP endpoint unreachable ("+e.name+").");
  process.exitCode=1;
}

