/* Headless Chromium smoke test for the real Conservatory HTML and event handlers.
   Runs against localhost only; remote requests are blocked, no production writes. */
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const types={".html":"text/html",".js":"application/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400).end();return;}
  const full=path.resolve(root,"."+ (pathname==="/" ? "/index.html":pathname));
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(full,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{"Content-Type":types[path.extname(full)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(data);
  });
});
async function run(){
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try{
    const url="http://127.0.0.1:"+server.address().port+"/";
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",route=>{
      if(route.request().url().startsWith(url))return route.continue();
      return route.abort();
    });
    await page.addInitScript(()=>{
      window.GAIA_DATA={plants:[{id:"50",name:"Sovereign",commonNames:[]}]};
      window.GAIA_SUPABASE={};
    });
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>Boolean(window.CONSERVATORY_DICTATION&&window.GAIA_CARE),{timeout:20000});
    const panel=page.locator("#conservatory-dictation-panel");
    assert.equal(await panel.isVisible(),true,"Quick care note is not visible in mobile layout");
    const nav=page.locator('a[href="#conservatory-dictation-panel"]');
    assert.ok(await nav.count(),"Care navigation must point to the visible editor");
    await page.locator("#conservatory-dictation-text").fill("I pruned Sovereign today and removed two leaves.");
    await page.locator('#conservatory-dictation-form button[type="submit"]').click();
    await page.locator("#conservatory-dictation-review").waitFor({state:"visible"});
    assert.match(await page.locator("#conservatory-dictation-summary").innerText(),/Sovereign/);
    fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"artifacts/conservatory-mobile.png")});
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await panel.isVisible(),true,"Quick care note is not visible on desktop");
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"artifacts/conservatory-desktop.png")});
    await page.setViewportSize({width:390,height:844});
    await page.locator("#conservatory-dictation-save").click();
    await page.waitForFunction(()=>document.getElementById("conservatory-dictation-status").textContent.includes("saved locally"),{timeout:5000});
    const rows=await page.evaluate(()=>window.GAIA_CARE.events());
    assert.ok(rows.some(e=>e.plant_id==="50"&&e.action_type==="prune"),"Saved entry absent from journal");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>Boolean(window.GAIA_CARE),{timeout:20000});
    const afterReload=await page.evaluate(()=>window.GAIA_CARE.events());
    assert.ok(afterReload.some(e=>e.plant_id==="50"&&e.action_type==="prune"),"Offline entry missing after reload");
    if(errors.length) console.log("Non-blocking application errors (external services disabled):",errors.slice(0,4));
    console.log("PASS: mobile visibility, reviewed pruning entry, offline save and reload.");
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(err=>{console.error(err);process.exitCode=1;});
