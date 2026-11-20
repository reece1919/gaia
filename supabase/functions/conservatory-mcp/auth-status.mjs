// Decode non-secret session *metadata* for UX, never authorization.
// The MCP middleware plus auth.getUser() verify the bearer token cryptographically;
// database ownership and AAL2 are enforced by existing PostgreSQL RLS.
export function describeBearerSession(header) {
  const token = typeof header === "string" ? /^Bearer\s+([^\s]+)$/i.exec(header)?.[1] : null;
  if (!token) return { assuranceLevel: "unknown", hasSubject: false };
  const segments = token.split(".");
  if (segments.length !== 3) return { assuranceLevel: "unknown", hasSubject: false };
  try {
    const payload = JSON.parse(atob(segments[1].replace(/-/g, "+").replace(/_/g, "/")));
    const aal = payload?.aal;
    return {
      assuranceLevel: aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : "unknown",
      hasSubject: typeof payload?.sub === "string" && payload.sub.length > 0,
    };
  } catch {
    return { assuranceLevel: "unknown", hasSubject: false };
  }
}
