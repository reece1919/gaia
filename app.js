/* GAIA — renders plant profiles from plants.json. Update plant records there, not here. */
(() => {
  "use strict";
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const loading = document.getElementById("loading");
  const search = document.getElementById("search");
  const health = document.getElementById("health");
  const focus = document.getElementById("focus");
  let cards = [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cleanClass = value => String(value ?? "").split(/\s+/).filter(x => /^[a-z0-9-]+$/i.test(x)).join(" ");
  const htmlValue = value => String(value ?? "");

  function makeCard(p) {
    const card = document.createElement("details");
    card.className = "card";
    card.dataset.name = p.searchName || p.name || "";
    card.dataset.plantId = p.id;
    card.dataset.species = p.searchSpecies || p.species || "";
    card.dataset.status = p.status || "";
    card.dataset.photo = p.photo ? "yes" : "no";
    card.dataset.new = p.newAddition ? "yes" : "no";
    card.dataset.pest = p.pest || "";
    if (p.added) card.dataset.added = p.added;

    const tags = (p.tags || []).map(tag =>
      '<span class="meta-tag' + (tag.style ? ' ' + cleanClass(tag.style) : "") + '">' + esc(tag.label) + '</span>'
    ).join("");
    const photo = p.photo
      ? '<img alt="' + esc(p.photoAlt || p.name) + '" loading="lazy" decoding="async" src="' + esc(p.photo) + '">'
      : '<span class="photo-missing">No photo yet</span>';
    const sections = (p.sections || []).map(section =>
      '<section class="box' + (section.style ? ' ' + cleanClass(section.style) : "") + '">' +
        '<div class="label">' + esc(section.label) + '</div>' +
        '<p' + (section.pClass ? ' class="' + cleanClass(section.pClass) + '"' : "") + '>' + htmlValue(section.bodyHtml) + '</p>' +
      '</section>'
    ).join("");
    const history = p.history || {};
    const facts = (history.facts || []).map(fact =>
      '<div class="history-item"><span class="history-label">' + esc(fact.label) + '</span>' +
      '<span class="history-value' + (fact.style ? ' ' + cleanClass(fact.style) : "") + '">' +
      htmlValue(fact.valueHtml) + '</span></div>'
    ).join("");
    const notes = (history.notes || []).map(note =>
      '<div class="history-note' + (note.style ? ' ' + cleanClass(note.style) : "") + '">' +
      htmlValue(note.bodyHtml) + '</div>'
    ).join("");

    card.innerHTML =
      '<summary><div class="photo">' + photo + '</div><div class="summary-body">' +
      '<div class="row"><div class="title-block"><div class="name">' + esc(p.name) + '</div>' +
      '<div class="species">' + esc(p.species) + '</div>' +
      '<div class="meta-tags">' + tags + '</div></div>' +
      '<span class="badge">' + esc(p.status) + '</span></div>' +
      '<div class="tap-hint">Tap for care details</div></div></summary>' +
      '<div class="care"><div class="care-grid">' + sections +
      '<div class="history-wrap"><details class="history"><summary>History &amp; records</summary>' +
      '<div class="history-grid">' + facts + notes + '</div></details></div>' +
      '</div></div>';
    return card;
  }

  function filter() {
    const q = (search.value || "").trim().toLowerCase();
    const h = health.value;
    const f = focus.value;
    let count = 0;
    for (const card of cards) {
      const haystack = (card.dataset.name + " " + card.dataset.species).toLowerCase();
      const show = (!q || haystack.includes(q)) &&
        (h === "all" || card.dataset.status === h) &&
        (f === "all" || (f === "new" && card.dataset.new === "yes") ||
          (f === "mites" && card.dataset.pest === "reported"));
      card.hidden = !show;
      if (show) count++;
    }
    empty.className = count ? "empty" : "empty show";
  }

  function renderSummary(data) {
    const plants = data.plants;
    const good = plants.filter(p => p.status === "Excellent" || p.status === "Good").length;
    const stats = document.querySelectorAll(".stat b");
    if (stats.length >= 3) {
      stats[0].textContent = String(plants.length);
      stats[1].textContent = String(good);
      stats[2].textContent = String(plants.length - good);
    }
    document.querySelector(".sub").textContent =
      plants.length + " plants · updated " + (data.updatedAt || "recently") +
      " · " + (data.summaryNote || "tap for care, priorities & history");
    const newCount = plants.filter(p => p.newAddition).length;
    const miteCount = plants.filter(p => p.pest === "reported").length;
    focus.querySelector('[value="new"]').textContent = "New additions (" + newCount + ")";
    focus.querySelector('[value="mites"]').textContent = "Mites reported (" + miteCount + ")";
    const care = data.recentCare || {};
    const activity = document.getElementById("recent-care");
    activity.innerHTML = '<div class="activity-heading"><h2>Recent care &amp; follow-up</h2>' +
      '<span class="activity-date">' + esc(care.dateLabel || "") + '</span></div>' +
      '<div class="activity-grid">' +
      (care.tiles || []).map(tile =>
        '<div class="activity-tile"><h3>' + esc(tile.title) + '</h3><p>' +
        htmlValue(tile.descriptionHtml) + '</p></div>'
      ).join("") + '</div>' +
      '<p class="activity-note">' + htmlValue(care.noteHtml) + '</p>';
  }

  async function start() {
    try {
      const response = await fetch("./plants.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Data file unavailable (HTTP " + response.status + ")");
      const data = await response.json();
      if (!data || !Array.isArray(data.plants) || !data.plants.length)
        throw new Error("The plant data file was empty or invalid.");
      const fragment = document.createDocumentFragment();
      cards = data.plants.map(makeCard);
      cards.forEach(card => fragment.appendChild(card));
      grid.appendChild(fragment);
      renderSummary(data);
      document.dispatchEvent(new CustomEvent("gaia:ready", { detail: { plants: data.plants } }));
      if (loading) loading.remove();
      filter();
    } catch (error) {
      console.error("GAIA load error:", error);
      if (loading) loading.textContent =
        "Could not load plant records. Please refresh GAIA. If this continues, check plants.json in the GitHub repository.";
    }
  }

  search.addEventListener("input", filter);
  health.addEventListener("change", filter);
  focus.addEventListener("change", filter);
  start();
})();
