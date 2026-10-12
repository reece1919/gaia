/* GAIA actionable to-do panel. Curated task definitions: plants.json.dashboardTasks.
   Completion state: private Supabase gaia_task_completions for the signed-in owner.
   Checking tasks does not imply plant care happened or create care journal entries. */
(() => {
  "use strict";
  const root=document.getElementById("gaia-tasks");
  if(!root) return;
  const list=document.getElementById("gaia-task-list");
  const progress=document.getElementById("gaia-task-progress");
  const status=document.getElementById("gaia-task-status");
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,ch=>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let tasks=[], user=null, client=null, done=new Set(), saving=new Set();
  let loading=false, issue="", generation=0, lastSync=0;
  const knownTask=id=>tasks.some(task=>task.id===id);

  function render() {
    const count=tasks.length, remaining=tasks.filter(t=>!done.has(t.id)).length;
    progress.textContent=count ? remaining+" to do · "+(count-remaining)+" completed" : "Loading tasks…";
    const signedIn=!!user && !!client;
    if(!count) {
      list.innerHTML='<p class="gaia-task-empty">Loading your follow-ups…</p>';
      return;
    }
    const sorted=tasks.filter(t=>!done.has(t.id)).concat(tasks.filter(t=>done.has(t.id)));
    list.innerHTML=sorted.map(task=>{
      const complete=done.has(task.id);
      return '<label class="gaia-task-item' + (complete ? ' is-done' : '') + '">' +
        '<input type="checkbox" data-gaia-task="' + escapeHtml(task.id) + '"' +
        (complete ? ' checked' : '') +
        ((!signedIn || loading || saving.has(task.id)) ? ' disabled' : '') +
        ' aria-label="Complete: ' + escapeHtml(task.title) + '">' +
        '<span class="gaia-task-text"><span class="gaia-task-category">' +
          escapeHtml(task.category||"Follow-up") + '</span>' +
        '<strong>' + escapeHtml(task.title) + '</strong>' +
        '<span class="gaia-task-description">' + escapeHtml(task.detail||"") +
        '</span></span></label>';
    }).join("");
    status.textContent=issue ? issue : loading ? "Loading completed tasks…" :
      signedIn ? "Checklist progress is saved privately and syncs between your devices." :
      "Sign in using Account & backup at the bottom to track completion.";
    status.classList.toggle("gaia-task-error",!!issue);
  }
  async function sync() {
    if(!client || !user || !tasks.length) {render();return;}
    const seq=++generation;
    const owner=user.id;
    loading=true;issue="";render();
    try {
      const {data,error}=await client.from("gaia_task_completions")
        .select("task_id,completed_at").eq("user_id",owner).limit(1000);
      if(error) throw error;
      if(seq!==generation || owner!==user?.id) return;
      done=new Set((data||[]).map(row=>row.task_id).filter(knownTask));
      lastSync=Date.now();
    } catch(error) {
      if(seq===generation) issue="Could not sync task completion: "+(error?.message||"Check your connection.");
    } finally {
      if(seq===generation){loading=false;render();}
    }
  }
  function onAuth(value) {
    const next=value?.user||null;
    const newId=next?.id||null;
    const oldId=user?.id||null;
    client=value?.client||null;
    user=next;
    if(newId!==oldId) {
      generation++;
      done=new Set();
      issue="";
      saving.clear();
      loading=false;
      render();
      if(user) void sync();
    } else if(user && tasks.length && !lastSync) {
      void sync();
    } else render();
  }
  function ready(data) {
    tasks=(data?.dashboardTasks||[]).filter(item=>
      typeof item.id==="string" && typeof item.title==="string");
    render();
    if(client&&user) void sync();
  }
  async function complete(taskId, checked) {
    if(!knownTask(taskId)||!client||!user||saving.has(taskId)) return;
    const wasDone=done.has(taskId);
    const owner=user.id;
    saving.add(taskId);
    issue="";
    render();
    try {
      const q=checked ? await client.from("gaia_task_completions")
        .upsert({user_id:owner,task_id:taskId,completed_at:new Date().toISOString()},
          {onConflict:"user_id,task_id"}) :
        await client.from("gaia_task_completions")
          .delete().eq("user_id",owner).eq("task_id",taskId);
      if(q.error) throw q.error;
      if(user?.id===owner) {
        if(checked) done.add(taskId);
        else done.delete(taskId);
      }
    } catch(error) {
      if(user?.id===owner) {
        if(wasDone) done.add(taskId); else done.delete(taskId);
        issue="Could not save task: "+(error?.message||"Check your connection.");
      }
    } finally {
      saving.delete(taskId);
      render();
    }
  }

  list.addEventListener("change",event=>{
    const item=event.target.closest("input[data-gaia-task]");
    if(item) void complete(item.dataset.gaiaTask,item.checked);
  });
  document.addEventListener("gaia:ready",event=>ready(event.detail||{}));
  document.addEventListener("gaia:auth",event=>onAuth(event.detail));
  document.addEventListener("gaia:care-synced",()=>{
    if(user && tasks.length) void sync();
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && user && tasks.length &&
       Date.now()-lastSync>60*1000) void sync();
  });
  if(window.GAIA_DATA) ready(window.GAIA_DATA);
  if(window.GAIA_CLOUD) onAuth(window.GAIA_CLOUD);
  render();
})();