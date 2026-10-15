/* GAIA — read-only GAIA insights.
   Reads private GAIA AI review records from the owner's Supabase session.
   No OpenAI API calls and no writes. AI suggestions never become care history. */
(() => {
  "use strict";
  const panel = document.getElementById("gaia-insights");
  if (!panel) return;

  const stamp = document.getElementById("gaia-insights-stamp");
  const body = document.getElementById("gaia-insights-body");
  const button = document.getElementById("gaia-insights-refresh");
  const status = document.getElementById("gaia-insights-status");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const MAX_PRIORITIES = 5;
  let client = null, user = null, latest = null;
  let busy = false, error = "", sequence = 0, lastCheckedAt = 0;

  function dateText(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "Undated";
    const [year,month,day] = date.split("-").map(Number);
    const value = new Date(year, month-1, day);
    if (value.getFullYear() !== year || value.getMonth() !== month-1 ||
        value.getDate() !== day) return "Undated";
    return new Intl.DateTimeFormat(undefined, {
      month:"short", day:"numeric", year:"numeric"
    }).format(value);
  }

  function validPriorities(raw) {
    let records = raw;
    if (typeof records === "string") {
      try { records = JSON.parse(records); } catch (_) { return []; }
    }
    if (!Array.isArray(records)) return [];
    const names = new Map((window.GAIA_DATA?.plants || [])
      .map(plant => [String(plant.id), String(plant.name)]));
    return records.slice(0,MAX_PRIORITIES).map(priority => {
      if (typeof priority === "string")
        return {title:priority.trim().slice(0,300), rationale:"", plant:""};
      if (!priority || typeof priority !== "object" || Array.isArray(priority))
        return null;
      const title = String(priority.title || priority.action || priority.task || "").trim().slice(0,300);
      const rationale = String(priority.rationale || priority.reason ||
        priority.detail || priority.description || "").trim().slice(0,1200);
      const id = priority.plant_id == null ? "" : String(priority.plant_id);
      return {title,rationale,plant:names.get(id)||""};
    }).filter(p => p && p.title);
  }

  function renderUnifiedPriorities() {
    const target=document.getElementById("gaia-unified-priority-list");
    if(!target)return;
    if(!client||!user){target.textContent="Sign in to see private recommendations.";return;}
    if(!latest){target.textContent=busy?"Loading latest review…":"No suggested priorities saved yet.";return;}
    const priorities=validPriorities(latest.priorities);
    target.innerHTML=priorities.length?
      '<p class="gaia-source">From GAIA review · '+esc(dateText(latest.review_date))+'</p><ol>'+
      priorities.map(p=>'<li><strong>'+esc(p.title)+'</strong>'+
        (p.plant?' <small>· '+esc(p.plant)+'</small>':'')+
        (p.rationale?'<p>'+esc(p.rationale)+'</p>':'')+'</li>').join("")+
      '</ol><p class="gaia-source">Recommendations only; check the task list above before acting.</p>':
      '<p>No suggested priorities in the latest review.</p>';
  }
  function render() {
    renderUnifiedPriorities();
    button.disabled = busy || !client || !user;
    button.textContent = busy ? "Checking…" : "Refresh notes";
    status.classList.toggle("gaia-insights-error", Boolean(error));

    if (!client || !user) {
      stamp.textContent = "Private notes · sign in";
      body.innerHTML =
        '<p class="gaia-insights-empty">Sign in using <strong>Sync, account &amp; backup</strong> ' +
        'at the bottom of GAIA to read your private GAIA insights.</p>';
      status.textContent = "Reviews are stored privately. This website does not contact an AI service.";
      return;
    }

    if (latest) {
      stamp.textContent = "Last saved · " + dateText(latest.review_date);
      const priorities = validPriorities(latest.priorities);
      body.innerHTML =
        '<div class="gaia-insights-meta"><span class="gaia-insights-seal">GAIA’S NOTES</span>' +
          '<time datetime="' + esc(latest.review_date || "") + '">' +
          esc(dateText(latest.review_date)) + '</time></div>' +
        '<p class="gaia-insights-summary">' + esc(latest.summary || "") + '</p>' +
        (latest.evidence ?
          '<details class="gaia-insights-evidence"><summary>Evidence &amp; uncertainties</summary>' +
          '<p>' + esc(latest.evidence) + '</p></details>' : '') +
        '<p class="gaia-insights-disclaimer">AI-generated suggestions, not confirmed care events. ' +
          'Check actual plant and soil conditions before acting.</p>';
    } else {
      stamp.textContent = busy ? "Checking saved reviews…" : "Awaiting first review";
      body.innerHTML =
        '<p class="gaia-insights-empty">No GAIA review has been saved to this account yet. ' +
          'The hourly ChatGPT watch is scheduled, but a review appears here only after ' +
          'it successfully verifies your account and saves findings.</p>' +
        '<p class="gaia-insights-disclaimer">Nothing is invented to fill this space; ' +
          'your existing plant cards, tasks and journal remain unchanged.</p>';
    }
    if (error) status.textContent = "Could not refresh private notes: " + error;
    else if (busy) status.textContent = "Reading your saved review from GAIA…";
    else status.textContent = "Read-only · synced from your private GAIA account" +
      (lastCheckedAt ? " · checked just now" : "");
  }

  async function refresh() {
    if (!client || !user || busy) return;
    const seq = ++sequence, owner = user.id;
    busy = true;
    error = "";
    render();
    try {
      const {data, error:queryError} = await client.from("gaia_ai_reviews")
        .select("id,review_date,summary,priorities,evidence,source,created_at,updated_at")
        .eq("user_id",owner)
        .order("review_date",{ascending:false})
        .limit(1);
      if (queryError) throw queryError;
      if (seq !== sequence || user?.id !== owner) return;
      latest = Array.isArray(data) && data.length ? data[0] : null;
      lastCheckedAt = Date.now();
    } catch (cause) {
      if (seq === sequence && user?.id === owner)
        error = cause?.message || "Please check your connection.";
    } finally {
      if (seq === sequence) {busy = false;render();}
    }
  }

  function onAuth(value) {
    const nextUser = value?.user || null;
    const nextClient = value?.client || null;
    const changed = (nextUser?.id || "") !== (user?.id || "") ||
      (Boolean(nextClient) !== Boolean(client));
    user = nextUser;
    client = nextClient;
    if (changed) {
      ++sequence;
      latest = null;
      error = "";
      lastCheckedAt = 0;
      busy = false;
    }
    render();
    if (client && user && !busy && (changed || !lastCheckedAt))
      void refresh();
  }

  document.addEventListener("gaia:auth", event => onAuth(event.detail));
  document.addEventListener("gaia:care-synced", () => {
    if (client && user && !busy && Date.now()-lastCheckedAt > 60*1000)
      void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && client && user && !busy &&
        Date.now()-lastCheckedAt > 60*1000) void refresh();
  });
  button.addEventListener("click", () => void refresh());
  if (window.GAIA_CLOUD) onAuth(window.GAIA_CLOUD);
  render();
})();