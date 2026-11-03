/* Daily Care Inbox: rearranges existing task controls without cloning or changing their data. */
(() => {
  "use strict";
  const inbox=document.getElementById("gaia-tasks");
  const content=inbox?.querySelector(".gaia-task-content");
  const todoist=content?.querySelector(".gaia-unified-todoist");
  const checklist=document.getElementById("gaia-checklist-section");
  const decisions=document.getElementById("gaia-task-approvals");
  const priorities=content?.querySelector(".gaia-unified-priorities");
  if(!content||!todoist||!checklist||!decisions||!priorities||
     content.querySelector(".gaia-inbox-tabs"))return;

  const make=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const intro=make("p","gaia-inbox-intro",
    "Do your next care check, decide on suggested actions, or review the latest recommendations. Tasks stay in their original systems.");
  const nav=make("div","gaia-inbox-tabs");
  nav.setAttribute("role","tablist");
  nav.setAttribute("aria-label","Daily care inbox views");
  const tabs=new Map();
  const panels=new Map();
  const views=[
    {key:"do",title:"Do",description:"Open tasks — GAIA and Todoist are separate checklists."},
    {key:"decide",title:"Decide",description:"Review suggestions before adding them to your GAIA checklist."},
    {key:"monitor",title:"Monitor",description:"Saved AI priorities are advice, not approved tasks or live sensor readings."}
  ];
  for(const item of views){
    const button=make("button","gaia-inbox-tab",item.title);
    button.type="button";
    button.id="gaia-inbox-tab-"+item.key;
    button.dataset.gaiaInboxTab=item.key;
    button.setAttribute("role","tab");
    button.setAttribute("aria-controls","gaia-inbox-panel-"+item.key);
    const badge=make("span","gaia-inbox-count");
    badge.dataset.gaiaInboxCount=item.key;
    badge.hidden=true;
    button.appendChild(badge);
    nav.appendChild(button);
    tabs.set(item.key,button);
    const panel=make("section","gaia-inbox-panel");
    panel.id="gaia-inbox-panel-"+item.key;
    panel.setAttribute("role","tabpanel");
    panel.setAttribute("aria-labelledby",button.id);
    panel.appendChild(make("p","gaia-inbox-panel-note",item.description));
    panels.set(item.key,panel);
  }
  function select(key,focus=false){
    for(const [id,button] of tabs){
      const active=id===key;
      button.setAttribute("aria-selected",String(active));
      button.tabIndex=active?0:-1;
      panels.get(id).hidden=!active;
    }
    if(focus)tabs.get(key)?.focus();
  }
  for(const [key,button] of tabs){
    button.addEventListener("click",()=>select(key));
    button.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();
      const keys=[...tabs.keys()];
      const index=keys.indexOf(key);
      const next=event.key==="Home"?0:event.key==="End"?keys.length-1:
        (index+(event.key==="ArrowRight"?1:-1)+keys.length)%keys.length;
      select(keys[next],true);
    });
  }

  const doPanel=panels.get("do");
  doPanel.appendChild(make("h3","gaia-inbox-source-heading","Todoist · GAIA label"));
  doPanel.appendChild(todoist);
  const checklistHeading=checklist.querySelector("summary");
  if(checklistHeading)checklistHeading.textContent="GAIA checklist · saved follow-ups";
  const legacyDescription=checklist.querySelector("p");
  if(legacyDescription)legacyDescription.textContent=
    "These are GAIA's own tasks. Completing one does not complete its Todoist match or log watering, fertilizer, or treatment.";
  checklist.hidden=false;
  checklist.removeAttribute("aria-hidden");
  doPanel.appendChild(checklist);

  const decidePanel=panels.get("decide");
  const approvalHeading=decisions.querySelector("h2");
  if(approvalHeading)approvalHeading.textContent="Suggestions awaiting your decision";
  const approvalDescription=decisions.querySelector("p");
  if(approvalDescription)approvalDescription.textContent=
    "Approve to add a GAIA checklist task, or decline. Photo reminders are proposals, not proof that care is needed.";
  decidePanel.appendChild(decisions);
  panels.get("monitor").appendChild(priorities);

  content.replaceChildren(intro,nav,...panels.values());
  const title=inbox.querySelector(".gaia-task-summary-title");
  if(title){
    const label=title.lastChild;
    if(label?.nodeType===3)label.textContent=" Daily Care Inbox";
    else title.appendChild(document.createTextNode(" Daily Care Inbox"));
  }
  const progress=document.getElementById("gaia-task-progress");
  if(progress)progress.hidden=false;
  inbox.setAttribute("aria-label","Daily Care Inbox");
  inbox.open=true;
  select("do");

  let authenticated=Boolean(window.GAIA_CLOUD?.user);
  const proposalList=document.getElementById("gaia-task-queue-content");
  const taskList=document.getElementById("gaia-task-list");
  const todoistList=todoist.querySelector(".system-todoist-list");
  function renderCounts(){
    const openGaia=taskList?.querySelectorAll(".gaia-task-item:not(.is-done)").length||0;
    const suggested=proposalList?.querySelectorAll("[data-gaia-approve]").length||0;
    const todoistOpen=todoistList?.querySelectorAll("[data-st-complete]").length||0;
    const counts={do:openGaia,decide:suggested};
    for(const key of ["do","decide"]){
      const badge=tabs.get(key)?.querySelector(".gaia-inbox-count");
      if(!badge)continue;
      badge.hidden=!authenticated;
      badge.textContent=authenticated?String(counts[key]):"";
      badge.setAttribute("aria-label",key==="do"?
        openGaia+" GAIA checklist tasks":suggested+" suggestions awaiting approval");
    }
    const description=doPanel.querySelector(".gaia-inbox-panel-note");
    if(description)description.textContent=authenticated?
      "GAIA checklist: "+openGaia+" open · Todoist: "+todoistOpen+
      " shown. These counts are separate and may refer to overlapping actions.":
      "Sign in under Tools & reviews → Settings & Backup to load your private tasks.";
  }
  if(typeof MutationObserver!=="undefined"){
    const observer=new MutationObserver(renderCounts);
    for(const target of [taskList,proposalList,todoistList])
      if(target)observer.observe(target,{childList:true,subtree:true});
  }
  document.addEventListener("gaia:auth",event=>{
    authenticated=Boolean(event.detail?.user);
    renderCounts();
  });
  renderCounts();
})();