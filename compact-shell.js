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
  const review = document.querySelector(".gaia-review-launch");
  const savedReviews = document.getElementById("gaia-photo-review-now");
  const photoComparisons = document.getElementById("gaia-photo-review-summary");
  const account = document.getElementById("care-overview");
  const healthTotals = document.querySelector(".gaia-hero-stats");
  const savedConditions = care.querySelector(".gaia-care-attention-details");
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
  const title = document.createElement("strong");
  title.textContent = "Tools & reviews";
  const hint = document.createElement("small");
  hint.textContent = "Photos · Clipboard · Insights";
  summary.append(title, hint);
  const body = document.createElement("div");
  body.className = "gaia-care-utilities-content";
  const note = document.createElement("p");
  note.className = "gaia-care-utilities-note";
  note.textContent = "Photo reviews, clipboard exports, saved insights, and account settings. Your records stay in their original systems.";
  body.appendChild(note);
  // Collection health is available on demand, not permanently shown in the masthead.
  // Relocate the existing live counts (IDs and DOM nodes) into the folded condition panel.
  if (savedConditions) {
    const priorityCards = savedConditions.querySelector(".gaia-care-priority-list");
    if (healthTotals && priorityCards) savedConditions.insertBefore(healthTotals, priorityCards);
    body.appendChild(savedConditions);
  } else if (healthTotals) {
    body.appendChild(healthTotals);
  }
  // One clear place for photo review. Both buttons keep their existing handlers:
  // launching ChatGPT is NOT the same as reloading already saved comparisons.
  if (review || savedReviews || photoComparisons) {
    const photoPanel=document.createElement("details");
    photoPanel.id="gaia-photo-reviews";
    photoPanel.className="gaia-photo-reviews";
    const photoSummary=document.createElement("summary");
    photoSummary.textContent="Photo reviews";
    const photoBody=document.createElement("div");
    photoBody.className="gaia-photo-reviews-content";
    if (review) {
      const title=document.createElement("strong");
      title.textContent="Run new analysis";
      const info=document.createElement("p");
      info.textContent="Open ChatGPT to assess the newest photos awaiting review.";
      photoBody.append(title, info, review);
      const runButton=review.querySelector("#gaia-review-new-photos");
      if (runButton) runButton.textContent="Run new photo analysis ↗";
    }
    if (savedReviews) {
      const title=document.createElement("strong");
      title.textContent="Refresh saved results";
      const info=document.createElement("p");
      info.textContent="Reload assessments already stored in GAIA. This does not start a new analysis.";
      const row=document.createElement("div");
      row.className="gaia-photo-review-refresh";
      row.appendChild(savedReviews);
      photoBody.append(title, info, row);
    }
    if (photoComparisons) photoBody.appendChild(photoComparisons);
    photoPanel.append(photoSummary, photoBody);
    body.appendChild(photoPanel);
  }
  body.append(clipboard, insights);

  // Preserve the original owner-only forms, MFA flow and backup buttons.
  // Move the whole section; scripts still query the same IDs and event targets.
  if (account) {
    const settings=document.createElement("details");
    settings.id="gaia-settings-backup";
    settings.className="gaia-settings-backup";
    const heading=document.createElement("summary");
    heading.textContent="Settings & Backup";
    const inner=document.createElement("div");
    inner.className="gaia-settings-backup-content";
    const nested=account.querySelector(".care-settings");
    if (nested) nested.open=true;
    const originalTitle=account.querySelector(".care-overview-head h2");
    if (originalTitle) originalTitle.textContent="Account, sync & backups";
    inner.appendChild(account);
    settings.append(heading, inner);
    body.appendChild(settings);
  }
  drawer.append(summary, body);
  // One compact row before the plant search, collapsed unless the user opens it.
  tasks.after(drawer);
})();
