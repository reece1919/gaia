/* GAIA collection browser: plant icon type -> botanical family -> individual plants.
   Grouping only reorganizes DOM cards; it never changes the saved custom order or care data. */
(() => {
  "use strict";
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  if (!grid || !search) return;

  const STORE_KEY = "gaia-collection-view-v1";
  let preferredView = "grouped";
  try { if (localStorage.getItem(STORE_KEY) === "manual") preferredView = "manual"; } catch (_) {}
  let view = preferredView;
  let plants = [];
  let manualIds = [];
  let typeGroups = [];
  const collapsedTypes = new Set();
  const collapsedFamilies = new Set();
  const openLessons = new Set();
  const lessonKey = (kind, id) => kind + ":" + id;

  function makeLesson(kind, name, id) {
    const library = window.GAIA_GROUP_LEARNING;
    const profile = kind === "type" ? library?.types?.[id] : library?.families?.[name];
    if (!profile) return null;
    const details = document.createElement("details");
    details.className = "gaia-group-lesson";
    details.dataset.lessonKind = kind;
    details.dataset.lessonId = id;
    details.open = openLessons.has(lessonKey(kind, id));

    const summary = document.createElement("summary");
    summary.textContent = kind === "type" ? "Learn about this plant type" : "Learn about this botanical family";
    const intro = document.createElement("p");
    intro.className = "gaia-group-lesson-intro";
    intro.textContent = profile.about;
    const facts = document.createElement("dl");
    facts.className = "gaia-group-lesson-facts";
    const fields = [
      ["How to recognize it", profile.recognize],
      ["Typical conditions", profile.conditions],
      ["Interesting to know", profile.learn]
    ];
    fields.forEach(([title, value]) => {
      if (!value) return;
      const item = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = title;
      const dd = document.createElement("dd");
      dd.textContent = value;
      item.append(dt, dd);
      facts.appendChild(item);
    });
    const foot = document.createElement("div");
    foot.className = "gaia-group-lesson-foot";
    const link = document.createElement("a");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = kind === "type" ? library.resources.care :
      library.resources.familySearch + encodeURIComponent(name);
    link.textContent = kind === "type" ? "RHS houseplant care guide ↗" : "Research the family at Kew ↗";
    const caveat = document.createElement("small");
    caveat.textContent = kind === "type" ?
      "Plant types are practical labels, not taxonomic ranks. These are usual patterns, not care instructions for every member." :
      "Botanical families show relationships—not identical light, water, or soil needs. Follow each plant’s own care card.";
    foot.append(link, caveat);
    const body = document.createElement("div");
    body.className = "gaia-group-lesson-body";
    body.append(intro, facts, foot);
    details.append(summary, body);
    return details;
  }

  const sorter = new Intl.Collator(undefined, {sensitivity: "base", numeric: true});
  const allCards = () => [...grid.querySelectorAll(":scope > .card")];

  const toolbar = document.createElement("nav");
  toolbar.className = "gaia-collection-toolbar";
  toolbar.setAttribute("aria-label", "Plant collection display");
  const label = document.createElement("span");
  label.className = "gaia-collection-toolbar-label";
  label.textContent = "Collection view";
  const groupButton = document.createElement("button");
  groupButton.type = "button";
  groupButton.textContent = "By type & family";
  groupButton.setAttribute("aria-pressed", "true");
  const manualButton = document.createElement("button");
  manualButton.type = "button";
  manualButton.textContent = "Custom order";
  manualButton.setAttribute("aria-pressed", "false");
  const status = document.createElement("span");
  status.className = "gaia-collection-view-status";
  status.setAttribute("role", "status");
  toolbar.append(label, groupButton, manualButton, status);
  grid.insertAdjacentElement("beforebegin", toolbar);

  const groupKey = (type, family) => JSON.stringify([type, family]);
  function detailsFor(plant) {
    const typeCode = plant.cardCare?.type || "unknown";
    const type = window.GAIA_PLANT_TYPES?.[typeCode]?.[0] || "Unclassified";
    const guide = window.GAIA_SPECIES_GUIDE;
    const taxon = guide?.taxa?.[guide.byPlant?.[plant.id]];
    return {typeCode, type, family:taxon?.family || "Family not established"};
  }

  function heading(kind, name, id, exampleCard) {
    const wrapper = document.createElement("div");
    wrapper.className = kind === "type" ? "gaia-type-heading" : "gaia-family-heading";
    wrapper.dataset.groupKey = id;
    const headingRow = document.createElement("div");
    headingRow.setAttribute("role", "heading");
    headingRow.setAttribute("aria-level", kind === "type" ? "2" : "3");
    const title = document.createElement("button");
    title.type = "button";
    title.className = "gaia-group-toggle";
    const closed = (kind === "type" ? collapsedTypes : collapsedFamilies).has(id);
    title.setAttribute("aria-expanded", String(!closed));
    title.setAttribute("aria-label", (kind === "type" ? "Plant type: " : "Botanical family: ") + name);
    if (kind === "type") {
      const icon = exampleCard?.querySelector(".card-fact.fact-type svg");
      if (icon) title.appendChild(icon.cloneNode(true));
    }
    const text = document.createElement("span");
    text.className = "gaia-group-title";
    text.textContent = kind === "type" ? name : "Family · " + name;
    const count = document.createElement("span");
    count.className = "gaia-group-count";
    count.textContent = "0 plants";
    const marker = document.createElement("span");
    marker.className = "gaia-group-chevron";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = closed ? "＋" : "−";
    title.append(text, count, marker);
    headingRow.appendChild(title);
    wrapper.appendChild(headingRow);
    const lesson = makeLesson(kind, name, id);
    if (lesson) wrapper.appendChild(lesson);
    return {element:wrapper, button:title, count, marker};
  }

  function clearGroups() {
    grid.querySelectorAll(":scope > .gaia-type-heading, :scope > .gaia-family-heading").forEach(node => node.remove());
    typeGroups = [];
    allCards().forEach(card => card.classList.remove("gaia-group-collapsed"));
  }

  function renderGroups() {
    if (view !== "grouped" || !plants.length) return;
    clearGroups();
    const cards = new Map(allCards().map(card => [card.dataset.plantId, card]));
    const types = new Map();
    plants.forEach(plant => {
      const card = cards.get(plant.id);
      if (!card) return;
      const {type, typeCode, family} = detailsFor(plant);
      if (!types.has(typeCode)) types.set(typeCode, {name:type, code:typeCode, families:new Map(), example:card});
      const entry = types.get(typeCode);
      if (!entry.families.has(family)) entry.families.set(family, []);
      entry.families.get(family).push({card, plant});
    });
    const orderedTypes = [...types.values()].sort((a,b) => sorter.compare(a.name,b.name));
    const fragment = document.createDocumentFragment();
    orderedTypes.forEach(type => {
      const typeId = type.code;
      const typeHead = heading("type", type.name, typeId, type.example);
      fragment.appendChild(typeHead.element);
      const families = [...type.families.entries()]
        .sort((a,b) => sorter.compare(a[0], b[0]))
        .map(([family, members]) => {
          const familyId = groupKey(typeId, family);
          const familyHead = heading("family", family, familyId);
          fragment.appendChild(familyHead.element);
          members.sort((a,b) => sorter.compare(a.plant.name,b.plant.name));
          members.forEach(({card}) => fragment.appendChild(card));
          return {name:family, id:familyId, head:familyHead, cards:members.map(x=>x.card)};
        });
      typeGroups.push({id:typeId, head:typeHead, families});
    });
    grid.appendChild(fragment);
    grid.classList.add("gaia-grouped");
    refreshVisibility();
  }

  function refreshVisibility() {
    if (view !== "grouped") return;
    let visible = 0;
    let visibleTypes = 0;
    let visibleFamilies = 0;
    for (const type of typeGroups) {
      const typeClosed = collapsedTypes.has(type.id);
      let typeCount = 0;
      for (const family of type.families) {
        const familyClosed = collapsedFamilies.has(family.id);
        const matching = family.cards.filter(card => !card.hidden).length;
        typeCount += matching;
        if (matching) visibleFamilies++;
        family.head.element.hidden = matching === 0 || typeClosed;
        family.head.count.textContent = matching + (matching === 1 ? " plant" : " plants");
        family.head.button.setAttribute("aria-expanded", String(!familyClosed));
        family.head.marker.textContent = familyClosed ? "＋" : "−";
        family.cards.forEach(card => {
          card.classList.toggle("gaia-group-collapsed", typeClosed || familyClosed);
        });
      }
      type.head.element.hidden = typeCount === 0;
      type.head.count.textContent = typeCount + (typeCount === 1 ? " plant" : " plants");
      type.head.button.setAttribute("aria-expanded", String(!typeClosed));
      type.head.marker.textContent = typeClosed ? "＋" : "−";
      if (typeCount) visibleTypes++;
      visible += typeCount;
    }
    status.textContent = visible + (visible === 1 ? " plant" : " plants") + " · " +
      visibleTypes + (visibleTypes === 1 ? " type" : " types") + " · " +
      visibleFamilies + (visibleFamilies === 1 ? " family group" : " family groups");
  }

  function restoreManualOrder() {
    clearGroups();
    grid.classList.remove("gaia-grouped");
    const byId = new Map(allCards().map(card => [card.dataset.plantId, card]));
    const fragment = document.createDocumentFragment();
    const used = new Set();
    manualIds.forEach(id => {
      if (byId.has(id) && !used.has(id)) {
        fragment.appendChild(byId.get(id));
        used.add(id);
      }
    });
    byId.forEach((card, id) => { if (!used.has(id)) fragment.appendChild(card); });
    grid.appendChild(fragment);
    status.textContent = allCards().length + " plants · your saved card arrangement";
  }

  function switchView(next, save = true) {
    if (next !== "grouped" && next !== "manual") return;
    if (next === "grouped" && view === "manual" && plants.length) {
      manualIds = allCards().map(card => card.dataset.plantId);
    }
    view = next;
    if (save) { try { localStorage.setItem(STORE_KEY, view); } catch (_) {} }
    groupButton.setAttribute("aria-pressed", String(view === "grouped"));
    manualButton.setAttribute("aria-pressed", String(view === "manual"));
    if (!plants.length) return;
    if (view === "grouped") renderGroups();
    else restoreManualOrder();
  }

  groupButton.addEventListener("click", () => {
    if (grid.classList.contains("gaia-reordering")) return;
    switchView("grouped");
  });
  manualButton.addEventListener("click", () => switchView("manual"));
  // Drag-to-rearrange is only meaningful in custom order view.
  document.addEventListener("click", event => {
    if (event.target.closest("#gaia-order-toggle") &&
        view === "grouped" && !grid.classList.contains("gaia-reordering")) {
      switchView("manual");
    }
  }, true);

  // Independent education expansion; keep reading state across saved-order redraws.
  grid.addEventListener("click", event => {
    const summary = event.target.closest(".gaia-group-lesson > summary");
    if (!summary) return;
    const lesson = summary.parentElement;
    const key = lessonKey(lesson.dataset.lessonKind, lesson.dataset.lessonId);
    if (lesson.open) openLessons.delete(key);
    else openLessons.add(key);
  });
  grid.addEventListener("click", event => {
    const trigger = event.target.closest(".gaia-group-toggle");
    if (!trigger || view !== "grouped") return;
    const head = trigger.closest(".gaia-type-heading, .gaia-family-heading");
    if (!head) return;
    const isType = head.classList.contains("gaia-type-heading");
    const chosen = isType ? collapsedTypes : collapsedFamilies;
    if (chosen.has(head.dataset.groupKey)) chosen.delete(head.dataset.groupKey);
    else chosen.add(head.dataset.groupKey);
    refreshVisibility();
  });

  // app.js owns the search filter; listen after it to hide empty family headings.
  search.addEventListener("input", refreshVisibility);
  document.addEventListener("gaia:order-applied", event => {
    if (Array.isArray(event.detail?.plantIds)) manualIds = event.detail.plantIds.slice();
    if (view === "grouped") renderGroups();
  });
  function setup(records) {
    if (!Array.isArray(records) || !records.length) return;
    plants = records;
    if (!manualIds.length) manualIds = records.map(p => p.id);
    switchView(view, false);
  }
  document.addEventListener("gaia:ready", event => setup(event.detail?.plants));
  if (window.GAIA_DATA?.plants) setup(window.GAIA_DATA.plants);
})();
