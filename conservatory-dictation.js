/* The Conservatory: conservative, dependency-free care dictation parser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CONSERVATORY_DICTATION = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const ACTIONS = [
    ["prune", /\b(prun(?:e|ed|ing)|trim(?:med|ming)?|cut back)\b/i],
    ["fertilize", /\b(fertiliz(?:e|ed|ing)|fed|feed|feeding)\b/i],
    ["repot", /\b(repot(?:ted|ting)?|potted up|changed (?:the )?soil)\b/i],
    ["pest", /\b(treat(?:ed|ing)? (?:for )?(?:pests?|mites?|thrips?|scale)|sprayed (?:for )?(?:pests?|mites?|thrips?))\b/i],
    ["bath", /\b(bath(?:ed|ing)?|rinsed|washed (?:the )?leaves)\b/i],
    ["inspect", /\b(inspect(?:ed|ing)?|checked (?:for )?pests?)\b/i],
    ["water", /\b(water(?:ed|ing)?)\b/i]
  ];
  const normalize = s => String(s || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  function parse(text, plants, today) {
    const raw = String(text || "").trim();
    if (!raw || raw.length > 1000) return {error:"Enter a short care note (up to 1,000 characters)."};
    // A note about future work or something not done must never become a care event.
    if (/\b(?:did(?:n't| not)|have(?:n't| not)|has(?:n't| not)|not yet|never|will|going to|planning to|plan to|need to|want to|should|might|could|about to|tomorrow|next week)\b/i.test(raw)) {
      return {error:"This sounds like a plan or something not completed. Only record actions that already happened."};
    }
    // Explicit dates outside today/yesterday need the date picker; do not silently
    // recast them as today's care.
    if (/\b(?:last\s+(?!night\b)|next\s+|earlier\b|\d{4}-\d{2}-\d{2}\b|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|(?:on\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|(?:on\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|(?:a few|several|two|three|four|five|\d+)\s+days?\s+ago\b)/i.test(raw)) {
      return {error:"Date is ambiguous. Use today or yesterday, or record this in the dated journal."};
    }
    const matches = ACTIONS.filter(([, re]) => re.test(raw));
    if (matches.length > 1) return {error:"Multiple care actions detected. Record one event at a time."};
    const action = matches.length ? matches[0][0] : "note";
    const lowered = normalize(raw);
    const matched = (plants || []).filter(p => {
      const names = [p.name, ...(Array.isArray(p.commonNames) ? p.commonNames : [])];
      return names.some(n => {
        const key = normalize(n);
        return key.length > 1 && (" " + lowered + " ").includes(" " + key + " ");
      });
    });
    if (matched.length !== 1) return {error: matched.length ? "More than one plant matches. Use the individual plant journal." : "Plant name not recognized. Include the exact name from your collection."};
    const day = String(today || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return {error:"Current date unavailable."};
    if (/\b(yesterday|last night)\b/i.test(raw)) {
      const d = new Date(day + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return {plantId:matched[0].id,plantName:matched[0].name,action,date:d.toISOString().slice(0,10),note:raw};
    }

    return {plantId:matched[0].id,plantName:matched[0].name,action,date:day,note:raw};
  }
  return {parse};
});
