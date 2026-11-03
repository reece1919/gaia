/* Latest photo review queue: read-only, one current photo per plant. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {build}=require("../photo-review-queue-core.js");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const photo=(plant_id,id,taken_on,created_at,analysis_status,analyzed_at=null)=>
  ({plant_id,id,taken_on,created_at,analysis_status,analyzed_at});
test("Only the newest photo is actionable; older pending rows are evidence",()=>{
  const result=build([
    photo("01","old-reviewed","2026-10-10","2026-10-10T10:00:00Z","reviewed","2026-10-11T09:00:00Z"),
    photo("01","old-pending","2026-10-12","2026-10-12T10:00:00Z","pending"),
    photo("01","current","2026-10-18","2026-10-19T10:00:00Z","pending"),
    photo("02","older-pending","2026-10-10","2026-10-10T10:00:00Z","pending"),
    photo("02","new-reviewed","2026-10-19","2026-10-19T10:00:00Z","reviewed","2026-10-20T08:00:00Z"),
    photo("03","current-processing","2026-10-20","2026-10-20T10:00:00Z","processing"),
    photo("04","attention","2026-10-20","2026-10-20T10:00:00Z","needs_attention","2026-10-21T08:00:00Z")
  ]);
  assert.deepEqual(result.pending.map(p=>p.id),["current"]);
  assert.equal(result.pending[0].plant_id,"01");
  assert.equal(result.pending[0].previous_review.analyzed_at,"2026-10-11T09:00:00Z");
  assert.deepEqual(result.processing.map(p=>p.id),["current-processing"]);
  assert.equal(result.completedLatest,2);
  assert.equal(result.withJournal,4);
});
test("Same-day uploads use newest created_at, then ID as deterministic tiebreaker",()=>{
  const first=photo("12","aa","2026-10-22","2026-10-22T14:00:00Z","reviewed");
  const newer=photo("12","bb","2026-10-22","2026-10-22T15:00:00Z","pending");
  const tie=photo("13","bb","2026-10-22","2026-10-22T15:00:00Z","reviewed");
  const tieHigher=photo("13","cc","2026-10-22","2026-10-22T15:00:00Z","pending");
  assert.deepEqual(build([first,tie,newer,tieHigher]).pending.map(p=>p.id),["bb","cc"]);
});
test("An empty or unrecognized history does not invent status or dates",()=>{
  assert.deepEqual(build([]),{pending:[],processing:[],completedLatest:0,withJournal:0});
  const x=build([photo("14","one","2026-10-22","2026-10-22T10:00:00Z","unavailable")]);
  assert.equal(x.pending.length,0);
  assert.equal(x.completedLatest,0);
});
test("New queue keeps owner authentication and existing analysis actions separate",()=>{
  const ui=read("photo-review-queue.js");
  const journal=read("photos.js");
  const shell=read("compact-shell.js");
  const html=read("index.html");
  const workflow=read(".github/workflows/security.yml");
  assert.match(ui,/\.eq\("user_id",owner\)/);
  assert.match(ui,/\.order\("taken_on",\{ascending:false\}\)/);
  assert.match(ui,/\.order\("created_at",\{ascending:false\}\)/);
  assert.match(ui,/data-gaia-review-open-plant/);
  assert.match(ui,/gaia:photo-reviews-changed/);
  assert.match(ui,/gaia:photos-changed/);
  assert.doesNotMatch(ui,/\.upsert\(|\.insert\(|\.update\(|\.delete\(|\.upload\(|save_review/);
  assert.ok((journal.match(/gaia:photos-changed/g)||[]).length>=2);
  assert.match(shell,/Run new photo analysis/);
  assert.match(shell,/Refresh saved results/);
  assert.ok(html.includes('href="photo-review-queue.css'));
  const order=["compact-shell.js","photo-review-queue-core.js","photo-review-queue.js"];
  const scripts=order.map(file=>html.indexOf('src="'+file));
  assert.ok(scripts.every(i=>i>0));
  assert.ok(scripts[0]<scripts[1]&&scripts[1]<scripts[2]);
  assert.match(workflow,/tests\/photo-review-queue\.test\.cjs/);
});
