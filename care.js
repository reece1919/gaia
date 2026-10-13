/* GAIA care journal. Local-first entries; optional Supabase auth and sync. */
(() => {
  "use strict";
  const BASE_KEY = "gaia-care-journal-v1";
  const ACTIONS = {
    water: "Watered",
    fertilize: "Fertilized",
    repot: "Repotted",
    pest: "Pest treatment",
    bath: "Foliage bath",
    inspect: "Inspected",
    prune: "Pruned",
    note: "Observation"
  };
  const root = document.getElementById("care-overview");
  if (!root) return;
  const config = window.GAIA_SUPABASE || {};
  let cloudReady = false;
  let connecting = true;
  let db = null;
  let user = null;
  let plants = [];
  let local = [];
  let remote = [];
  let busy = false;
  let notice = "";
  let noticeError = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const today = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")].join("-");
  };
  function dateLabel(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return s || "Date unknown";
    const parts = s.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric", year: "numeric"})
      .format(new Date(parts[0], parts[1] - 1, parts[2]));
  }
  function uniqueId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }
  function key() {
    return user ? BASE_KEY + "-user-" + user.id : BASE_KEY + "-device";
  }
  function readKey(storageKey) {
    try {
      const a = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(a) ? a.filter(e => e && e.id && e.plant_id && ACTIONS[e.action_type]) : [];
    } catch (_) {
      alertNotice("Saved browser journal could not be opened.", true);
      return [];
    }
  }
  function saveLocal() {
    try {
      localStorage.setItem(key(), JSON.stringify(local));
      return true;
    } catch (_) {
      alertNotice("Browser storage is unavailable; your entry may not survive a refresh. Export a backup.", true);
      return false;
    }
  }
  function alertNotice(value, error = false) {
    notice = value;
    noticeError = error;
    const p = document.getElementById("care-message");
    if (p) {
      p.hidden = !notice;
      p.textContent = notice;
      p.classList.toggle("care-error", error);
    }
  }
  function allEvents() {
    const seen = new Map();
    remote.forEach(e => seen.set(e.id, e));
    local.forEach(e => seen.set(e.id, e));
    return [...seen.values()].sort((a, b) =>
      (b.happened_on || "").localeCompare(a.happened_on || "") ||
      (b.created_at || "").localeCompare(a.created_at || ""));
  }
  function eventHtml(e) {
    const pending = cloudReady && user && !e.synced;
    return '<li class="care-entry-row"><div><strong>' + esc(ACTIONS[e.action_type]) + '</strong> ' +
      '<time datetime="' + esc(e.happened_on) + '">' + esc(dateLabel(e.happened_on)) + '</time>' +
      (pending ? ' <small class="care-pending">Pending sync</small>' : "") +
      (e.note ? '<div class="care-entry-note">' + esc(e.note) + '</div>' : "") +
      '</div><button type="button" class="care-undo" data-care-delete="' + esc(e.id) +
      '" aria-label="Remove care entry">Undo</button></li>';
  }
  function panelHtml(p) {
    const quick = ["water", "fertilize", "repot", "pest"].map(action =>
      '<button type="button" data-care-quick="' + action + '">' + esc(ACTIONS[action]) + '</button>').join("");
    const opts = Object.entries(ACTIONS).map(([action, label]) =>
      '<option value="' + action + '">' + esc(label) + '</option>').join("");
    return '<section class="care-tracker" data-care-plant="' + esc(p.id) + '">' +
      '<div class="care-tracker-heading"><strong>Care journal</strong><span class="care-latest">Nothing logged yet</span></div>' +
      '<div class="care-quick-actions">' + quick + '</div>' +
      '<details class="care-more"><summary>Add dated entry or note</summary>' +
      '<form class="care-log-form"><div class="care-fields">' +
      '<label>Date<input name="date" type="date" required value="' + today() + '"></label>' +
      '<label>Activity<select name="action">' + opts + '</select></label></div>' +
      '<label>Notes<textarea name="note" rows="2" maxlength="1000" placeholder="Optional details about what you did or noticed"></textarea></label>' +
      '<button type="submit" class="care-submit">Save journal entry</button></form></details>' +
      '<div class="care-list-heading">Recorded care <span class="care-count-label"></span></div>' +
      '<ol class="care-event-list"></ol></section>';
  }
  function renderJournal() {
    const items = allEvents();
    document.querySelectorAll(".care-tracker").forEach(panel => {
      const selected = items.filter(e => e.plant_id === panel.dataset.carePlant);
      panel.querySelector(".care-latest").textContent = selected.length
        ? ACTIONS[selected[0].action_type] + " · " + dateLabel(selected[0].happened_on)
        : "Nothing logged yet";
      panel.querySelector(".care-count-label").textContent =
        selected.length + (selected.length === 1 ? " entry" : " entries");
      panel.querySelector(".care-event-list").innerHTML = selected.length
        ? selected.slice(0, 20).map(eventHtml).join("")
        : '<li class="care-no-entries">No care entries recorded here yet.</li>';
    });
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const start = [sevenDaysAgo.getFullYear(), String(sevenDaysAgo.getMonth() + 1).padStart(2,"0"),
      String(sevenDaysAgo.getDate()).padStart(2,"0")].join("-");
    const recent = items.filter(e => e.happened_on >= start && e.happened_on <= today()).length;
    document.getElementById("care-action-count").textContent =
      items.length + (items.length === 1 ? " action" : " actions") + " logged · " + recent + " in 7 days";
    document.getElementById("care-sync-status").textContent = user
      ? busy ? "Syncing…" : "Signed in · sync available"
      : cloudReady ? "Sign in to sync devices"
      : connecting ? "Connecting to cloud…" : "Stored on this device only";
    document.getElementById("care-login-area").hidden = !cloudReady || !!user;
    document.getElementById("care-account-area").hidden = !user;
    document.getElementById("care-import").hidden = !user || !readKey(BASE_KEY + "-device").length;
    document.getElementById("care-user-email").textContent = user?.email || "";
    const sync = document.getElementById("care-sync");
    sync.disabled = busy;
    if (notice) alertNotice(notice, noticeError);
  }
  function mount(plantsArray) {
    if (plants.length) return;
    plants = plantsArray;
    document.querySelectorAll("#grid .card").forEach((card, i) => {
      const plant = plants[i];
      if (plant && card.querySelector(".care")) {
        card.querySelector(".care").insertAdjacentHTML("afterbegin", panelHtml(plant));
      }
    });
    renderJournal();
  }
  async function addEntry(plantId, action, date, note) {
    if (!plants.some(p => p.id === plantId) || !ACTIONS[action] ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date > today() ||
        Number.isNaN(new Date(date + "T12:00:00").getTime())) {
      alertNotice("Please choose a valid activity and date (today or earlier).", true);
      return false;
    }
    const entry = {
      id: uniqueId(), plant_id: plantId, action_type: action, happened_on: date,
      note: String(note || "").trim().slice(0,1000),
      created_at: new Date().toISOString(), synced: false
    };
    local.push(entry);
    const saved = saveLocal();
    alertNotice(ACTIONS[action] + " on " + dateLabel(date) +
      (saved ? user ? " · saved, syncing…" : " · saved on this device." : " · unable to store reliably."), !saved);
    renderJournal();
    if (user && cloudReady) await sync();
    return true;
  }
  async function removeEntry(id) {
    const target = allEvents().find(e => e.id === id);
    if (!target || !window.confirm("Remove this care record?")) return;
    if (user && cloudReady && (target.synced || remote.some(e => e.id === id))) {
      try {
        const { error } = await db.from("plant_care_events").delete().eq("id", id);
        if (error) throw error;
      } catch (e) {
        alertNotice("Could not remove cloud record. Try again when online.", true);
        return;
      }
    }
    local = local.filter(e => e.id !== id);
    remote = remote.filter(e => e.id !== id);
    saveLocal();
    alertNotice("Entry removed.");
    renderJournal();
  }
  async function sync() {
    if (!cloudReady || !user || busy) return;
    busy = true;
    renderJournal();
    try {
      const pending = local.filter(e => !e.synced);
      if (pending.length) {
        const records = pending.map(e => ({
          id: e.id, user_id: user.id, plant_id: e.plant_id, action_type: e.action_type,
          happened_on: e.happened_on, note: e.note || "", created_at: e.created_at
        }));
        const { error } = await db.from("plant_care_events").upsert(records, {onConflict: "id"});
        if (error) throw error;
        const ids = new Set(pending.map(e => e.id));
        local.forEach(e => { if (ids.has(e.id)) e.synced = true; });
        saveLocal();
      }
      const {data, error} = await db.from("plant_care_events")
        .select("id,plant_id,action_type,happened_on,note,created_at")
        .order("happened_on", {ascending:false}).limit(5000);
      if (error) throw error;
      remote = (data || []).filter(e => ACTIONS[e.action_type]).map(e => ({...e, synced:true}));
      const cloudIds = new Set(remote.map(e => e.id));
      // Cloud data is authoritative for previously synced records. Otherwise a
      // record deleted on another device stays visible in the local cache.
      // Keep unsynced work, and avoid pruning if the server result hit its cap.
      local.forEach(e => { if (cloudIds.has(e.id)) e.synced = true; });
      if (remote.length < 5000) {
        local = local.filter(e => !e.synced || cloudIds.has(e.id));
      }
      saveLocal();
      alertNotice("Care journal synced across your signed-in devices.");
    } catch (e) {
      console.error("GAIA care sync", e);
      alertNotice("Cloud sync did not complete: " + (e.message || "Check your connection.") +
        " Your pending entries remain saved on this device.", true);
    } finally {
      busy = false;
      renderJournal();
      document.dispatchEvent(new Event("gaia:care-synced"));
    }
  }
  async function handleAuth(session) {
    const next = session?.user || null;
    if ((next?.id || "") === (user?.id || "")) return;
    user = next;
    local = readKey(key());
    remote = [];
    alertNotice(user ? "Signed in. Loading your private care journal…" :
      "Signed out. Showing this device's local care journal.");
    renderJournal();
    window.GAIA_CLOUD = {client:db, user};
    document.dispatchEvent(new CustomEvent("gaia:auth", {detail:{client:db, user}}));
    if (user) await sync();
  }
  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) {resolve();return;}
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0";
      script.async = true;
      script.onload = () => window.supabase?.createClient ? resolve() : reject(new Error("Supabase library unavailable"));
      script.onerror = () => reject(new Error("Supabase library could not load"));
      document.head.appendChild(script);
    });
  }
  async function setupCloud() {
    if (!config.url || !config.anonKey) {
      connecting = false;
      alertNotice("The GAIA cloud settings have not loaded. Refresh this page to activate email sign-in.", true);
      renderJournal();
      return;
    }
    try {
      await loadSdk();
      db = window.supabase.createClient(config.url, config.anonKey, {
        auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce"}
      });
      cloudReady = true;
      connecting = false;
      const {data, error} = await db.auth.getSession();
      if (error) throw error;
      await handleAuth(data.session);
      window.GAIA_CLOUD = {client:db, user};
    document.dispatchEvent(new CustomEvent("gaia:auth", {detail:{client:db, user}}));
      db.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => { void handleAuth(session); }, 0);
      });
      renderJournal();
    } catch (e) {
      cloudReady = false;
      connecting = false;
      alertNotice("Cloud connection unavailable. Refresh this page, or check whether the browser blocked the Supabase script. Device-only care logging still works.", true);
      renderJournal();
    }
  }

  root.addEventListener("click", async event => {
    if (event.target.id === "care-export") {
      const payload = JSON.stringify({format: "gaia-care-v1", exported_at: new Date().toISOString(), events: allEvents()}, null, 2);
      const blob = new Blob([payload], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gaia-care-backup-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (event.target.id === "care-sync") { await sync(); return; }
    if (event.target.id === "care-signout" && db) {
      const {error} = await db.auth.signOut();
      if (error) alertNotice(error.message, true);
      else await handleAuth(null);
      return;
    }
    if (event.target.id === "care-import" && user) {
      const legacy = readKey(BASE_KEY + "-device");
      if (!legacy.length || !confirm("Copy " + legacy.length + " device-only records into your private cloud journal?")) return;
      const known = new Set(local.map(e => e.id));
      for (const e of legacy) if (!known.has(e.id)) local.push({...e, synced:false});
      saveLocal();
      if (cloudReady) await sync();
      alertNotice("Device entries copied to your account. The device copy is still retained until you remove it.");
      renderJournal();
    }
  });
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-care-quick], [data-care-delete]");
    if (!button) return;
    const panel = button.closest(".care-tracker");
    if (!panel) return;
    if (button.hasAttribute("data-care-quick")) {
      await addEntry(panel.dataset.carePlant, button.dataset.careQuick, today(), "");
    } else {
      await removeEntry(button.dataset.careDelete);
    }
  });
  document.addEventListener("submit", async event => {
    if (event.target.classList.contains("care-log-form")) {
      event.preventDefault();
      const form = event.target;
      const panel = form.closest(".care-tracker");
      const ok = await addEntry(panel.dataset.carePlant, form.elements.action.value,
        form.elements.date.value, form.elements.note.value);
      if (ok) {form.elements.note.value = ""; form.closest(".care-more").open = false;}
    }
  });
  root.addEventListener("submit", async event => {
    const form = event.target;
    if (!["care-email-form", "care-password-login", "care-password-set"].includes(form.id)) return;
    event.preventDefault();
    if (!cloudReady || !db) {
      alertNotice("Cloud authentication isn't ready; refresh the page.", true);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.id === "care-email-form") {
        const email = form.elements.email.value.trim();
        if (!email) return;
        const redirectTo = window.location.origin + window.location.pathname;
        const {error} = await db.auth.signInWithOtp({
          email, options: {emailRedirectTo: redirectTo, shouldCreateUser: false}
        });
        if (error) {
          const rateLimited = /rate limit|too many|429/i.test(error.message || "");
          alertNotice(rateLimited
            ? "Supabase email limit reached. Wait before requesting another link, or sign in using a GAIA password."
            : "Could not send sign-in email: " + error.message, true);
        } else alertNotice("Check your email for a GAIA sign-in link.");
      } else if (form.id === "care-password-login") {
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        if (!email || !password) return;
        const {data, error} = await db.auth.signInWithPassword({email, password});
        if (error) {
          alertNotice("Password sign-in failed: " + error.message, true);
        } else {
          form.reset();
          await handleAuth(data.session);
          alertNotice("Signed in. Your care journal is linked to this account.");
        }
      } else if (form.id === "care-password-set") {
        if (!user) {
          alertNotice("You must first be signed in to set a GAIA password.", true);
          return;
        }
        const password = form.elements.newPassword.value;
        const confirmation = form.elements.confirmPassword.value;
        if (password.length < 12) {
          alertNotice("Choose a password of at least 12 characters.", true);
          return;
        }
        if (password !== confirmation) {
          alertNotice("The two passwords didn't match.", true);
          return;
        }
        const {error} = await db.auth.updateUser({password});
        if (error) {
          alertNotice("Could not set password: " + error.message, true);
        } else {
          form.reset();
          alertNotice("GAIA password set. You can now sign in on your iPhone with your email and this password.");
        }
      }
    } catch (error) {
      alertNotice("Authentication couldn't complete: " + (error?.message || "Please try again."), true);
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  document.addEventListener("gaia:ready", event => mount(event.detail.plants || []));
  local = readKey(key());
  renderJournal();
  if (window.GAIA_DATA?.plants) mount(window.GAIA_DATA.plants);
  void setupCloud();
})();
