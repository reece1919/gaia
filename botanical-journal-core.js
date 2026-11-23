/* Conservative, data-only helpers for the Conservatory field-journal view.
   Never infer a current observation from species knowledge or stale notes. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GAIA_BOTANICAL_JOURNAL_CORE=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const collator=new Intl.Collator("en",{sensitivity:"base",numeric:true});
  const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  function commonName(plant){
    const first=(Array.isArray(plant?.commonNames)?plant.commonNames:[])
      .find(name=>typeof name==="string"&&name.trim());
    return first?.trim()||"Unidentified specimen";
  }
  function sortedPlants(plants){
    return (Array.isArray(plants)?plants:[]).slice().sort((a,b)=>
      collator.compare(commonName(a),commonName(b))||
      collator.compare(String(a.name||""),String(b.name||""))||
      collator.compare(String(a.id||""),String(b.id||"")));
  }
  function plainText(html){
    return String(html||"")
      .replace(/<[^>]*>/g," ")
      .replace(/&(?:nbsp|#160);/gi," ")
      .replace(/&amp;/gi,"&")
      .replace(/&(?:rsquo|#8217);/gi,"’")
      .replace(/&(?:ldquo|rdquo|#8220|#8221);/gi,'"')
      .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
      .replace(/\s+/g," ").trim();
  }
  function notedDate(value){
    const match=String(value||"").match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if(!match)return null;
    const month=MONTHS[match[1].slice(0,3).toLowerCase()];
    const day=Number(match[2]),year=Number(match[3]);
    if(month==null||day<1||day>31)return null;
    const date=new Date(Date.UTC(year,month,day));
    return date.getUTCMonth()===month&&date.getUTCDate()===day?date:null;
  }
  function recentObservation(plant,now=new Date()){
    const notes=Array.isArray(plant?.history?.notes)?plant.history.notes:[];
    const today=new Date(now);
    if(!Number.isFinite(today.getTime()))return null;
    let best=null;
    for(const note of notes){
      const text=plainText(note?.bodyHtml);
      const date=notedDate(text);
      if(!date)continue;
      const age=(today.getTime()-date.getTime())/86400000;
      if(age<0||age>75)continue;
      // Catalog administration, plans, unverified guesses and negated growth
      // are not evidence that a plant is currently doing something interesting.
      if(/\b(planned|planning|intends?|hopes?|might|could|will|not confirmed|unverified|not yet|no (?:clear |measurable )?(?:new )?(?:growth|flower|roots?)|catalog (?:cover|photo)|photo uploaded|name confirmed|new swap accession|new purchase)\b/i.test(text))continue;
      if(!/\b(new (?:leaf|leaves|growth|shoots?|roots?)|emerging (?:leaf|leaves|growth)|unfurl(?:ing|ed)?|flower(?:ing|ed)?|bloom(?:ing|ed)?|buds?|pups?|offsets?|rooted|fenestrat(?:ed|ions?)|fresh growth)\b/i.test(text))continue;
      const cleaned=text.replace(/^(?:[A-Za-z]{3,9}\s+\d{1,2},?\s+20\d{2})\s*[·:—-]?\s*/,"").trim();
      if(!best||date>best.date)best={date,text:cleaned.slice(0,340)};
    }
    return best?{
      text:best.text,
      date:best.date.toISOString().slice(0,10),
      dateLabel:new Intl.DateTimeFormat("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric"}).format(best.date)
    }:null;
  }
  return Object.freeze({commonName,sortedPlants,recentObservation});
});
