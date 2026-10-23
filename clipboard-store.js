/* Authenticated clipboard writes. Append care/observations; never touch photo reviews. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GAIA_CLIPBOARD_STORE=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const potFields=['inner_diameter_in','inner_depth_in','soil_mix'];
 const equivalent=(a,b)=>a==null&&b==null||String(a??'')===String(b??'');
 async function stableId(owner,sheet,plant,kind){
  const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode([owner,sheet,plant,kind].join('|'))));
  b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=[...b.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
 }
 function create({client,owner,guard,completeTodoist}){
  async function readAll(table,fields='*'){
   const all=[];for(let offset=0;offset<20000;offset+=1000){const r=await client.from(table).select(fields).eq('user_id',owner).order(table==='gaia_pot_profiles'?'plant_id':'id').range(offset,offset+999);if(r.error)throw r.error;all.push(...(r.data||[]));if((r.data||[]).length<1000)return all;}
   throw Error('Too many '+table+' rows to export safely.');
  }
  async function load(){await guard();const [profiles,events,tasks]=await Promise.all([readAll('gaia_pot_profiles'),readAll('plant_care_events'),readAll('gaia_custom_tasks')]);await guard();return {profiles:Object.fromEntries(profiles.map(p=>[p.plant_id,p])),events,tasks};}
  async function one(table,field,value){const r=await client.from(table).select('*').eq('user_id',owner).eq(field,value).maybeSingle();if(r.error)throw r.error;return r.data;}
  async function append(table,payload,fields){
   await guard();let row=await one(table,'id',payload.id);let saved=false;
   if(!row){const r=await client.from(table).upsert(payload,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw r.error;saved=true;row=await one(table,'id',payload.id);}
   if(!row||fields.some(k=>!equivalent(row[k],payload[k])))throw Error('This sheet already has different saved '+(table==='plant_care_events'?'watering':'observations')+'. Export a new sheet for additional changes.');
   return saved?'saved':'already saved';
  }
  async function saveRow(row,document,snapshot,reviewContext){
   const result={plant_id:row.plant_id,saved:[],skipped:[],errors:[]},printed=snapshot.plants.find(p=>p.plant_id===row.plant_id);
   if(!printed)throw Error('Plant is not on this sheet.');
   const run=async(label,action)=>{try{await guard();const status=await action();(status==='saved'?result.saved:result.skipped).push(label);}catch(e){result.errors.push(label+': '+(e?.message||String(e)));}};
   const patch=Object.fromEntries(potFields.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
   if(Object.keys(patch).length)await run('Pot / soil',async()=>{
    const current=await one('gaia_pot_profiles','plant_id',row.plant_id),reviewed=reviewContext.profiles[row.plant_id]||null;
    const changed=Object.fromEntries(Object.entries(patch).filter(([k,v])=>!equivalent(current?.[k],v)));
    if(!Object.keys(changed).length)return 'already saved';
    if((current?.updated_at||null)!==(reviewed?.updated_at||null))throw Error('Pot details changed after preview. Preview the import again.');
    await guard();let r;
    if(current)r=await client.from('gaia_pot_profiles').update({...changed,updated_at:new Date().toISOString()}).eq('user_id',owner).eq('plant_id',row.plant_id).eq('updated_at',current.updated_at).select('*');
    else r=await client.from('gaia_pot_profiles').insert({user_id:owner,plant_id:row.plant_id,...changed}).select('*');
    if(r.error)throw r.error;if(!r.data?.length)throw Error('No pot update was saved; preview again.');
    const verified=await one('gaia_pot_profiles','plant_id',row.plant_id);
    if(!verified||Object.entries(changed).some(([k,v])=>!equivalent(verified[k],v)))throw Error('Pot update could not be verified.');return 'saved';
   });
   if(row.watered_on)await run('Watering',async()=>{
    // A watering already logged for this plant/date is retained, not duplicated.
    const r=await client.from('plant_care_events').select('id').eq('user_id',owner).eq('plant_id',row.plant_id).eq('action_type','water').eq('happened_on',row.watered_on).limit(1);if(r.error)throw r.error;if(r.data?.length)return 'already saved';
    return append('plant_care_events',{id:await stableId(owner,snapshot.sheet_id,row.plant_id,'water'),user_id:owner,plant_id:row.plant_id,action_type:'water',happened_on:row.watered_on,note:'Clipboard sheet '+snapshot.sheet_id},['user_id','plant_id','action_type','happened_on']);
   });
   if(row.new_growth||Object.hasOwn(row,'moisture_value')||row.note)await run('Observation',async()=>append('gaia_soil_observations',{
    id:await stableId(owner,snapshot.sheet_id,row.plant_id,'observation'),user_id:owner,plant_id:row.plant_id,
    observed_on:document.visit_date,moisture_value:row.moisture_value??null,moisture_scale:row.moisture_scale||document.moisture_scale,new_growth:!!row.new_growth,note:row.note||''
   },['user_id','plant_id','observed_on','moisture_value','moisture_scale','new_growth','note']));
   if(row.done)await run('Task',async()=>{
    const task=printed.task;if(!task)throw Error('No printed task.');
    if(task.kind==='todoist'){if(!completeTodoist)throw Error('Todoist unavailable.');return completeTodoist(task);}
    const current=await one('gaia_custom_tasks','id',task.id);
    if(!current||current.plant_id!==row.plant_id||current.title!==task.title)throw Error('The printed task was removed or changed. Check it in GAIA.');
    if(current.completed_at)return 'already saved';
    await guard();const r=await client.from('gaia_custom_tasks').update({completed_at:new Date().toISOString()}).eq('id',task.id).eq('user_id',owner).eq('title',task.title).is('completed_at',null).select('id,completed_at');
    if(r.error)throw r.error;const verified=await one('gaia_custom_tasks','id',task.id);if(!verified?.completed_at)throw Error('Task completion could not be verified.');return r.data?.length?'saved':'already saved';
   });
   return result;
  }
  return {load,saveRow};
 }
 return {create,stableId};
});
