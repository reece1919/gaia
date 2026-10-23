/* Clipboard interchange and spreadsheet export. No network or account access. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GAIA_CLIPBOARD_CORE=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const FORMAT='gaia-clipboard-v1',UPDATE_FORMAT='gaia-clipboard-updates-v1';
 const columns=['sheet_id','visit_date','plant_id','plant','common_name','recorded_watered_on','watered_on','recorded_pot_width_in','recorded_pot_depth_in','recorded_soil_mix','inner_diameter_in','inner_depth_in','soil_mix','new_growth','moisture_value','moisture_scale','task','done','note'];
 const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
 const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 function date(s,max=today()){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s>max)throw Error('Use a real date in YYYY-MM-DD format, today or earlier.');
  const [y,m,d]=s.split('-').map(Number),v=new Date(y,m-1,d,12);
  if(v.getFullYear()!==y||v.getMonth()+1!==m||v.getDate()!==d)throw Error('Invalid calendar date: '+s);
  return s;
 }
 function number(v,min,max,label){
  if(!present(v))return null;
  if(!['string','number'].includes(typeof v)||!/^\d+(?:\.\d+)?$/.test(String(v).trim()))throw Error(label+' must be a number.');
  const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' must be between '+min+' and '+max+'.');
  if(Math.abs(n*100-Math.round(n*100))>1e-6)throw Error(label+' supports at most two decimal places.');return n;
 }
 function checked(v,label){
  if(!present(v)||v===false||v===0||/^(false|no|0|unchecked|☐)$/i.test(String(v)))return false;
  if(v===true||v===1||/^(true|yes|1|x|checked|☑|✓)$/i.test(String(v)))return true;
  throw Error(label+' must be true/false or yes/no.');
 }
 function text(v,max,label){if(!present(v))return '';if(typeof v!=='string')throw Error(label+' must be text.');if(v.trim().length>max)throw Error(label+' is limited to '+max+' characters.');return v.trim();}
 function validateSnapshot(s,plants,owner){
  if(!s||s.format!==FORMAT||!/^[-a-zA-Z0-9]{8,80}$/.test(s.sheet_id||''))throw Error('Choose a valid GAIA scan key.');
  if(s.owner_id!==owner)throw Error('This sheet belongs to a different sign-in. Export a new sheet while signed in.');
  if(!Array.isArray(s.plants)||!s.plants.length||s.plants.length>500)throw Error('The scan key has no valid plants.');
  date(s.visit_date);const known=new Set(plants.map(p=>String(p.id))),seen=new Set();
  for(const p of s.plants){if(!known.has(p.plant_id)||seen.has(p.plant_id))throw Error('Unknown or repeated plant in scan key.');seen.add(p.plant_id);
   if(p.task&&(!['gaia','todoist'].includes(p.task.kind)||typeof p.task.id!=='string'||typeof p.task.title!=='string'))throw Error('Invalid task in scan key.');}
  return s;
 }
 function normalize(payload,snapshot,max=today()){
  if(!payload||payload.format!==UPDATE_FORMAT||payload.sheet_id!==snapshot.sheet_id)throw Error('The update sheet ID does not match the selected scan key.');
  const visit=date(payload.visit_date,max),scale=payload.moisture_scale||snapshot.moisture_scale||'1-10';
  if(!['1-10','0-100','other'].includes(scale))throw Error('Choose a supported meter scale.');
  if(!Array.isArray(payload.rows)||payload.rows.length>snapshot.plants.length)throw Error('Invalid number of plant rows.');
  const known=new Map(snapshot.plants.map(p=>[p.plant_id,p])),seen=new Set();
  return {format:UPDATE_FORMAT,sheet_id:snapshot.sheet_id,visit_date:visit,moisture_scale:scale,rows:payload.rows.map(row=>{
   if(!row||typeof row.plant_id!=='string'||!known.has(row.plant_id)||seen.has(row.plant_id))throw Error('Use each printed plant ID once, including its leading zero.');
   seen.add(row.plant_id);const p=known.get(row.plant_id),r={plant_id:row.plant_id};
   if(present(row.watered_on))r.watered_on=date(row.watered_on,visit);
   for(const k of ['inner_diameter_in','inner_depth_in']){const n=number(row[k],.01,100,'Pot dimension');if(n!==null)r[k]=n;}
   const mix=text(row.soil_mix,500,'Soil mix');if(mix)r.soil_mix=mix;
   if(checked(row.new_growth,'New growth'))r.new_growth=true;
   const rs=row.moisture_scale||scale;if(!['1-10','0-100','other'].includes(rs))throw Error('Invalid meter scale.');
   const moisture=number(row.moisture_value,0,rs==='1-10'?10:100,'Moisture reading');if(moisture!==null){r.moisture_value=moisture;r.moisture_scale=rs;}
   const note=text(row.note,500,'Notes');if(note)r.note=note;
   if(checked(row.done,'Done')){if(!p.task)throw Error(p.name+' has no printed task to complete.');r.done=true;}
   return r;
  }).filter(r=>Object.keys(r).length>1)};
 }
 function csvRows(s){return s.plants.map(p=>[s.sheet_id,s.visit_date,p.plant_id,p.name,p.common_name||'',p.last_watered||'','',p.profile?.inner_diameter_in??'',p.profile?.inner_depth_in??'',p.profile?.soil_mix||'','','','','','',s.moisture_scale,p.task?.title||p.last_care||'','','']);}
 function csv(s){const safe=v=>{let str=String(v??'');if(/^[=+\-@\t\r]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';};return '\ufeff'+[columns,...csvRows(s)].map(row=>row.map(safe).join(',')).join('\r\n');}
 function parseCSV(content){
  if(content.length>2e6)throw Error('CSV is too large.');
  const rows=[];let row=[],field='',quoted=false;
  const input=content.replace(/^\ufeff/,'');
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else if(!quoted&&field)throw Error('Invalid CSV quoting.');else quoted=!quoted;}
   else if(c===','&&!quoted){row.push(field);field='';}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';}
   else field+=c;}
  if(quoted)throw Error('CSV has an unfinished quoted field.');row.push(field);if(row.some(x=>x!==''))rows.push(row);
  const headers=rows.shift()||[];for(const k of columns)if(!headers.includes(k))throw Error('Use the CSV template exported by GAIA. Missing column: '+k);
  if(new Set(headers).size!==headers.length)throw Error('Repeated CSV columns.');
  const objects=rows.map(row=>{if(row.length!==headers.length)throw Error('CSV row has the wrong number of columns.');return Object.fromEntries(headers.map((h,i)=>[h,row[i]]));});
  if(!objects.length)throw Error('CSV has no rows.');
  const first=objects[0];for(const r of objects)if(r.sheet_id!==first.sheet_id||r.visit_date!==first.visit_date)throw Error('Import one sheet and visit date at a time.');
  return {format:UPDATE_FORMAT,sheet_id:first.sheet_id,visit_date:first.visit_date,rows:objects};
 }
 function parse(content){const clean=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');if(clean.length>2e6)throw Error('Import is too large.');return clean.startsWith('{')?JSON.parse(clean):parseCSV(clean);}
 function prompt(s){return [
  'Read the attached completed GAIA clipboard sheet photo(s). Visually inspect the actual handwriting and checkboxes. Return ONLY JSON, no care advice or database writes.',
  'Transcribe only handwritten changes and clearly marked boxes. Ignore printed current/GAIA values, care task text, and empty fields. Blank/unchecked means no update. Do not guess ambiguous handwriting; omit it and tell me outside the JSON what needs checking. Never infer watering from task completion. Pot width and depth are INNER pot dimensions in inches. Plant IDs must be exact strings with leading zero.',
  'Use the visit date written at the top; if blank ask me. Dates YYYY-MM-DD. New growth and done only true if visibly checked. Notes are handwritten notes only. No photo review fields.',
  'Output schema: '+JSON.stringify({format:UPDATE_FORMAT,sheet_id:s.sheet_id,visit_date:s.visit_date,moisture_scale:s.moisture_scale,rows:[{plant_id:s.plants[0].plant_id,watered_on:null,inner_diameter_in:null,inner_depth_in:null,soil_mix:null,new_growth:null,moisture_value:null,done:null,note:null}]}),
  'Known printed plants and task availability: '+JSON.stringify(s.plants.map(p=>({plant_id:p.plant_id,name:p.name,has_task:!!p.task}))),
  'I will paste the result into GAIA and review it before saving. Do not invent observations for the example row.'
 ].join('\n\n');}
 // Small standards-based ZIP (stored entries) for dependency-free Excel export.
 function zip(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0;const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c;}
  const u16=(a,o,n)=>new DataView(a.buffer).setUint16(o,n,true),u32=(a,o,n)=>new DataView(a.buffer).setUint32(o,n>>>0,true);
  for(const [name,body] of Object.entries(files)){const n=enc.encode(name),b=enc.encode(body);let crc=0xffffffff;for(const v of b)crc=table[(crc^v)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
   const h=new Uint8Array(30+n.length);u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0x800);u32(h,14,crc);u32(h,18,b.length);u32(h,22,b.length);u16(h,26,n.length);h.set(n,30);parts.push(h,b);
   const d=new Uint8Array(46+n.length);u32(d,0,0x02014b50);u16(d,4,20);u16(d,6,20);u16(d,8,0x800);u32(d,16,crc);u32(d,20,b.length);u32(d,24,b.length);u16(d,28,n.length);u32(d,42,offset);d.set(n,46);central.push(d);offset+=h.length+b.length;}
  const size=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,central.length);u16(end,10,central.length);u32(end,12,size);u32(end,16,offset);
  const out=new Uint8Array(offset+size+22);let i=0;for(const p of [...parts,...central,end]){out.set(p,i);i+=p.length;}return out;
 }
 const col=i=>{let out='';for(i++;i;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;};
 function xlsx(s){
  const rows=[columns,...csvRows(s)],ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const cells=rows.map((row,i)=>'<row r="'+(i+1)+'" ht="'+(i?40:30)+'" customHeight="1">'+row.map((v,j)=>'<c r="'+col(j)+(i+1)+'" s="'+(i?([6,10,11,12,13,14,17,18].includes(j)?2:1):3)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join('')+'</row>').join('');
  const styles='<styleSheet xmlns="'+ns+'"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7DC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2E5143"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="2" borderId="0" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="3" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const guide=[['GAIA clipboard spreadsheet'],['Use Print landscape in GAIA for the approved eight-plants-per-page clipboard layout.'],['Yellow columns are changes to import. Blank means no update. Existing values are in recorded_ columns.'],['Use YYYY-MM-DD dates. New growth / done: yes only when observed or completed.'],['Use Download CSV in GAIA, or Save As CSV from the Tracking tab, to import spreadsheet changes.'],['Scan key (JSON chunks, concatenate without separators) - also downloadable in GAIA:']];
  const keyJSON=JSON.stringify(s);for(let i=0;i<keyJSON.length;i+=20000)guide.push([keyJSON.slice(i,i+20000)]);
  const guidance='<worksheet xmlns="'+ns+'"><sheetData>'+guide.map((a,i)=>'<row r="'+(i+1)+'"><c r="A'+(i+1)+'" t="inlineStr"><is><t>'+xml(a[0])+'</t></is></c></row>').join('')+'</sheetData></worksheet>';
  return zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':'<workbook xmlns="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tracking" sheetId="1" r:id="rId1"/><sheet name="Guide and scan key" sheetId="2" r:id="rId2"/></sheets></workbook>',
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':styles,'xl/worksheets/sheet2.xml':guidance,
   'xl/worksheets/sheet1.xml':'<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+columns.map((_,j)=>'<col min="'+(j+1)+'" max="'+(j+1)+'" width="'+([9,12,16,18].includes(j)?48:18)+'" customWidth="1"/>').join('')+'</cols><sheetData>'+cells+'</sheetData><autoFilter ref="A1:S'+rows.length+'"/><dataValidations count="2"><dataValidation type="list" allowBlank="1" sqref="N2:N'+rows.length+'"><formula1>"yes,no"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="R2:R'+rows.length+'"><formula1>"yes,no"</formula1></dataValidation></dataValidations><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0" footer="0"/><pageSetup paperSize="1" orientation="landscape"/></worksheet>'});
 }
 return {FORMAT,UPDATE_FORMAT,columns,today,date,validateSnapshot,normalize,csv,parseCSV,parse,prompt,xlsx};
});
