/* The Conservatory: an A–Z botanical field journal over the EXISTING plant cards.
   Journal pages are presentation only; original cards, photo forms, tasks,
   custom order, private care and login controls remain in place. */
(() => {
  "use strict";
  const core=window.GAIA_BOTANICAL_JOURNAL_CORE;
  const care=document.getElementById("gaia-care-center");
  const grid=document.getElementById("grid");
  if(!core||!care||!grid||document.getElementById("gaia-botanical-journal"))return;

  const node=(tag,className,text)=>{
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!=null)e.textContent=String(text);
    return e;
  };
  const button=(label,onClick,className)=>{
    const e=node("button",className,label);
    e.type="button";e.addEventListener("click",onClick);return e;
  };
  const pair=(parent,label,value)=>{
    if(!value)return;
    const row=node("div","gaia-journal-data-pair");
    row.append(node("dt","",label),node("dd","",value));
    parent.appendChild(row);
  };
  const LIGHT={
    "full-sun":"Full sun","very-bright":"Very bright",
    "bright":"Bright light","bright-indirect":"Bright indirect",
    "medium":"Medium to bright indirect","flexible":"Flexible light"
  };
  const MEDIUM={
    "well-drained":"Well-draining mix","gritty":"Gritty succulent mix",
    "chunky":"Chunky aroid mix","moisture":"Moisture-retentive airy mix",
    "airy":"Aerated mix","bromeliad":"Bromeliad mix",
    "orchid":"Orchid bark","carnivorous":"Nutrient-poor carnivorous mix",
    "water-grown":"Water grown","no-soil":"Air plant"
  };
  let plants=[],position=0;
  const section=node("section","gaia-botanical-journal");
  section.id="gaia-botanical-journal";
  section.setAttribute("aria-label","My botanical field journal");
  const top=node("header","gaia-journal-header");
  const intro=node("div","gaia-journal-intro");
  intro.append(
    node("span","gaia-journal-overline","THE CONSERVATORY · PERSONAL HERBARIUM"),
    node("h2","","The Field Journal"),
    node("p","","Your living collection, filed by common name. Turn the pages to explore individual specimens.")
  );
  const modes=node("div","gaia-journal-view-switch");
  modes.setAttribute("role","group");modes.setAttribute("aria-label","Collection display");
  const journalMode=button("Journal",()=>setView("journal"),"gaia-journal-mode-button");
  const cardsMode=button("All plant cards",()=>setView("cards"),"gaia-journal-mode-button");
  modes.append(journalMode,cardsMode);
  top.append(intro,modes);

  const indexBar=node("div","gaia-journal-index-bar");
  const indexLabel=node("label","gaia-journal-index-label","Common-name index · A–Z");
  const index=node("select","gaia-journal-index");
  index.id="gaia-journal-index";
  index.setAttribute("aria-label","Jump to a plant, alphabetically by common name");
  indexLabel.appendChild(index);
  const filing=node("span","gaia-journal-filing","Alphabetical field index");
  indexBar.append(indexLabel,filing);

  const leaf=node("article","gaia-journal-leaf");
  leaf.id="gaia-journal-leaf";
  leaf.tabIndex=0;
  leaf.setAttribute("aria-roledescription","journal page");
  const pagination=node("nav","gaia-journal-pagination");
  pagination.setAttribute("aria-label","Turn botanical journal pages");
  const previous=button("← Previous",()=>turn(-1),"gaia-journal-page-button");
  const marker=node("span","gaia-journal-page-marker");
  marker.setAttribute("role","status");
  marker.setAttribute("aria-live","polite");
  const next=button("Next →",()=>turn(1),"gaia-journal-page-button");
  pagination.append(previous,marker,next);
  section.append(top,indexBar,leaf,pagination);
  const overview=care.querySelector(".gaia-care-overview-panel");
  if(overview)overview.after(section);else care.prepend(section);

  function setView(view){
    const isJournal=view==="journal";
    care.classList.toggle("gaia-journal-mode",isJournal);
    care.classList.toggle("gaia-journal-card-mode",!isJournal);
    journalMode.setAttribute("aria-pressed",String(isJournal));
    cardsMode.setAttribute("aria-pressed",String(!isJournal));
    if(isJournal)render();
  }
  function turn(delta){
    if(!plants.length)return;
    position=Math.min(plants.length-1,Math.max(0,position+delta));
    render();
  }
  function findCard(id){
    return [...grid.querySelectorAll(":scope > .card[data-plant-id]")]
      .find(c=>c.dataset.plantId===String(id));
  }
  function openFullRecord(id){
    setView("cards");
    window.GAIA_COLLECTION_BROWSER?.showCustomOrder?.(false);
    const search=document.getElementById("search");
    if(search?.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}
    const card=findCard(id);
    if(!card)return;
    card.open=true;
    card.scrollIntoView({behavior:"smooth",block:"start"});
    card.querySelector(":scope > summary")?.focus({preventScroll:true});
  }
  function render(){
    if(!plants.length)return;
    const p=plants[position];
    const currentId=String(p.id);
    const name=core.commonName(p);
    const guide=window.GAIA_SPECIES_GUIDE;
    const ref=guide?.taxa?.[guide.byPlant?.[currentId]];
    const observation=core.recentObservation(p);
    const page=node("div","gaia-journal-spread");

    const artwork=node("figure","gaia-journal-plate");
    const figure=node("div","gaia-journal-image-frame");
    const cardPhoto=findCard(currentId)?.querySelector(":scope > summary .photo img");
    const imageUrl=cardPhoto?.getAttribute("src")||p.coverPhoto||p.photo;
    if(imageUrl){
      const img=node("img","gaia-journal-photo");
      img.src=imageUrl;
      img.alt=p.photoAlt||("Portrait of "+p.name+", "+name);
      img.loading="lazy";img.decoding="async";
      figure.appendChild(img);
    }else{
      figure.appendChild(node("p","gaia-journal-photo-placeholder","Illustration pending\nNo photograph recorded"));
    }
    const plateLabel=node("figcaption","gaia-journal-plate-caption");
    plateLabel.append(
      node("span","","PLATE "+currentId),
      node("span","","PRIVATE COLLECTION · CATALOG SPECIMEN")
    );
    artwork.append(figure,plateLabel);

    const profile=node("div","gaia-journal-specimen");
    profile.appendChild(node("span","gaia-journal-kicker","SPECIMEN "+currentId+" · "+(position+1)+" / "+plants.length));
    const heading=node("h3","gaia-journal-common-name",name);
    heading.id="gaia-journal-title";
    leaf.setAttribute("aria-labelledby",heading.id);
    profile.append(heading,node("p","gaia-journal-nickname","Known as "+p.name));
    profile.appendChild(node("p","gaia-journal-latin",p.species||"Identification pending"));

    const details=node("dl","gaia-journal-taxonomy");
    pair(details,"Family",ref?.family||"Not established");
    pair(details,"Botanical reference",ref?.taxon||"Identification requires confirmation");
    pair(details,"Habit",ref?.habit);
    if(ref?.native)pair(details,"Native range",ref.native);
    profile.appendChild(details);

    const recent=node("section","gaia-journal-observation");
    recent.appendChild(node("h4","","From the field notes"));
    if(observation){
      recent.appendChild(node("small","gaia-journal-note-date","Recorded "+observation.dateLabel));
      recent.appendChild(node("p","",observation.text));
    }else{
      recent.appendChild(node("p","gaia-journal-no-observation",
        "No recent growth milestone has been documented for this specimen. New leaves, blooms, or other discoveries can be recorded in its plant history."));
    }
    profile.appendChild(recent);

    const species=node("section","gaia-journal-species-notes");
    species.appendChild(node("h4","","Natural history"));
    species.appendChild(node("p","",ref?.trait||
      "This specimen has no verified species-level reference yet. Its recorded identity remains provisional."));
    if(ref?.propagation)species.appendChild(node("small","","Typical propagation: "+ref.propagation));
    profile.appendChild(species);

    const careFacts=node("dl","gaia-journal-care-facts");
    const card=p.cardCare||{};
    pair(careFacts,"Light",LIGHT[card.light]);
    pair(careFacts,"Water cue",card.waterLabel);
    pair(careFacts,"Medium",MEDIUM[card.soil]);
    pair(careFacts,"Catalog condition",p.status||"Not assessed");
    profile.appendChild(careFacts);

    profile.appendChild(button("Open "+p.name+"'s complete record →",
      ()=>openFullRecord(currentId),"gaia-journal-full-record"));
    page.append(artwork,profile);
    leaf.replaceChildren(page);
    index.value=currentId;
    marker.textContent="Folio "+(position+1)+" of "+plants.length;
    previous.disabled=position===0;
    next.disabled=position===plants.length-1;
    previous.setAttribute("aria-label","Previous plant in common-name order");
    next.setAttribute("aria-label","Next plant in common-name order");
  }
  function load(data){
    if(plants.length||!Array.isArray(data?.plants)||!data.plants.length)return;
    plants=core.sortedPlants(data.plants);
    const fragment=document.createDocumentFragment();
    for(const p of plants){
      const option=node("option","",core.commonName(p)+" · "+p.name);
      option.value=String(p.id);
      fragment.appendChild(option);
    }
    index.replaceChildren(fragment);
    filing.textContent=plants.length+" specimens · alphabetized by common name";
    setView("journal");
  }
  index.addEventListener("change",()=>{
    const at=plants.findIndex(p=>String(p.id)===index.value);
    if(at>=0){position=at;render();}
  });
  leaf.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
    if(event.target.closest?.("button,select,input,textarea,a"))return;
    event.preventDefault();turn(event.key==="ArrowRight"?1:-1);
  });
  let touch=null;
  leaf.addEventListener("touchstart",event=>{
    const t=event.changedTouches[0];if(t)touch={x:t.clientX,y:t.clientY};
  },{passive:true});
  leaf.addEventListener("touchend",event=>{
    if(!touch)return;
    const t=event.changedTouches[0];
    if(t){
      const dx=t.clientX-touch.x,dy=t.clientY-touch.y;
      if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)turn(dx<0?1:-1);
    }
    touch=null;
  },{passive:true});

  window.GAIA_BOTANICAL_JOURNAL=Object.freeze({
    open(id){
      const at=plants.findIndex(p=>String(p.id)===String(id));
      if(at<0)return false;
      position=at;setView("journal");render();
      section.scrollIntoView({behavior:"smooth",block:"start"});
      return true;
    },
    showCards(){setView("cards");},
    showJournal(){setView("journal");}
  });
  document.addEventListener("gaia:photos-changed",()=>{if(care.classList.contains("gaia-journal-mode"))render();});
  document.addEventListener("gaia:ready",event=>load({plants:event.detail?.plants}));
  if(window.GAIA_DATA?.plants&&grid.querySelector(":scope > .card[data-plant-id]"))load(window.GAIA_DATA);
})();
