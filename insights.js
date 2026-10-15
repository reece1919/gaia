/* GAIA — read-only GAIA insights.
   Reads private GAIA AI review records from the owner's Supabase session.
   No OpenAI API calls and no writes. AI suggestions never become care history. */
(() => {
  "use strict";
  const panel = document.getElementById("gaia-insights");
  if (!panel) return;

  const stamp = document.getElementById("gaia-insights-stamp");
  const body = document.getElementById("gaia-insights-body");
  const button = document.getElementById("gaia-insights-refresh");
  const status = document.getElementById("gaia-insights-status");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const MAX_PRIORITIES = 5;
  let client = null, user = null, latest = null;
  let busy = false, error = "", sequence = 0, lastCheckedAt = 0;

  function dateText(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "Undated";
    const [year,month,day] = date.split("-").map(Number);
    const value = new Date(year, month-1, day);
    if (value.getFullYear() !== year || value.getMonth() !== month-1 ||
        value.getDate() !== day) return "Undated";
    return new Intl.DateTimeFormat(undefined, {
      month:"short", day:"numeric", year:"numeric"
    }).format(value);
  }

  function validPriorities(raw) {
    let records = raw;
    if (typeof records === "string") {
      try { records = JSON.parse(records); } catch (_) { return []; }
    }
    if (!Array.isArray(records)) return [];
    const names = new Map((window.GAIA_DATA?.plants || [])
      .map(plant => [String(plant.id), String(plant.name)]));
    return records.slice(0,MAX_PRIORITIES).map(priority => {
      if (typeof priority === "string")
        return {title:priority.trim().slice(0,300), rationale:"", plant:"", plant_id:null};
      if (!priority || typeof priority !== "object" || Array.isArray(priority))
        return null;
      const title = String(priority.title || priority.action || priority.task || "").trim().slice(0,300);
      const rationale = String(priority.rationale || priority.reason ||
        priority.detail || priority.description || "").trim().slice(0,1200);
      const id = priority.plant_id == null ? "" : String(priority.plant_id);
      return {title,rationale,plant:names.get(id)||"",plant_id:id||null};
    }).filter(p => p && p.title);
  }

  let activeTodoist = [];
  let activeGaia = [];
  let addingPriority = -1;
  let priorityMessage = "";
  let decisions = new Map();
  const decisionKey = p => canonical(p.title)+"|"+String(p.plant_id||"");
  const canonical = value => String(value || "").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\b(the|a|an|for|to|and|my|gaia)\b/g," ").replace(/\s+/g," ").trim();
  function matchingTask(title) {
    const target=canonical(title);
    if(!target)return null;
    const options=activeTodoist.map(task=>({title:task.content||"",source:"Todoist",id:task.id})).concat(activeGaia.filter(task=>!task.completed).map(task=>({title:task.title,source:"GAIA checklist"})));
    return options.find(task=>{
      const other=canonical(task.title);
      if(!other)return false;
      if(other===target)return true;
      const words=target.split(" ");
      return words.length>=4 && (other.includes(target)||target.includes(other));
    })||null;
  }
    function renderUnifiedPriorities() {
    const target=document.getElementById("gaia-unified-priority-list");
    if(!target)return;
    if(!client||!user){target.textContent="Sign in to see private recommendations.";return;}
    if(!latest){target.textContent=busy?"Loading latest review…":"No suggested priorities saved yet.";return;}
    const priorities=validPriorities(latest.priorities);
    target.innerHTML=priorities.length?
      '<p class="gaia-source">From GAIA review · '+esc(dateText(latest.review_date))+'</p><ol>'+
      priorities.map((p,i)=>{
        if(decisions.get(decisionKey(p))==="dismissed")return "";
        const match=matchingTask(p.title);
        return '<li><strong>'+esc(p.title)+'</strong>'+
          (p.plant?' <small>· '+esc(p.plant)+'</small>':'')+
          (p.rationale?'<p>'+esc(p.rationale)+'</p>':'')+
          (match?'<p class="gaia-source">Already tracked in '+esc(match.source)+(match.id?' · <a href="https://app.todoist.com/app/task/'+encodeURIComponent(match.id)+'" target="_blank" rel="noopener noreferrer">Open task ↗</a>':'')+'</p>':
          '<button type="button" data-add-gaia-priority="'+i+'"'+(addingPriority!==-1?' disabled':'')+'>'
            +(addingPriority===i?'Adding…':'＋ Add to GAIA')+'</button>'+ '<button type="button" data-gaia-todoist="'+i+'"'+(addingPriority!==-1?' disabled':'')+'>Add to Todoist</button>')+'<button type="button" data-gaia-dismiss="'+i+'"'+(addingPriority!==-1?' disabled':'')+'>Dismiss</button></li>';
      }).join("")+'</ol>'+
      (priorityMessage?'<p role="status" class="gaia-source">'+esc(priorityMessage)+'</p>':'')+
      '<p class="gaia-source">Choose GAIA or Todoist, or dismiss a suggestion.</p>':
      '<p>No suggested priorities in the latest review.</p>';
  }
  function render() {
    renderUnifiedPriorities();
    button.disabled = busy || !client || !user;
    button.textContent = busy ? "Checking…" : "Refresh notes";
    status.classList.toggle("gaia-insights-error", Boolean(error));

    if (!client || !user) {
      stamp.textContent = "Private notes · sign in";
      body.innerHTML =
        '<p class="gaia-insights-empty">Sign in using <strong>Sync, account &amp; backup</strong> ' +
        'at the bottom of GAIA to read your private GAIA insights.</p>';
      status.textContent = "Reviews are stored privately. This website does not contact an AI service.";
      return;
    }

    if (latest) {
      stamp.textContent = "Last saved · " + dateText(latest.review_date);
      const priorities = validPriorities(latest.priorities);
      body.innerHTML =
        '<div class="gaia-insights-meta"><span class="gaia-insights-seal">GAIA’S NOTES</span>' +
          '<time datetime="' + esc(latest.review_date || "") + '">' +
          esc(dateText(latest.review_date)) + '</time></div>' +
        '<p class="gaia-insights-summary">' + esc(latest.summary || "") + '</p>' +
        (latest.evidence ?
          '<details class="gaia-insights-evidence"><summary>Evidence &amp; uncertainties</summary>' +
          '<p>' + esc(latest.evidence) + '</p></details>' : '') +
        '<p class="gaia-insights-disclaimer">AI-generated suggestions, not confirmed care events. ' +
          'Check actual plant and soil conditions before acting.</p>';
    } else {
      stamp.textContent = busy ? "Checking saved reviews…" : "Awaiting first review";
      body.innerHTML =
        '<p class="gaia-insights-empty">No GAIA review has been saved to this account yet. ' +
          'The hourly ChatGPT watch is scheduled, but a review appears here only after ' +
          'it successfully verifies your account and saves findings.</p>' +
        '<p class="gaia-insights-disclaimer">Nothing is invented to fill this space; ' +
          'your existing plant cards, tasks and journal remain unchanged.</p>';
    }
    if (error) status.textContent = "Could not refresh private notes: " + error;
    else if (busy) status.textContent = "Reading your saved review from GAIA…";
    else status.textContent = "Read-only · synced from your private GAIA account" +
      (lastCheckedAt ? " · checked just now" : "");
  }

  async function refresh() {
    if (!client || !user || busy) return;
    const seq = ++sequence, owner = user.id;
    busy = true;
    error = "";
    render();
    try {
      const {data, error:queryError} = await client.from("gaia_ai_reviews")
        .select("id,review_date,summary,priorities,evidence,source,created_at,updated_at")
        .eq("user_id",owner)
        .order("review_date",{ascending:false})
        .limit(1);
      if (queryError) throw queryError;
      if (seq !== sequence || user?.id !== owner) return;
      latest = Array.isArray(data) && data.length ? data[0] : null;
      lastCheckedAt = Date.now();
      const {data:rows,error:de}=await client.from("gaia_priority_decisions").select("priority_key,decision").eq("user_id",owner).limit(1000);
      if(de)throw de;
      if(user?.id===owner)decisions=new Map((rows||[]).map(r=>[r.priority_key,r.decision]));
    } catch (cause) {
      if (seq === sequence && user?.id === owner)
        error = cause?.message || "Please check your connection.";
    } finally {
      if (seq === sequence) {busy = false;render();}
    }
  }

  function onAuth(value) {
    const nextUser = value?.user || null;
    const nextClient = value?.client || null;
    const changed = (nextUser?.id || "") !== (user?.id || "") ||
      (Boolean(nextClient) !== Boolean(client));
    user = nextUser;
    client = nextClient;
    if (changed) {
      ++sequence;
      latest = null;
      activeTodoist=[];activeGaia=[];decisions=new Map();
      error = "";
      lastCheckedAt = 0;
      busy = false;
    }
    render();
    if (client && user && !busy && (changed || !lastCheckedAt))
      void refresh();
  }

  document.getElementById("gaia-unified-priority-list")?.addEventListener("click",async event=>{
    const button=event.target.closest("[data-add-gaia-priority]");
    if(!button||addingPriority!==-1||!client||!user||!latest)return;
    const index=Number(button.dataset.addGaiaPriority);
    const priority=validPriorities(latest.priorities)[index];
    if(!priority||matchingTask(priority.title))return;
    const owner=user.id;
    addingPriority=index;priorityMessage="";renderUnifiedPriorities();
    try {
      // Recheck server-side state before inserting to prevent stale duplicate suggestions.
      const {data:existing,error:checkError}=await client.from("gaia_custom_tasks")
        .select("id,title,completed_at").eq("user_id",owner).is("completed_at",null).limit(1000);
      if(checkError)throw checkError;
      const key=canonical(priority.title);
      if((existing||[]).some(item=>canonical(item.title)===key)){
        priorityMessage="This task is already on your GAIA checklist.";
      }else{
        const record={user_id:owner,title:priority.title.slice(0,120),
          detail:(priority.rationale||"Suggested by GAIA review "+latest.review_date).slice(0,500),
          plant_id:priority.plant_id||null,due_on:null};
        const {error:insertError}=await client.from("gaia_custom_tasks").insert(record);
        if(insertError)throw insertError;
        priorityMessage="Added to your GAIA checklist.";
        document.dispatchEvent(new CustomEvent("gaia:priority-added",{detail:{owner}}));
      }
    }catch(err){priorityMessage="Could not add task: "+(err?.message||"Please retry.");}
    finally{addingPriority=-1;renderUnifiedPriorities();}
  });
  document.addEventListener("gaia:todoist-tasks",event=>{
    if(event.detail?.owner===user?.id){activeTodoist=event.detail.tasks||[];renderUnifiedPriorities();}
  });
  document.addEventListener("gaia:checklist-tasks",event=>{
    if(event.detail?.owner===user?.id){activeGaia=event.detail.tasks||[];renderUnifiedPriorities();}
  });
  document.addEventListener("gaia:auth", event => onAuth(event.detail));
  document.addEventListener("gaia:care-synced", () => {
    if (client && user && !busy && Date.now()-lastCheckedAt > 60*1000)
      void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && client && user && !busy &&
        Date.now()-lastCheckedAt > 60*1000) void refresh();
  });
  button.addEventListener("click", () => void refresh());
  if (window.GAIA_CLOUD) onAuth(window.GAIA_CLOUD);
  render();
})();