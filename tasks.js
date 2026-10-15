/* GAIA task journal.
   Curated care follow-ups come from plants.json.dashboardTasks.
   Personal tasks (with plant + due date) live in owner-only Supabase table
   gaia_custom_tasks. Curated completion remains in gaia_task_completions.
   Never treat task completion as a logged care event or a moisture reading. */
(() => {
  "use strict";
  const root = document.getElementById("gaia-tasks");
  if (!root) return;
  const list = document.getElementById("gaia-task-list");
  const progress = document.getElementById("gaia-task-progress");
  const status = document.getElementById("gaia-task-status");
  const createForm = document.getElementById("gaia-task-create");
  const plantPicker = document.getElementById("gaia-task-plant");
  const createDetails = document.getElementById("gaia-task-add");
  const esc = value => String(value ?? "").replace(/[&<>"']/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fields = "id,user_id,plant_id,title,detail,due_on,completed_at,created_at";
  let curated = [], plantNames = new Map(), userTasks = [], done = new Set();
  let client = null, user = null, loading = false, issue = "";
  let generation = 0, lastSync = 0, editingId = null;
  let saving = new Set(), formBusy = false;
  let todoistTasks = [];
  const normalizeTitle = s => String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  function todoistMatch(title) {
    const a=normalizeTitle(title);
    if(!a)return null;
    return todoistTasks.find(t=>{
      const b=normalizeTitle(t.content);
      if(!b)return false;
      if(a===b)return true;
      const short=a.length<b.length?a:b;
      const long=a.length<b.length?b:a;
      return short.split(" ").length>=4 && long.includes(short);
    })||null;
  }
  const isReady = () => Boolean(client && user);
  const today = () => {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
      String(d.getDate()).padStart(2,"0")].join("-");
  };
  function dueText(date) {
    if (!date) return "";
    const now = today();
    if (date === now) return "Due today";
    const [y,m,d] = date.split("-").map(Number);
    const value = new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"})
      .format(new Date(y,m-1,d));
    return date < now ? "Overdue · "+value : "Due "+value;
  }
  function showError(message) {
    issue = message;
    render();
  }
  function plantOptions(selected) {
    return '<option value="">Whole collection</option>' +
      [...plantNames.entries()].map(([id,name]) =>
        '<option value="'+esc(id)+'"'+(id===selected?' selected':'')+'>'+esc(name)+'</option>'
      ).join("");
  }
  function allTasks() {
    const curatedRows = curated.map(t=>({
      id:t.id,title:t.title,detail:t.detail||"",category:t.category||"Follow-up",
      plant_id:null,due_on:null,completed:done.has(t.id),source:"curated"
    }));
    const customRows = userTasks.map(t=>({
      ...t,completed:Boolean(t.completed_at),category:"Your task",source:"custom"
    }));
    return curatedRows.concat(customRows).sort((a,b)=>{
      if(a.completed!==b.completed) return a.completed?1:-1;
      // Dated tasks rise above undated follow-ups; oldest due dates first.
      if(Boolean(a.due_on)!==Boolean(b.due_on)) return a.due_on?-1:1;
      if(a.due_on!==b.due_on) return (a.due_on||"").localeCompare(b.due_on||"");
      return a.source===b.source ? a.title.localeCompare(b.title) : a.source==="custom"?-1:1;
    });
  }
  function taskHtml(task) {
    const complete = task.completed;
    const key = task.source+":"+task.id;
    const isEditing = task.source==="custom" && editingId===task.id;
    const locked = !isReady() || loading || saving.has(key);
    const plant = task.plant_id ? plantNames.get(task.plant_id) || "Plant" : "";
    const dateBadge = task.due_on ?
      '<span class="gaia-task-due'+(!complete && task.due_on<today()?' is-overdue':'')+
      (!complete && task.due_on===today()?' is-today':'')+'">'+esc(dueText(task.due_on))+'</span>' : "";
    const match = !complete ? todoistMatch(task.title) : null;
    const crossref = match ? '<span class="gaia-task-description">Already in Todoist · <a href="https://app.todoist.com/app/task/'+encodeURIComponent(String(match.id))+'" target="_blank" rel="noopener noreferrer">Open task ↗</a></span>' : "";
    const info = '<span class="gaia-task-text">'+
      '<span class="gaia-task-category">'+esc(task.category)+
        (plant?' · '+esc(plant):'')+'</span>'+
      '<strong>'+esc(task.title)+'</strong>'+
      (task.detail?'<span class="gaia-task-description">'+esc(task.detail)+'</span>':'')+
      dateBadge+crossref+'</span>';
    const row =
      '<article class="gaia-task-item'+(complete?' is-done':'')+
      (isEditing?' is-editing':'')+'">'+
      '<label class="gaia-task-check">'+
      '<input type="checkbox" data-gaia-task="'+esc(task.id)+'" data-task-kind="'+task.source+
      '"'+(complete?' checked':'')+(locked?' disabled':'')+
      ' aria-label="'+esc("Mark "+task.title+" "+(complete?"incomplete":"complete"))+'">'+
      info+'</label>'+
      (task.source==="custom" && !isEditing ?
        '<div class="gaia-task-controls"><button type="button" data-task-edit="'+esc(task.id)+
          '"'+(locked?' disabled':'')+'>Edit</button>'+
        '<button type="button" data-task-delete="'+esc(task.id)+
          '"'+(locked?' disabled':'')+'>Remove</button></div>' : '')+
      (isEditing ? '<form class="gaia-task-edit-form" data-task-edit-form="'+esc(task.id)+'">'+
        '<label>Task<input name="title" maxlength="120" required value="'+esc(task.title)+'"></label>'+
        '<label>Plant<select name="plant_id">'+plantOptions(task.plant_id)+'</select></label>'+
        '<label>Due date<input name="due_on" type="date" value="'+esc(task.due_on||"")+'"></label>'+
        '<label>Details<textarea name="detail" maxlength="500" rows="2">'+esc(task.detail)+'</textarea></label>'+
        '<div class="gaia-task-edit-actions">'+
        '<button type="submit">Save changes</button>'+
        '<button type="button" data-task-cancel>Cancel</button></div></form>' : '')+
      '</article>';
    return row;
  }
  function render() {
    const tasks = allTasks();
    if(user) document.dispatchEvent(new CustomEvent("gaia:checklist-tasks",{detail:{owner:user.id,tasks:tasks.map(t=>({title:t.title,completed:t.completed}))}}));
    const todo = tasks.filter(t=>!t.completed);
    const urgent = todo.filter(t=>t.due_on && t.due_on<=today());
    const finished = tasks.length-todo.length;
    progress.textContent = tasks.length ?
      todo.length+" to do · "+finished+" completed"+(urgent.length?" · "+urgent.length+" due":"") :
      (loading?"Loading GAIA checklist…":"No GAIA checklist items");
    const ready = isReady();
    createDetails.hidden=!ready;
    if(createForm) {
      const button=createForm.querySelector('button[type="submit"]');
      if(button) {button.disabled=!ready||formBusy;button.textContent=formBusy?"Saving…":"Add task";}
    }
    if(loading && !tasks.length) {
      list.innerHTML='<p class="gaia-task-empty">Loading your tasks…</p>';
    } else if(!tasks.length) {
      list.innerHTML='<p class="gaia-task-empty">No GAIA checklist items here. Todoist tasks are shown in the section above; add a GAIA-only checklist item if needed.</p>';
    } else {
      list.innerHTML=tasks.map(taskHtml).join("");
    }
    status.textContent=issue || (loading ? "Syncing tasks…" : ready ?
      "GAIA-only checklist items sync privately across your signed-in devices. Todoist tasks are shown separately above." :
      "Sign in under Account & backup at the bottom to add tasks and track completion.");
    status.classList.toggle("gaia-task-error",!!issue);
  }
  async function sync() {
    if(!isReady()) {render();return;}
    const seq=++generation, owner=user.id;
    loading=true;issue="";render();
    try {
      const [curatedResult, customResult] = await Promise.all([
        client.from("gaia_task_completions")
          .select("task_id").eq("user_id",owner).limit(1000),
        client.from("gaia_custom_tasks")
          .select(fields).eq("user_id",owner).order("created_at",{ascending:false}).limit(1000)
      ]);
      if(curatedResult.error) throw curatedResult.error;
      if(customResult.error) throw customResult.error;
      if(seq!==generation || owner!==user?.id) return;
      done=new Set((curatedResult.data||[]).map(x=>x.task_id));
      userTasks=customResult.data||[];
      lastSync=Date.now();
    } catch(error) {
      if(seq===generation) issue="Could not sync tasks: "+(error?.message||"Check your connection.");
    } finally {
      if(seq===generation){loading=false;render();}
    }
  }
  function auth(value) {
    const next=value?.user||null;
    const oldId=user?.id||"", newId=next?.id||"";
    client=value?.client||null;user=next;
    if(newId!==oldId) {
      generation++;
      userTasks=[];done.clear();saving.clear();editingId=null;
      loading=false;issue="";lastSync=0;
      render();
      if(user) void sync();
    } else if(user && !lastSync) {
      void sync();
    } else render();
  }
  function ready(data) {
    curated=(data?.dashboardTasks||[]).filter(t=>
      typeof t.id==="string"&&typeof t.title==="string");
    const plants=data?.plants||[];
    plantNames=new Map(plants.map(p=>[String(p.id),String(p.name)]));
    if(plantPicker) plantPicker.innerHTML=plantOptions("");
    render();
    if(isReady()) void sync();
  }
  async function toggle(id,kind,checked) {
    if(!isReady()||loading) return;
    const key=kind+":"+id, owner=user.id;
    if(saving.has(key)) return;
    const custom=kind==="custom"?userTasks.find(t=>t.id===id):null;
    if(kind==="custom"&&!custom) return;
    if(kind!=="custom"&&!curated.some(t=>t.id===id)) return;
    saving.add(key);issue="";render();
    try {
      let response;
      if(kind==="custom") {
        response=await client.from("gaia_custom_tasks")
          .update({completed_at:checked?new Date().toISOString():null})
          .eq("id",id).eq("user_id",owner);
      } else {
        response=checked?
          await client.from("gaia_task_completions")
            .upsert({user_id:owner,task_id:id,completed_at:new Date().toISOString()},
              {onConflict:"user_id,task_id"}):
          await client.from("gaia_task_completions").delete()
            .eq("user_id",owner).eq("task_id",id);
      }
      if(response.error) throw response.error;
      if(user?.id!==owner) return;
      if(kind==="custom") custom.completed_at=checked?new Date().toISOString():null;
      else if(checked) done.add(id);
      else done.delete(id);
    }catch(error){
      if(user?.id===owner) issue="Could not save task: "+(error?.message||"Check your connection.");
    }finally{saving.delete(key);render();}
  }
  function payload(form) {
    const title=form.elements.title.value.trim();
    const detail=form.elements.detail.value.trim();
    const due=form.elements.due_on.value||null;
    const plant=form.elements.plant_id.value||null;
    if(!title || title.length>120) throw new Error("Task title must be between 1 and 120 characters.");
    if(detail.length>500) throw new Error("Keep notes to 500 characters.");
    if(due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Invalid due date.");
    if(plant && !plantNames.has(plant)) throw new Error("Please select a plant from your collection.");
    return {title,detail,due_on:due,plant_id:plant};
  }
  async function add(form) {
    if(!isReady()||formBusy) return;
    const owner=user.id;
    let record;
    try{record=payload(form);}catch(error){showError(error.message);return;}
    formBusy=true;issue="";render();
    try {
      const {data,error}=await client.from("gaia_custom_tasks")
        .insert({...record,user_id:owner}).select(fields).single();
      if(error) throw error;
      if(user?.id!==owner) return;
      userTasks.unshift(data);
      form.reset();
      createDetails.open=false;
    }catch(error) {
      if(user?.id===owner) issue="Could not add task: "+(error?.message||"Check your connection.");
    }finally{formBusy=false;render();}
  }
  async function edit(form,id) {
    if(!isReady()||!userTasks.some(t=>t.id===id)) return;
    let record;
    try{record=payload(form);}catch(error){showError(error.message);return;}
    const owner=user.id,key="custom:"+id;
    if(saving.has(key)) return;
    saving.add(key);issue="";render();
    try{
      const {data,error}=await client.from("gaia_custom_tasks")
        .update({...record,updated_at:new Date().toISOString()})
        .eq("id",id).eq("user_id",owner).select(fields).single();
      if(error) throw error;
      if(user?.id!==owner) return;
      userTasks=userTasks.map(x=>x.id===id?data:x);
      editingId=null;
    }catch(error){
      if(user?.id===owner) issue="Could not edit task: "+(error?.message||"Check your connection.");
    }finally{saving.delete(key);render();}
  }
  async function remove(id) {
    if(!isReady()) return;
    const task=userTasks.find(t=>t.id===id);
    if(!task || !window.confirm("Remove “"+task.title+"” from GAIA?")) return;
    const owner=user.id,key="custom:"+id;
    if(saving.has(key)) return;
    saving.add(key);issue="";render();
    try {
      const {error}=await client.from("gaia_custom_tasks")
        .delete().eq("id",id).eq("user_id",owner);
      if(error) throw error;
      if(user?.id!==owner) return;
      userTasks=userTasks.filter(t=>t.id!==id);
      if(editingId===id) editingId=null;
    }catch(error){
      if(user?.id===owner) issue="Could not remove task: "+(error?.message||"Check your connection.");
    }finally{saving.delete(key);render();}
  }
  list.addEventListener("change",event=>{
    const input=event.target.closest("input[data-gaia-task]");
    if(input) void toggle(input.dataset.gaiaTask,input.dataset.taskKind,input.checked);
  });
  list.addEventListener("click",event=>{
    const editButton=event.target.closest("[data-task-edit]");
    const deleteButton=event.target.closest("[data-task-delete]");
    const cancelButton=event.target.closest("[data-task-cancel]");
    if(editButton){editingId=editButton.dataset.taskEdit;issue="";render();}
    else if(deleteButton) void remove(deleteButton.dataset.taskDelete);
    else if(cancelButton){editingId=null;render();}
  });
  list.addEventListener("submit",event=>{
    const form=event.target.closest("[data-task-edit-form]");
    if(!form) return;
    event.preventDefault();
    void edit(form,form.dataset.taskEditForm);
  });
  if(createForm) createForm.addEventListener("submit",event=>{
    event.preventDefault();void add(createForm);
  });
  document.addEventListener("gaia:todoist-tasks",event=>{
    if(event.detail?.owner!==user?.id)return;
    todoistTasks=event.detail.tasks||[];
    render();
  });
  document.addEventListener("gaia:ready",event=>ready(event.detail||{}));
  document.addEventListener("gaia:auth",event=>auth(event.detail||{}));
  document.addEventListener("gaia:care-synced",()=>{
    if(isReady()&&!loading&&!saving.size&&!formBusy) void sync();
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&isReady()&&!loading&&!saving.size&&!formBusy &&
       Date.now()-lastSync>60*1000) void sync();
  });
  if(window.GAIA_DATA) ready(window.GAIA_DATA);
  if(window.GAIA_CLOUD) auth(window.GAIA_CLOUD);
  render();
})();