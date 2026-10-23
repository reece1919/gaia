/* GAIA Learning Hub — practical care first, botany connected, one canonical plant card per ID.
   Read-only teaching views; existing photos/care/tasks stay on their original DOM cards.
*/
(() => {
  "use strict";
  const first = document.getElementById("gaia-clipboard");
  const last = document.getElementById("care-overview");
  if (!first || !last || first.parentElement !== last.parentElement) return;
  const parent = first.parentElement;
  const plantMap = new Map();
  const collections = {care:null,academy:null,botany:null};
  const titles = {care:"Care Center",academy:"Care Academy",botany:"Botanical Library"};
  let data = [];
  let active = "care";

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }
  function addText(container, tag, className, value) {
    const node = el(tag, className, value);
    container.appendChild(node);
    return node;
  }
  function action(label, fn, className = "") {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function plantLink(id, label, className = "") {
    const p = plantMap.get(String(id));
    if (!p) return null;
    const b = action(label || p.name, () => openPlant(p.id), "gaia-learning-plant-link " + className);
    b.setAttribute("aria-label", "Open care card for " + p.name);
    return b;
  }
  function reference(p) {
    const guide = window.GAIA_SPECIES_GUIDE;
    return guide?.taxa?.[guide.byPlant?.[p.id]] || null;
  }
  function family(p) {return reference(p)?.family || "Unclassified family";}
  function genus(p) {
    const taxon = reference(p)?.taxon || "";
    return taxon.split(" / ")[0].trim().split(/\s+/)[0] || "Undetermined genus";
  }
  function cardsAreReady() {
    return document.querySelectorAll("#grid > .card[data-plant-id]").length > 0;
  }

  // Move the existing, functioning Care Center as intact DOM nodes—not copies.
  const tabs = el("nav","gaia-hub-tabs");
  tabs.id = "gaia-hub-tabs";
  tabs.setAttribute("role","tablist");
  tabs.setAttribute("aria-label","GAIA main sections");
  parent.insertBefore(tabs,first);

  const care = el("main","gaia-hub-panel");
  care.id="gaia-care-center";
  care.setAttribute("role","tabpanel");
  care.setAttribute("aria-labelledby","gaia-tab-care");
  parent.insertBefore(care,first);
  let cursor=first;
  while (cursor) {
    const next=cursor.nextSibling;
    care.appendChild(cursor);
    if(cursor === last)break;
    cursor=next;
  }
  collections.care=care;

  const academy = el("section","gaia-hub-panel gaia-hub-education");
  academy.id="gaia-care-academy";
  academy.setAttribute("role","tabpanel");
  academy.setAttribute("aria-labelledby","gaia-tab-academy");
  academy.hidden=true;
  parent.insertBefore(academy,care.nextSibling);
  collections.academy=academy;

  const botany = el("section","gaia-hub-panel gaia-hub-education");
  botany.id="gaia-botanical-library";
  botany.setAttribute("role","tabpanel");
  botany.setAttribute("aria-labelledby","gaia-tab-botany");
  botany.hidden=true;
  parent.insertBefore(botany,academy.nextSibling);
  collections.botany=botany;

  const buttons={};
  [["care","clipboard-check"],["academy","book-open"],["botany","sprout"]].forEach(([key])=>{
    const b=el("button","gaia-hub-tab",titles[key]);
    b.id="gaia-tab-"+key;
    b.type="button";
    b.setAttribute("role","tab");
    b.setAttribute("aria-controls",collections[key].id);
    b.setAttribute("aria-selected",String(key==="care"));
    b.tabIndex=key==="care"?0:-1;
    b.addEventListener("click",()=>show(key));
    tabs.appendChild(b);
    buttons[key]=b;
  });
  tabs.addEventListener("keydown",e=>{
    if (!["ArrowRight","ArrowLeft","Home","End"].includes(e.key))return;
    const order=["care","academy","botany"];
    const current=order.findIndex(x=>buttons[x]===document.activeElement);
    if (current<0)return;
    e.preventDefault();
    const next=e.key==="Home"?0:e.key==="End"?2:
      (current+(e.key==="ArrowRight"?1:2))%3;
    show(order[next]);
    buttons[order[next]].focus();
  });

  function show(which) {
    if(!collections[which])return;
    active=which;
    for(const key of Object.keys(collections)){
      collections[key].hidden=key!==which;
      buttons[key].setAttribute("aria-selected",String(key===which));
      buttons[key].tabIndex=key===which?0:-1;
    }
    // No hidden original cards are moved or rebuilt during navigation.
  }

  // Tablet links still work if clicked after switching to a learning view.
  document.addEventListener("click",e=>{
    const link=e.target.closest?.('a[href^="#"]');
    if(!link)return;
    const hash=link.getAttribute("href")?.slice(1);
    if(!hash)return;
    const target=document.getElementById(hash);
    if(target && care.contains(target) && active!=="care")show("care");
  },true);

  function openPlant(id){
    const p=plantMap.get(String(id));
    if(!p)return;
    show("care");
    // The former grouped card layout moves nodes; switch to custom view before
    // locating and opening the original card. Its photo journal stays attached.
    window.GAIA_COLLECTION_BROWSER?.showCustomOrder?.(false);
    const search=document.getElementById("search");
    if(search?.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}
    const card=[...document.querySelectorAll("#grid > .card[data-plant-id]")].find(n=>n.dataset.plantId===String(id));
    if(!card)return;
    card.open=true;
    card.scrollIntoView({behavior:"smooth",block:"start"});
    card.querySelector(":scope > summary")?.focus({preventScroll:true});
  }

  const overview=el("section","gaia-care-overview-panel");
  overview.setAttribute("aria-labelledby","gaia-care-center-title");
  const head=el("div","gaia-hub-section-head");
  head.appendChild(addText(el("span","",""),"span","gaia-eyebrow","")); // overwritten below
  head.textContent="";
  const headingCopy=el("div");
  addText(headingCopy,"span","gaia-eyebrow","DAILY PRACTICE");
  addText(headingCopy,"h2","","Care Center");
  addText(headingCopy,"p","","Check the plant, understand the reason, then record what you observe. Existing care tasks, photos, and journals are below.");
  head.appendChild(headingCopy);
  overview.appendChild(head);
  const flags=el("div","gaia-care-priority-list");
  overview.appendChild(flags);
  care.insertBefore(overview,care.firstChild);

  function latestWatering(id){
    const entries=window.GAIA_CARE?.events?.() || [];
    const dates=entries.filter(x=>String(x.plant_id)===String(id)&&x.action_type==="water").map(x=>x.happened_on).filter(Boolean).sort();
    return dates.length?dates[dates.length-1]:null;
  }
  function refreshCardLearning(){
    if(!cardsAreReady())return;
    for (const p of data){
      const card=[...document.querySelectorAll("#grid > .card[data-plant-id]")].find(n=>n.dataset.plantId===String(p.id));
      const grid=card?.querySelector(".care-grid");
      if(!grid)continue;
      let panel=grid.querySelector(":scope > .gaia-care-reason");
      if(!panel){
        panel=el("section","gaia-care-reason");
        grid.insertBefore(panel,grid.firstChild);
      }
      panel.replaceChildren();
      const title=el("h3","","Care reasoning · "+p.name);
      panel.appendChild(title);
      const current=el("div","gaia-care-reason-facts");
      const light=p.cardCare?.light||"";
      const lightName={
        "full-sun":"Full sun","very-bright":"Very bright",
        "bright":"Bright light","bright-indirect":"Bright indirect",
        "medium":"Medium to bright indirect","flexible":"Low to bright"
      }[light]||"Check individual profile";
      [["Light guideline",lightName],["Watering cue",p.cardCare?.waterLabel||"Check individual profile"],
      ["Last logged watering",latestWatering(p.id)||"No watering entry recorded"]].forEach(([label,value])=>{
        const item=el("div");
        addText(item,"strong","",label);
        addText(item,"span","",value);
        current.appendChild(item);
      });
      const profile=window.GAIA_POT_SOIL?.profile?.(p.id);
      if(profile?.soil_mix){
        const item=el("div");
        addText(item,"strong","","Recorded soil mix");
        addText(item,"span","",profile.soil_mix);
        current.appendChild(item);
      }
      panel.appendChild(current);
      const type=window.GAIA_GROUP_LEARNING?.types?.[p.cardCare?.type];
      if(type){
        addText(panel,"p","gaia-care-reason-explainer",type.conditions);
        addText(panel,"p","gaia-care-reason-caveat",
          "General growth-pattern guidance, not a fixed watering schedule. Compare it with this plant’s care notes and current soil condition.");
      }
      const links=el("div","gaia-care-reason-links");
      links.appendChild(action("Learn the care principles",()=>{show("academy");focusLesson("water");}));
      links.appendChild(action("Explore "+family(p),()=>{show("botany");focusFamily(family(p));}));
      panel.appendChild(links);
    }
  }

  function renderCarePriorities(){
    flags.replaceChildren();
    const attention=data.filter(p=>!["Good","Excellent"].includes(p.status));
    const caption=el("p","gaia-care-priority-note",
      "Based on saved catalog condition labels—not a live diagnosis or automatic watering alert. Inspect soil, roots and recent observations before acting.");
    flags.appendChild(caption);
    if(!data.length)return;
    const list=el("div","gaia-care-priority-grid");
    const sample=(attention.length?attention:data).slice(0,6);
    for(const p of sample){
      const item=el("article","gaia-care-priority-item");
      const top=el("div","gaia-care-priority-top");
      addText(top,"strong","",p.name);
      addText(top,"span","gaia-care-catalog-status",p.status||"Condition not recorded");
      item.appendChild(top);
      const next=p.sections?.find(s=>s.label==="NEXT ACTION")?.bodyHtml||"Inspect the plant and check its current soil moisture before choosing care.";
      const div=el("div");
      div.innerHTML=next; // Already-rendered, trusted catalog care HTML (never user submissions).
      addText(item,"p","",div.textContent.trim().slice(0,215)+(div.textContent.trim().length>215?"…":""));
      const row=el("div","gaia-care-priority-actions");
      const b=plantLink(p.id,"Open care record ↗");
      if(b)row.appendChild(b);
      item.appendChild(row);
      list.appendChild(item);
    }
    flags.appendChild(list);
    if(attention.length>sample.length)addText(flags,"p","gaia-care-priority-tail",
      (attention.length-sample.length)+" additional catalog flags: view the plant cards and GAIA Insights below.");
  }

  const lessons=[
    {id:"water",title:"Water the roots, not the calendar",tag:"Watering",lead:"Learn how to decide whether a plant needs water, rather than following an arbitrary weekly schedule.",
      why:"Roots need both water and oxygen. A soggy medium can starve roots of air; a dry medium can dehydrate plants. Pot size, soil, light, temperature and growth rate all change how quickly water is used.",
      steps:["Check moisture within the root zone, not just at the surface. Use your meter consistently and note its scale.","Compare the reading with the specific plant's dry-down cue and with how heavy the pot feels.","When watering is indicated, wet the root zone evenly and let excess water drain; verify the central root ball absorbs water.","Record the date and reading, then observe new growth and leaf condition before changing the routine."],
      watch:"Wilting alone cannot distinguish dry roots from damaged, waterlogged roots. Inspect the soil before adding water.",
      practice:["02","12","24","04"]},
    {id:"light",title:"Understand light intensity and duration",tag:"Light",lead:"Bright indirect, direct sun and grow-light exposure are different—and plants adapt at different speeds.",
      why:"Light powers photosynthesis, but excess light can damage leaves. Intensity at the leaf surface falls as many lamps are moved farther away, and seasonal windows change.",
      steps:["Use each plant's stated light preference as a starting point.","Track window direction, lamp distance and hours of exposure, rather than describing a location as simply 'bright'.","Watch for stretched stems, smaller leaves, washed-out patches or scorch; adjust gradually.","Keep the day/night cycle reasonably consistent and compare growth after changes."],
      watch:"More light does not fix root problems or an incorrect soil mix.",
      practice:["02","13","32","42"]},
    {id:"roots",title:"Pots, drainage, and air around roots",tag:"Soil & pots",lead:"Match the mix and container to how a species uses water—and learn why potting up too soon can backfire.",
      why:"Soil structure controls both moisture retention and air spaces. Fine compacted material in a large pot may stay wet long after the leaves look dry.",
      steps:["Record inner pot diameter/depth, drainage holes and soil ingredients.","Choose particle size and water retention according to the actual species, not simply 'tropical' or 'succulent'.","Check the root ball when growth or moisture behavior suggests a problem; avoid needless repotting.","When repotting, prioritize a modest step up in root space and a drainage-capable inner pot."],
      watch:"Clear inner pots can aid observation, but light exposure, algae and root disturbance still matter; they are not necessary for every plant.",
      practice:["15","18","24","48"]},
    {id:"climate",title:"Temperature, humidity, and airflow",tag:"Environment",lead:"Understand why a plant can struggle in a warm room, or survive dry air but decline in cold soil.",
      why:"Temperature alters water use and root activity. Humidity influences transpiration, while airflow helps wet leaves and crowns dry.",
      steps:["Check room and root-zone temperatures near windows, exterior walls and heaters.","Group humidity-sensitive plants when practical, without crowding leaves.","Keep plants clear of hot heater drafts and cold glass.","After bathing or misting foliage, ensure leaves and crowns can dry appropriately."],
      watch:"A humidity-loving plant does not necessarily want constantly wet potting soil.",
      practice:["12","19","31","05"]},
    {id:"pests",title:"Recognize pests before treating",tag:"Pest management",lead:"Learn to identify spider mites and other common problems without treating every imperfect leaf as infestation.",
      why:"Pest identification, isolation and repeated inspections are more reliable than guessing from one yellow leaf.",
      steps:["Inspect undersides of leaves, stem junctions and new growth using consistent lighting.","Record evidence such as webbing, moving specks, stippling, or cottony deposits.","Isolate an affected plant as appropriate and follow a product label or safe physical cleaning approach.","Recheck on subsequent days; many pest life cycles require repeated observation."],
      watch:"A recently washed plant may also show stress from cold water, handling, soap residue or wet soil. Distinguish those from active pests.",
      practice:["15","16","24","43"]},
    {id:"growth",title:"Read growth and propagate intentionally",tag:"Growth",lead:"Identify healthy growth signals and learn the difference between runners, offsets, nodes, and roots.",
      why:"New leaves, viable nodes and vigorous roots help assess progress. Different plant groups reproduce with fundamentally different structures.",
      steps:["Log new leaves, shoots, nodes, aerial roots and offsets in the plant's observations.","Photograph from a comparable angle roughly every two weeks to see actual trends.","Learn whether the plant propagates from a node, division, runner, offset, or seed before cutting.","Wait until the parent and propagule are healthy and appropriately mature."],
      watch:"An orchid aerial root and a Tradescantia rooting node are not interchangeable propagation structures.",
      practice:["46","48","06","36"]},
    {id:"dormancy",title:"Seasonality and winter dormancy",tag:"Seasons",lead:"Some plants need seasonal signals; other houseplants simply grow more slowly in winter.",
      why:"Dormancy can be a normal life-cycle requirement rather than an illness. Indoor warmth alone is not always appropriate, especially for temperate carnivorous plants.",
      steps:["Identify species with genuine seasonal dormancy before moving them into continuous indoor growth.","Adjust watering to lower growth and slower evaporation, never just because a month changed.","Keep the light, temperature and dormancy needs of each species distinct.","Record when growth slows and resumes, and compare with expected species behavior."],
      watch:"Venus flytraps require a winter rest; Sempervivum is also adapted to outdoor seasons. Neither should be treated as a generic tropical houseplant.",
      practice:["04","22","02","18"]}
  ];
  const careGroups=[
    {title:"Dry-adapted roots and tissues",cue:"Often tolerate substantial drying, but differ in preferred light and winter temperatures.",ids:["02","03","07","22","28","39","41","47"]},
    {title:"Moderate dry-down",cue:"Water according to root-zone moisture, pot size and individual cues; not an identical schedule.",ids:["16","24","36","37","38","48"]},
    {title:"More consistent moisture",cue:"Many dislike deep, repeated drought—but still require oxygen and drainage around roots.",ids:["12","14","19","32"]},
    {title:"Special watering or growing methods",cue:"Media, water mineral content and drying behavior can be very different from ordinary houseplants.",ids:["04","18","29","31","06","23"]},
    {title:"Important seasonal patterns",cue:"Learn winter dormancy or seasonal changes before choosing year-round conditions.",ids:["04","22"]}
  ];

  const academyHeading=el("div","gaia-hub-section-head");
  addText(academyHeading,"span","gaia-eyebrow","LEARN BY PRACTICE");
  addText(academyHeading,"h2","","Care Academy");
  addText(academyHeading,"p","","The 'what', 'why', and 'how' of plant care. Study a topic, then practice on the real plants you own. Recommendations are educational, not live diagnoses.");
  academy.appendChild(academyHeading);

  const academyNavigation=el("nav","gaia-academy-jump");
  academyNavigation.setAttribute("aria-label","Care lesson topics");
  academy.appendChild(academyNavigation);
  const lessonHolder=el("div","gaia-academy-lessons");
  academy.appendChild(lessonHolder);
  addText(academy,"h3","gaia-hub-subtitle","Compare your plants by care pattern");
  addText(academy,"p","gaia-care-priority-note",
    "These are overlapping learning examples, not automatic watering zones. Each plant's own care profile takes priority.");
  const groupsHolder=el("div","gaia-academy-groups");
  academy.appendChild(groupsHolder);

  function renderAcademy(){
    academyNavigation.replaceChildren();
    lessonHolder.replaceChildren();
    groupsHolder.replaceChildren();
    for(const lesson of lessons){
      const target="gaia-academy-"+lesson.id;
      const link=action(lesson.tag,()=>focusLesson(lesson.id),"gaia-academy-topic-link");
      academyNavigation.appendChild(link);
      const panel=el("details","gaia-academy-topic");
      panel.id=target;
      const summary=el("summary","",lesson.title);
      panel.appendChild(summary);
      const body=el("div","gaia-academy-topic-body");
      addText(body,"p","gaia-academy-lead",lesson.lead);
      addText(body,"h4","","Why it matters");
      addText(body,"p","",lesson.why);
      addText(body,"h4","","What to practice");
      const steps=el("ol","gaia-academy-steps");
      lesson.steps.forEach(item=>addText(steps,"li","",item));
      body.appendChild(steps);
      addText(body,"p","gaia-academy-watch","Watch out: "+lesson.watch);
      const links=el("div","gaia-academy-plant-links");
      addText(links,"strong","","Try this with your plants:");
      lesson.practice.forEach(id=>{const button=plantLink(id);if(button)links.appendChild(button);});
      body.appendChild(links);
      panel.appendChild(body);
      lessonHolder.appendChild(panel);
    }
    for(const group of careGroups){
      const card=el("section","gaia-academy-group");
      addText(card,"h4","",group.title);
      addText(card,"p","",group.cue);
      const links=el("div","gaia-academy-plant-links");
      group.ids.forEach(id=>{const button=plantLink(id);if(button)links.appendChild(button);});
      card.appendChild(links);
      groupsHolder.appendChild(card);
    }
  }
  function focusLesson(id){
    const target=document.getElementById("gaia-academy-"+id);
    if(!target)return;
    target.open=true;
    target.scrollIntoView({behavior:"smooth",block:"start"});
  }

  const botanicalHeading=el("div","gaia-hub-section-head");
  addText(botanicalHeading,"span","gaia-eyebrow","THE PLANT FAMILY TREE");
  addText(botanicalHeading,"h2","","Botanical Library");
  addText(botanicalHeading,"p","","Browse family → genus → your individual plants. The species labels and cultivar names come from your catalog; uncertain identifications stay marked as uncertain.");
  botany.appendChild(botanicalHeading);
  const distinction=el("p","gaia-botany-distinction",
    "Botanical family describes evolutionary relationships, not a shared watering schedule. A growing category such as 'succulent' can include many unrelated families.");
  botany.appendChild(distinction);
  const searchLabel=el("label","gaia-botany-search-label","Find a family, genus or plant");
  const botanySearch=el("input","gaia-botany-search");
  botanySearch.type="search";
  botanySearch.placeholder="e.g. Araceae, Monstera, Groot…";
  botanySearch.id="gaia-botany-search";
  searchLabel.htmlFor=botanySearch.id;
  botany.append(searchLabel,botanySearch);
  const botanyCount=el("p","gaia-botany-count");
  botanyCount.setAttribute("role","status");
  botany.appendChild(botanyCount);
  const familyHolder=el("div","gaia-botany-families");
  botany.appendChild(familyHolder);
  const sorter=new Intl.Collator(undefined,{sensitivity:"base",numeric:true});

  function renderBotany(){
    familyHolder.replaceChildren();
    const families=new Map();
    for(const p of data){
      const f=family(p);
      const g=genus(p);
      if(!families.has(f))families.set(f,new Map());
      const genera=families.get(f);
      if(!genera.has(g))genera.set(g,[]);
      genera.get(g).push(p);
    }
    for(const [name,genera] of [...families.entries()].sort((a,b)=>sorter.compare(a[0],b[0]))){
      const members=[...genera.values()].flat();
      const section=el("details","gaia-botany-family");
      section.dataset.family=name;
      section.dataset.search=(name+" "+members.map(p=>[p.name,p.species,(p.commonNames||[]).join(" ")].join(" ")).join(" ")).toLowerCase();
      const head=el("summary");
      addText(head,"strong","",name);
      addText(head,"span","",members.length+" "+(members.length===1?"plant":"plants")+" · "+genera.size+" "+(genera.size===1?"genus":"genera"));
      section.appendChild(head);
      const inner=el("div","gaia-botany-family-inner");
      const info=window.GAIA_GROUP_LEARNING?.families?.[name];
      if(info){
        addText(inner,"p","gaia-botany-family-about",info.about);
        const learn=el("details","gaia-botany-learn");
        learn.appendChild(el("summary","","Learn to recognize this family & its care patterns"));
        const learner=el("div","gaia-botany-learn-body");
        [["How to recognize it",info.recognize],["General conditions",info.conditions],["Interesting fact",info.learn]].forEach(([title,body])=>{
          addText(learner,"h4","",title);
          addText(learner,"p","",body);
        });
        learn.appendChild(learner);
        inner.appendChild(learn);
      }
      for(const [g,members] of [...genera.entries()].sort((a,b)=>sorter.compare(a[0],b[0]))){
        const genusBox=el("section","gaia-botany-genus");
        addText(genusBox,"h4","","Genus · "+g);
        const rows=el("div","gaia-botany-plant-rows");
        for(const p of members.sort((a,b)=>sorter.compare(a.name,b.name))){
          const row=el("div","gaia-botany-plant-row");
          const names=el("div");
          addText(names,"strong","",p.name);
          addText(names,"span","gaia-botany-scientific",p.species||reference(p)?.taxon||"Unconfirmed taxon");
          if(p.commonNames?.length)addText(names,"small","",p.commonNames.join(" · "));
          const broad=reference(p)?.taxon||"";
          if(/\blikely\b|unconfirmed|(?:-type)|\bsp\./i.test(p.species||"") || !broad.includes(" ")){
            addText(names,"small","gaia-botany-uncertain","Identification may be genus-level or tentative");
          }
          row.appendChild(names);
          const b=plantLink(p.id,"View care ↗");
          if(b)row.appendChild(b);
          rows.appendChild(row);
        }
        genusBox.appendChild(rows);
        inner.appendChild(genusBox);
      }
      const more=el("a","gaia-botany-source","Research this family at Kew ↗");
      more.href="https://powo.science.kew.org/results?q="+encodeURIComponent(name);
      more.target="_blank";
      more.rel="noopener noreferrer";
      inner.appendChild(more);
      section.appendChild(inner);
      familyHolder.appendChild(section);
    }
    filterBotany();
  }
  function filterBotany(){
    const q=botanySearch.value.trim().toLowerCase();
    let matched=0;
    for(const node of familyHolder.children){
      node.hidden=!!q&&!node.dataset.search.includes(q);
      if(!node.hidden)matched++;
    }
    botanyCount.textContent=matched+" "+(matched===1?"family":"families")+" shown · "+data.length+" plants in the collection";
  }
  botanySearch.addEventListener("input",filterBotany);
  function focusFamily(name){
    botanySearch.value="";
    filterBotany();
    const section=[...familyHolder.children].find(node=>node.dataset.family===name);
    if(!section)return;
    section.open=true;
    section.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function setup(records){
    if(!Array.isArray(records)||!records.length)return;
    data=records;
    plantMap.clear();
    records.forEach(p=>plantMap.set(String(p.id),p));
    renderCarePriorities();
    renderAcademy();
    renderBotany();
    refreshCardLearning();
    window.GAIA_COLLECTION_BROWSER?.showCustomOrder?.(false);
  }
  document.addEventListener("gaia:ready",event=>setup(event.detail?.plants));
  document.addEventListener("gaia:care-synced",refreshCardLearning);
  document.addEventListener("gaia:clipboard-saved",refreshCardLearning);
  if(window.GAIA_DATA?.plants)setup(window.GAIA_DATA.plants);
  window.GAIA_LEARNING_HUB={show,openPlant};
})();
