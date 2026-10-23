/* GAIA — renders plant profiles from plants.json. Update plant records there, not here. */
(() => {
  "use strict";
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const loading = document.getElementById("loading");
  const search = document.getElementById("search");
  let cards = [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cleanClass = value => String(value ?? "").split(/\s+/).filter(x => /^[a-z0-9-]+$/i.test(x)).join(" ");
  const htmlValue = value => String(value ?? "");

  // Card-level care metadata is sourced from plants.json (not guessed from species).
  // The full original care instructions remain available when the card is opened.
  const LIGHT = {
    "full-sun": ["Full sun", "sun"],
    "very-bright": ["Very bright light, often some direct sun", "sun"],
    "bright": ["Bright light", "sun-partial"],
    "bright-indirect": ["Bright indirect light", "sun-cloud"],
    "medium": ["Medium to bright indirect light", "sun-cloud"],
    "flexible": ["Low to bright light", "sun-dim"]
  };
  const SOIL = {
    "well-drained": ["Well-draining potting mix with perlite or pumice", "layers"],
    "gritty": ["Gritty cactus / succulent mix", "mountain"],
    "chunky": ["Chunky aroid mix with orchid bark", "blocks"],
    "moisture": ["Moisture-retentive airy mix", "droplets"],
    "airy": ["Airy potting mix with fine bark", "wind"],
    "bromeliad": ["Airy bromeliad mix", "wind"],
    "orchid": ["Orchid bark mix", "blocks"],
    "carnivorous": ["Unfertilized carnivorous-plant moss / peat mix", "sprout"],
    "water-grown": ["Grown in water, no potting soil", "waves"],
    "no-soil": ["No soil — air plant", "wind"]
  };
  const TYPES = {
    "croton": ["Croton", "leaf"],
    "succulent": ["Succulent", "succulent"],
    "cactus": ["Cactus", "cactus"],
    "carnivorous": ["Carnivorous plant", "sprout"],
    "palm": ["Palm", "palm"],
    "bromeliad": ["Bromeliad", "flower"],
    "dracaena": ["Dracaena", "palm"],
    "flowering": ["Flowering / bedding plant", "flower"],
    "tropical": ["Tropical foliage plant", "leaf"],
    "aroid": ["Aroid", "split-leaf"],
    "orchid": ["Orchid", "flower"],
    "prayer": ["Prayer plant", "leaf"],
    "pilea": ["Pilea", "sprout"],
    "tradescantia": ["Tradescantia", "vine"],
    "air-plant": ["Air plant", "wind"],
    "fern": ["Fern", "fern"],
    "vine": ["Vine", "vine"],
    "zz": ["ZZ plant", "sprout"]
  };
  // Let the collection browser reuse exactly the same type labels as card icons.
  window.GAIA_PLANT_TYPES = TYPES;
  const ICONS = {
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    "sun-partial": '<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2"/><path d="M16 12a4 4 0 0 0-8 0"/>',
    "sun-cloud": '<path d="M12 2v2m5 1-1.4 1.4M4 12H2m5-7 1.4 1.4"/><path d="M9 15a4.5 4.5 0 0 1 7-5.4"/><path d="M7.5 20h11a3.5 3.5 0 0 0 0-7 5.3 5.3 0 0 0-9.9.8 3.1 3.1 0 0 0-1.1 6.2Z"/>',
    "sun-dim": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M2 12h2m16 0h2M12 20v2"/>',
    "droplet": '<path d="M12 22a8 8 0 0 0 8-8c0-5-8-12-8-12S4 9 4 14a8 8 0 0 0 8 8Z"/>',
    "droplets": '<path d="M12 22a6 6 0 0 0 6-6c0-3.5-6-9-6-9s-6 5.5-6 9a6 6 0 0 0 6 6Z"/><path d="M19 11c1.5-1.7 2-3.6 0-7M5 11C3.5 9.3 3 7.4 5 4"/>',
    "leaf": '<path d="M20 4c-9 0-16 4-16 12a4 4 0 0 0 4 4c8 0 12-7 12-16Z"/><path d="M4 20c4-6 8-9 13-12"/>',
    "split-leaf": '<path d="M20 3C9 4 4 10 4 16a4 4 0 0 0 4 4C17 20 21 12 20 3Z"/><path d="M5 21c4-7 8-11 14-15M9 13l-4-1m9-3-1-5m-1 12 5 1"/>',
    "sprout": '<path d="M12 22v-9M12 13C6 13 4 10 4 5c6 0 8 3 8 8ZM12 17c0-6 3-9 9-9 0 6-3 9-9 9Z"/>',
    "succulent": '<path d="M12 21V11M12 15C6 15 4 12 4 7c5 0 8 3 8 8Zm0 0c0-6 3-9 8-9 0 5-2 9-8 9Z"/><path d="M7 21h10M9 21l-2-4m8 4 2-4"/>',
    "cactus": '<path d="M12 22V5a3 3 0 0 1 6 0v9M12 14H9a3 3 0 0 1-3-3V9a2 2 0 0 0-4 0v3a6 6 0 0 0 6 6h4M18 13h1a3 3 0 0 0 3-3V8"/><path d="M9 22h12"/>',
    "palm": '<path d="M12 22c2-6 2-12 1-15M12 7C10 4 6 3 2 5c4 0 7 1 10 5M13 7c2-4 6-5 9-3-4 1-6 3-9 6M13 7c-3-5-2-6 0-7 2 2 3 4 0 7ZM13 7c3-1 7 0 9 3-4-1-7-1-9 0"/><path d="M8 22h9"/>',
    "fern": '<path d="M6 22c3-8 7-14 12-19M12 13l-7-1 3 5M15 9l-6-2 2 5M17 5l4 3-7 2M10 17l7 3-3-7"/>',
    "vine": '<path d="M6 21c0-8 12-5 12-13 0-3-2-5-5-5"/><path d="M13 8c-5 0-8-2-8-5 5 0 8 2 8 5Zm2 6c4-4 7-4 8-2-1 4-4 6-8 6M9 18c-4 1-6-1-6-4 4 0 6 1 6 4Z"/>',
    "flower": '<circle cx="12" cy="12" r="2"/><path d="M12 10C8 7 10 3 12 3s4 4 2 7M14 12c3-4 7-2 7 0s-4 4-7 2M12 14c4 3 2 7 0 7s-4-4-2-7M10 12c-3 4-7 2-7 0s4-4 7-2"/>',
    "wind": '<path d="M2 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M2 16h8a3 3 0 1 1-3 3"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    "blocks": '<rect x="3" y="5" width="7" height="6" rx="1"/><rect x="14" y="5" width="7" height="6" rx="1"/><rect x="7" y="13" width="10" height="7" rx="1"/>',
    "mountain": '<path d="m2 20 7-13 4 6 3-4 6 11H2Zm7-13 1.8 3M16 9l1.5 3"/>',
    "waves": '<path d="M2 8c3-3 5 3 9 0s6-3 11 0M2 14c3-3 5 3 9 0s6-3 11 0M2 20c3-3 5 3 9 0s6-3 11 0"/>'
  };
  function svgIcon(key) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[key] || ICONS.leaf) + '</svg>';
  }
  function factButton(kind, icon, aria, valueHtml) {
    return '<button type="button" class="card-fact fact-' + kind + '" title="' + esc(aria) +
      '" aria-label="' + esc(aria) + '" data-fact-detail="' + esc(aria) + '">' +
      svgIcon(icon) + (valueHtml ? '<span>' + valueHtml + '</span>' : '') + '</button>';
  }
  function quickFacts(p) {
    const info=p.cardCare || {};
    const light=LIGHT[info.light];
    const type=TYPES[info.type];
    const soil=SOIL[info.soil];
    const water=p.sections?.find(s=>s.label==="WATER")?.bodyHtml || "";
    const soilDetail=p.sections?.find(s=>s.label==="SOIL")?.bodyHtml || "";
    const pieces=[];
    if(light) pieces.push(factButton("light",light[1],"Light: "+light[0]));
    if(type) pieces.push(factButton("type",type[1],"Plant type: "+type[0]));
    if(info.waterLabel) pieces.push(factButton("water","droplet",
      "Watering cue: "+info.waterLabel+". "+water,esc(info.waterLabel)));
    if(soil) pieces.push(factButton("soil",soil[1],"Preferred soil: "+soil[0]+". "+soilDetail));
    return '<div class="card-quick-facts" role="group" aria-label="Quick care icons">' +
      pieces.join("") + '</div>' +
      '<div class="card-fact-explanation" aria-live="polite" hidden></div>';
  }
  const UTILITY_TAGS = /^(?:NEW ADDITION|NEW · CARING FOR AMBER|BRIGHT LIGHT|VERY BRIGHT|VERY BRIGHT LIGHT|BRIGHT INDIRECT|MEDIUM–BRIGHT|MEDIUM–BRIGHT INDIRECT|LOW–BRIGHT|SUN \/ STRONG LIGHT|FULL SUN|STRONG LIGHT|CROTON|SUCCULENT|CACTUS|PALM|BROMELIAD|DRACAENA|BEDDING PLANT|TROPICAL|AROID|PEACE LILY|ORCHID|PRAYER PLANT|PILEA|TRADESCANTIA|VINE|PLECTRANTHUS|FOLIAGE|EPIPHYTE|FERN|ZZ PLANT|AGLAONEMA|SCENTED GERANIUM)$/;

  function pronunciationGuide(p) {
    const guide = window.gaiaBotanicalPronunciation?.(p.species);
    if (!guide?.entries.length) return "";
    const id = "pronunciation-" + p.id;
    return '<div class="botanical-pronunciation">' +
      '<button type="button" class="pronunciation-toggle" aria-expanded="false" aria-controls="' + esc(id) +
      '" aria-label="Botanical pronunciation for ' + esc(p.name) + '">Pronunciation</button>' +
      '<div class="pronunciation-guide" id="' + esc(id) + '" hidden>' +
      guide.entries.map(entry => '<span class="pronunciation-word"><i>' + esc(entry.name) + '</i>: <strong>' +
        esc(entry.pronunciation) + '</strong></span>').join('') +
      '<small>CAPITALS mark the stressed syllable. English pronunciation varies.' +
      (guide.genusOnly ? ' Genus only; species not specified here.' : '') + '</small></div></div>';
  }

  // Botanical background is separate from an individual plant's recorded care and observations.
  function speciesGuide(p) {
    const library = window.GAIA_SPECIES_GUIDE;
    const profile = library?.taxa?.[library.byPlant?.[p.id]];
    if (!profile) return "";
    const taxon = profile.taxon || p.species;
    const genus = taxon.includes(" / ") ? taxon : taxon.split(" ")[0];
    const fact = (label, value) => value
      ? '<div class="species-guide-fact"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>'
      : "";
    const searchTaxon = taxon.includes(" / ") ? taxon.split(" / ")[0] : taxon;
    const searchUrl = "https://powo.science.kew.org/results?q=" + encodeURIComponent(searchTaxon);
    return '<details class="species-guide" id="species-guide-' + esc(p.id) + '">' +
      '<summary>About this species <small>Botany &amp; growth</small></summary>' +
      '<div class="species-guide-body">' +
      '<dl class="species-guide-grid">' +
      fact("Botanical reference", taxon) +
      fact("Genus", genus) +
      fact("Family", profile.family) +
      fact("Growth habit", profile.habit) +
      fact("Native range", profile.native) +
      fact("Typical propagation", profile.propagation) +
      '</dl>' +
      (profile.trait ? '<p class="species-guide-trait">' + esc(profile.trait) + '</p>' : '') +
      '<div class="species-guide-footer">' +
      '<a href="' + esc(searchUrl) + '" target="_blank" rel="noopener noreferrer">Research this taxon at Kew ↗</a>' +
      '<small>General species information, not a confirmed identification or a replacement for this plant’s care record. ' +
      'For uncertain IDs and named cultivars, use the broader genus or species reference.</small>' +
      '</div></div></details>';
  }

  function makeCard(p) {
    const card = document.createElement("details");
    card.className = "card";
    card.dataset.name = p.searchName || p.name || "";
    card.dataset.plantId = p.id;
    card.dataset.species = p.searchSpecies || p.species || "";
    card.dataset.commonNames = (p.commonNames || []).join(" ");
    card.dataset.status = p.status || "";
    const coverPhoto = p.coverPhoto || p.photo;
    card.dataset.photo = coverPhoto ? "yes" : "no";
    card.dataset.new = p.newAddition ? "yes" : "no";
    card.dataset.pest = p.pest || "";
    if (p.added) card.dataset.added = p.added;

    const tags = (p.tags || []).filter(tag => !UTILITY_TAGS.test(tag.label)).map(tag =>
      '<span class="meta-tag' + (tag.style ? ' ' + cleanClass(tag.style) : "") + '">' + esc(tag.label) + '</span>'
    ).join("");
    const photo = coverPhoto
      ? '<img alt="' + esc(p.photoAlt || p.name) + '" loading="lazy" decoding="async" src="' + esc(coverPhoto) + '">'
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
      (p.commonNames?.length ? '<div class="common-names">' + esc(p.commonNames.join(' · ')) + '</div>' : '') +
      '<div class="species">' + esc(p.species) + '</div>' +
      (tags ? '<div class="meta-tags">' + tags + '</div>' : '') + '</div>' +
      '<span class="badge">' + esc(p.status) + '</span></div>' +
      // Keep learning shortcuts available without forcing them into the narrow title column on phones.
      '<div class="card-botany-actions">' + pronunciationGuide(p) +
      (window.GAIA_SPECIES_GUIDE?.byPlant?.[p.id] ?
        '<button type="button" class="species-info-shortcut" aria-label="Read botanical information for ' + esc(p.name) + '">Species info ↗</button>' : '') +
      '</div>' +
      quickFacts(p) +
      '<div class="tap-hint">Tap for care details</div></div></summary>' +
      '<div class="care"><div class="care-grid">' + speciesGuide(p) + sections +
      '<div class="history-wrap"><details class="history"><summary>History &amp; records</summary>' +
      '<div class="history-grid">' + facts + notes + '</div></details></div>' +
      '</div></div>';
    return card;
  }

  function filter() {
    const q = (search.value || "").trim().toLowerCase();
    let count = 0;
    for (const card of cards) {
      const haystack = (card.dataset.name + " " + card.dataset.species + " " + card.dataset.commonNames).toLowerCase();
      const show = !q || haystack.includes(q);
      card.hidden = !show;
      if (show) count++;
    }
    empty.className = count ? "empty" : "empty show";
  }

  function renderSummary(data) {
    const plants = data.plants;
    const good = plants.filter(p => p.status === "Excellent" || p.status === "Good").length;
    const totalCount=document.getElementById("gaia-total-count");
    const goodCount=document.getElementById("gaia-good-count");
    if(totalCount)totalCount.textContent=String(plants.length);
    if(goodCount)goodCount.textContent=String(good);
    const attentionCount=document.getElementById("gaia-attention-count");
    if(attentionCount)attentionCount.textContent=String(plants.length-good);
    const attentionCondition=document.getElementById("gaia-attention-condition");
    if(attentionCondition){
      const counts=new Map();
      plants.filter(p=>p.status!=="Excellent"&&p.status!=="Good").forEach(p=>counts.set(p.status||"Needs review",(counts.get(p.status||"Needs review")||0)+1));
      attentionCondition.textContent=[...counts].map(([status,n])=>n+" "+status.toLowerCase()).join(" · ")||"all plants in good condition";
    }
    document.querySelector(".sub").textContent =
      plants.length + " plants · updated " + (data.updatedAt || "recently") +
      " · " + (data.summaryNote || "tap for care, priorities & history");
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
      try { renderSummary(data); } catch (summaryError) { console.error("GAIA summary display error:", summaryError); }
      window.GAIA_DATA = data;
      document.dispatchEvent(new CustomEvent("gaia:ready", { detail: { plants: data.plants } }));
      if (loading) loading.remove();
      filter();
    } catch (error) {
      console.error("GAIA load error:", error);
      if (loading) loading.textContent =
        "Could not load plant records. Please refresh GAIA. If this continues, check plants.json in the GitHub repository.";
    }
  }

  grid.addEventListener("click", event => {
    const button = event.target.closest(".pronunciation-toggle");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const output = document.getElementById(button.getAttribute("aria-controls"));
    if (!output) return;
    output.hidden = !output.hidden;
    button.setAttribute("aria-expanded", String(!output.hidden));
  });

  // The card shortcut opens the reference directly, without toggling the entire plant card closed.
  grid.addEventListener("click", event => {
    const shortcut = event.target.closest(".species-info-shortcut");
    if (!shortcut) return;
    event.preventDefault();
    event.stopPropagation();
    const card = shortcut.closest(".card");
    const guide = card?.querySelector(".species-guide");
    if (!card || !guide) return;
    card.open = true;
    guide.open = true;
    guide.scrollIntoView({behavior: "smooth", block: "nearest"});
  });

  // Tapping an icon explains the source care rule without opening the profile.
  grid.addEventListener("click", event => {
    const fact = event.target.closest(".card-fact");
    if (!fact) return;
    event.preventDefault();
    event.stopPropagation();
    const summary = fact.closest("summary");
    const output = summary?.querySelector(".card-fact-explanation");
    if (!output) return;
    const isSame = !output.hidden && output.textContent === fact.dataset.factDetail;
    output.hidden = isSame;
    output.textContent = isSame ? "" : fact.dataset.factDetail;
    summary.querySelectorAll(".card-fact").forEach(button =>
      button.setAttribute("aria-pressed", String(button===fact&&!isSame)));
  });
  search.addEventListener("input", filter);
  start();
})();
