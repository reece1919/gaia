/* OAuth approval remains an explicit user action. No tokens are sent to ChatGPT by this page. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const status = byId("status");
  const login = byId("login-needed");
  const decision = byId("decision");
  const approve = byId("approve");
  const deny = byId("deny");
  const retry = byId("retry");
  const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
  let client;
  let pending = false;

  function show(message, mode = "status") {
    status.textContent = message;
    login.hidden = mode !== "login";
    decision.hidden = mode !== "decision";
  }
  function safeRedirect(url) {
    if (typeof url !== "string") throw new Error("Authorization redirect is missing.");
    const target = new URL(url);
    if (target.protocol !== "https:") throw new Error("Authorization returned an unsafe redirect.");
    window.location.assign(target.href);
  }
  function busy(value) {
    pending = value;
    approve.disabled = value;
    deny.disabled = value;
    retry.disabled = value;
  }
  async function initialize() {
    if (!authorizationId || authorizationId.length > 512) {
      show("Missing or invalid authorization request. Start the connection from ChatGPT.");
      return;
    }
    if (!window.GAIA_SUPABASE?.url || !window.GAIA_SUPABASE?.anonKey ||
        !window.supabase?.createClient) {
      show("Authentication is unavailable. Return to The Conservatory and try again.");
      return;
    }
    client ||= window.supabase.createClient(
      window.GAIA_SUPABASE.url, window.GAIA_SUPABASE.anonKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } },
    );
    show("Checking your sign-in and MFA…");
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || !identity?.user) {
      show("Sign in to The Conservatory, then return here to continue.", "login");
      return;
    }
    const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (levelError || level?.currentLevel !== "aal2") {
      byId("login-help").textContent =
        "Your session needs authenticator verification (AAL2). Finish it in The Conservatory, then return and check again.";
      show("MFA verification is required before granting access.", "login");
      return;
    }
    if (typeof client.auth.oauth?.getAuthorizationDetails !== "function") {
      show("The OAuth client library is not ready. Please update this page and try again.");
      return;
    }
    const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) {
      show("This authorization request cannot be verified. Start again from ChatGPT.");
      return;
    }
    if ("redirect_url" in data && !("authorization_id" in data)) {
      // An existing user grant may already be active. Still require MFA above.
      safeRedirect(data.redirect_url);
      return;
    }
    byId("client-name").textContent = String(data.client?.name || "An application");
    byId("scope").textContent = String(data.scope || "(none specified)");
    byId("return-uri").textContent = String(data.redirect_uri || "Provided by your OAuth provider");
    show("Review the client and its requested permissions.", "decision");
  }
  async function decide(allow) {
    if (pending) return;
    busy(true);
    try {
      // Consent must always be the result of a real Approve/Deny button click.
      const method = allow ? "approveAuthorization" : "denyAuthorization";
      const { data, error } = await client.auth.oauth[method](authorizationId);
      if (error || !data) throw new Error("The authorization request could not be completed.");
      safeRedirect(data.redirect_url);
    } catch (err) {
      show(err?.message || "The request failed. Please retry.", "decision");
      busy(false);
    }
  }
  approve.addEventListener("click", () => { void decide(true); });
  deny.addEventListener("click", () => { void decide(false); });
  retry.addEventListener("click", () => { void initialize().catch(() =>
    show("Session verification failed. Please try again.", "login")); });
  void initialize().catch(() => show("Authorization could not be checked. Start again from ChatGPT."));
})();
