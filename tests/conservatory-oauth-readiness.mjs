// Public, read-only readiness probe. Reports only status and public key algorithms.
// It never uses a user's token, password, service key, or personal plant data.
const root = "https://zdurujqwhxqrwbhwzzxg.supabase.co";
const urls = {
  jwks: root + "/auth/v1/.well-known/jwks.json",
  discovery: root + "/.well-known/oauth-authorization-server/auth/v1",
  consent: "https://reece1919.github.io/gaia/oauth/consent/",
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
