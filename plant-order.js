/* GAIA plant collection order: owner-only preference, never edits plants.json. */
(() => {
  "use strict";
  const grid = document.getElementById("grid");
  const controls = document.getElementById("controls");
  const search = document.getElementById("search");
  if (!grid || !controls || !search) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "gaia-order-toggle";
  button.textContent = "Rearrange";
  button.setAttribute("aria-pressed", "false");
  controls.appendChild(button);

  const status = document.createElement("p");
  status.id = "gaia-order-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  controls.insertAdjacentElement("afterend", status);

  let defaultIds = [];
  let client = null;
  let user = null;
  let loaded = false;
  let mode = false;
  let saving = false;
  let savedIds = [];
  let loadGeneration = 0;
  let drag = null;
  let scrollFrame = 0;

  const allCards = () => [...grid.querySelectorAll(":scope > .card")];
  const currentIds = () => allCards().map(card => card.dataset.plantId);
  const announce = message => { status.textContent = message; };
  const normalize = ids => {
    const known = new Set(defaultIds);
    const seen = new Set();
    const chosen = (Array.isArray(ids) ? ids : []).filter(id => {
      if (!known.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return chosen.concat(defaultIds.filter(id => !seen.has(id)));
  };
  function applyOrder(ids) {
    if (!defaultIds.length || drag) return;
    const byId = new Map(allCards().map(card => [card.dataset.plantId, card]));
    const fragment = document.createDocumentFragment();
    normalize(ids).forEach(id => {
      if (byId.has(id)) fragment.appendChild(byId.get(id));
    });
    grid.appendChild(fragment);
    // Reapply the taxonomy view after a saved-order sync without changing that saved order.
    document.dispatchEvent(new CustomEvent("gaia:order-applied", {
      detail: {plantIds:normalize(ids)}
    }));
  }
  function updateButton() {
    button.textContent = mode ? "Done" : "Rearrange";
    button.setAttribute("aria-pressed", String(mode));
    button.disabled = saving;
    grid.classList.toggle("gaia-reordering", mode);
  }
  function setMode(on) {
    if (on && (!loaded || !user || !client)) {
      announce(user ? "Finish GAIA account verification or reconnect to enable saved ordering." :
        "Sign in under Care → Tools & reviews → Settings & Backup to save plant order across devices.");
      return;
    }
    if (saving || drag) return;
    mode = Boolean(on);
    if (mode) {
      search.value = "";
      search.dispatchEvent(new Event("input", {bubbles:true}));
      allCards().forEach(card => { card.open = false; });
      announce("Drag a handle to move a plant. Keyboard: select a handle and use arrow keys.");
    } else {
      announce("Your custom plant order is saved to your GAIA account.");
    }
    updateButton();
  }
  button.addEventListener("click", () => setMode(!mode));

  // Preserve the card's existing photo, care journal, event listeners and records.
  function addHandles() {
    allCards().forEach(card => {
      const photo = card.querySelector(":scope > summary .photo");
      if (!photo || photo.querySelector(".gaia-order-handle")) return;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "gaia-order-handle";
      handle.textContent = "☷";
      handle.title = "Drag to reorder";
      handle.setAttribute("aria-label", "Reorder " + (card.dataset.name || "plant") + ". Drag or use arrow keys.");
      photo.appendChild(handle);
    });
  }

  async function saveOrder() {
    if (!client || !user || !loaded || saving) return;
    const ids = normalize(currentIds());
    if (ids.join("|") === savedIds.join("|")) return;
    saving = true;
    updateButton();
    announce("Saving plant order…");
    const thisUser = user.id;
    try {
      const {error} = await client.from("gaia_plant_order").upsert({
        user_id: thisUser,
        plant_ids: ids,
        updated_at: new Date().toISOString()
      }, {onConflict:"user_id"});
      if (error) throw error;
      if (thisUser !== user?.id) return;
      savedIds = ids;
      announce("Plant order saved. It will appear on your other signed-in devices.");
    } catch (error) {
      console.error("GAIA plant order save:", error);
      if (thisUser === user?.id) {
        applyOrder(savedIds);
        announce("Couldn't sync the change. Previous saved order restored; try again.");
      }
    } finally {
      saving = false;
      updateButton();
    }
  }

  function moveTo(card, target) {
    if (card === target || !card || !target) return false;
    const items = allCards();
    const from = items.indexOf(card);
    const to = items.indexOf(target);
    if (from < 0 || to < 0) return false;
    grid.insertBefore(card, from < to ? target.nextSibling : target);
    return true;
  }
  function moveKey(card, event) {
    const cards = allCards();
    const index = cards.indexOf(card);
    let destination = index;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") destination--;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") destination++;
    else if (event.key === "Home") destination = 0;
    else if (event.key === "End") destination = cards.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (saving || destination < 0 || destination >= cards.length || index === destination) return;
    moveTo(card, cards[destination]);
    const handle = card.querySelector(".gaia-order-handle");
    if (handle) handle.focus({preventScroll:true});
    void saveOrder();
  }

  function findTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    const target = el?.closest(".card");
    return target && target.parentElement === grid ? target : null;
  }
  function markTarget(target) {
    allCards().forEach(card => card.classList.toggle("gaia-order-drop-target", card === target));
  }
  function positionGhost(x, y) {
    if (!drag?.ghost) return;
    drag.ghost.style.transform = "translate(" + (x + 14) + "px, " + (y + 14) + "px)";
  }
  function scrollTick() {
    scrollFrame = 0;
    if (!drag || !drag.active) return;
    const y = drag.y;
    const edge = 85;
    if (y < edge) window.scrollBy(0, -Math.min(18, Math.ceil((edge - y) / 4)));
    else if (y > innerHeight - edge)
      window.scrollBy(0, Math.min(18, Math.ceil((y - (innerHeight - edge)) / 4)));
    const target = findTarget(drag.x, drag.y);
    drag.target = target && target !== drag.card ? target : null;
    markTarget(drag.target);
    scrollFrame = requestAnimationFrame(scrollTick);
  }
  function cleanupDrag() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    if (!drag) return;
    drag.ghost?.remove();
    drag.card.classList.remove("gaia-order-moving");
    markTarget(null);
    drag = null;
  }

  grid.addEventListener("pointerdown", event => {
    const handle = event.target.closest(".gaia-order-handle");
    if (!handle || !mode || saving || (event.pointerType === "mouse" && event.button !== 0)) return;
    const card = handle.closest(".card");
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {card, handle, id:event.pointerId,
      startX:event.clientX, startY:event.clientY,
      x:event.clientX, y:event.clientY, active:false, target:null, ghost:null};
    handle.setPointerCapture(event.pointerId);
  });

  grid.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 7) {
      drag.active = true;
      drag.card.classList.add("gaia-order-moving");
      const ghost = document.createElement("div");
      ghost.className = "gaia-order-ghost";
      ghost.textContent = drag.card.dataset.name || "Plant";
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      scrollFrame = requestAnimationFrame(scrollTick);
    }
    if (drag.active) {
      event.preventDefault();
      positionGhost(drag.x, drag.y);
      const target = findTarget(drag.x, drag.y);
      drag.target = target && target !== drag.card ? target : null;
      markTarget(drag.target);
    }
  });

  grid.addEventListener("pointerup", event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    event.stopPropagation();
    const {card, active, target} = drag;
    cleanupDrag();
    if (active && moveTo(card, target)) void saveOrder();
  });
  grid.addEventListener("pointercancel", cleanupDrag);
  grid.addEventListener("keydown", event => {
    const handle = event.target.closest(".gaia-order-handle");
    if (handle && mode) moveKey(handle.closest(".card"), event);
    if (mode && event.key === "Escape") { cleanupDrag(); setMode(false); }
  });
  grid.addEventListener("click", event => {
    if (!mode) return;
    // A handle lives within a <summary>; prevent its click from opening the card.
    if (event.target.closest(".gaia-order-handle") || event.target.closest(".card > summary")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  async function loadOrder(silent = false) {
    if (!defaultIds.length || !client || !user || saving || mode) return;
    const generation = ++loadGeneration;
    loaded = false;
    const thisUser = user.id;
    try {
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (generation !== loadGeneration || thisUser !== user?.id) return;
      if (assurance.error) throw assurance.error;
      if (assurance.data?.currentLevel !== "aal2") {
        announce("Complete GAIA authenticator verification to sync your plant order.");
        return;
      }
      const {data, error} = await client.from("gaia_plant_order")
        .select("plant_ids").eq("user_id", thisUser).maybeSingle();
      if (error) throw error;
      if (generation !== loadGeneration || thisUser !== user?.id) return;
      savedIds = normalize(data?.plant_ids || defaultIds);
      applyOrder(savedIds);
      loaded = true;
      if (!silent) announce(data ? "Your saved plant order has loaded." :
        "Rearrange plants to save a custom order for all your devices.");
    } catch (error) {
      console.error("GAIA plant order load:", error);
      if (generation === loadGeneration) announce("Plant order sync unavailable. Retry after reconnecting.");
    }
  }

  function authChanged(detail) {
    const nextUser = detail?.user || null;
    const nextClient = detail?.client || null;
    if (user?.id === nextUser?.id && client === nextClient && loaded) return;
    loadGeneration++;
    user = nextUser;
    client = nextClient;
    loaded = false;
    savedIds = defaultIds.slice();
    mode = false;
    cleanupDrag();
    updateButton();
    if (!user) {
      applyOrder(defaultIds);
      announce("Sign in to GAIA to save a custom plant order across devices.");
    } else {
      void loadOrder();
    }
  }

  document.addEventListener("gaia:ready", event => {
    defaultIds = (event.detail?.plants || []).map(p => p.id);
    savedIds = defaultIds.slice();
    addHandles();
    if (user && client) void loadOrder();
    else announce("Sign in to GAIA to save a custom plant order across devices.");
  });
  document.addEventListener("gaia:auth", event => authChanged(event.detail));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && user && client && loaded && !mode && !saving) void loadOrder(true);
  });
  if (window.GAIA_DATA?.plants) {
    defaultIds = window.GAIA_DATA.plants.map(p => p.id);
    savedIds = defaultIds.slice();
    addHandles();
  }
  if (window.GAIA_CLOUD) authChanged(window.GAIA_CLOUD);
  updateButton();
})();