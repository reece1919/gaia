/* GAIA compact shell: move existing controls, not their data, for mobile-first daily care. */
(() => {
  "use strict";
  const care = document.getElementById("gaia-care-center");
  if (!care || document.getElementById("gaia-care-utilities")) return;
  const tasks = document.getElementById("gaia-tasks");
  const controls = document.getElementById("controls");
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const grouping = document.querySelector(".gaia-collection-toolbar");
  const clipboard = document.getElementById("gaia-clipboard");
  const insights = document.getElementById("gaia-insights");
  const guide = document.querySelector(".card-icon-guide");
  const review = document.querySelector(".gaia-review-launch");
  if (!tasks || !controls || !grid || !empty || !clipboard || !insights) return;

  // Keep the exact existing DOM elements and their listeners/ID relationships.
  // A care-first layout: tasks -> find a plant -> original cards -> optional tools.
  const overview = care.querySelector(".gaia-care-overview-panel");
  if (overview) overview.after(tasks);
  tasks.after(controls);
  let last = controls;
  if (grouping) { last.after(grouping); last = grouping; }
  last.after(grid);
  grid.after(empty);

  const drawer = document.createElement("details");
  drawer.id = "gaia-care-utilities";
  drawer.className = "gaia-care-utilities";
  const summary = document.createElement("summary");
  summary.className = "gaia-care-utilities-summary";
  summary.textContent = "Tools & reviews";
  const body = document.createElement("div");
  body.className = "gaia-care-utilities-content";
  const note = document.createElement("p");
  note.className = "gaia-care-utilities-note";
  note.textContent = "Photo reviews, clipboard exports, guides and saved insights. Your records stay in their original systems.";
  body.appendChild(note);
  // Move original controls. No copying or re-creating the private photo widgets.
  if (review) body.appendChild(review);
  body.appendChild(clipboard, insights);
  if (guide) body.appendChild(guide);
  drawer.append(summary, body);
  empty.after(drawer);

  const small = window.matchMedia("(max-width:699px)");
  const updateWidth = () => {
    // On larger screens keep the tools in view, as before. Mobile starts folded.
    drawer.open = !small.matches;
  };
  updateWidth();
  if (small.addEventListener) small.addEventListener("change", updateWidth);
  else small.addListener(updateWidth);
})();
