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
    // Navigate the real three-tab hub on mobile; learning sections must not
    // replace or lose the existing care form and plant card DOM nodes.
    await page.waitForSelector("#gaia-hub-tabs [role=tab]",{timeout:10000});
    const tabs=page.locator("#gaia-hub-tabs [role=tab]");
    assert.equal(await tabs.count(),3,"Care, Learn and Botany must be the only tabs");
    assert.equal(await page.locator("#gaia-propagation-nursery").count(),0,"Retired Nursery should not reappear");
    await page.locator("#gaia-tab-academy").click();
    assert.equal(await page.locator("#gaia-care-academy").isVisible(),true,"Learning view missing on mobile");
    assert.equal(await page.locator("#gaia-care-center").isVisible(),false,"Care view must hide when learning");
    await page.locator("#gaia-tab-botany").click();
    assert.equal(await page.locator("#gaia-botanical-library").isVisible(),true,"Botany view missing on mobile");
    await page.locator("#gaia-tab-care").click();
    assert.equal(await page.locator("#gaia-care-center").isVisible(),true,"Care view must restore");
    // The new collection-first journal is the default. It reuses, never clones
    // the original cards so all private photo/care listeners remain available.
    await page.waitForFunction(()=>document.querySelectorAll("#gaia-journal-index option").length>0,{timeout:20000});
    const journal=page.locator("#gaia-journal-leaf");
    assert.equal(await journal.isVisible(),true,"Botanical journal must be the opening collection");
    assert.equal(await journal.locator(".gaia-journal-given-name").count(),1,"Given name should be the only main title");
    assert.equal(await journal.locator(".gaia-journal-common-subtitle").count(),1,"Common name should appear as the subtitle");
    assert.equal(await journal.locator(".gaia-journal-kicker").count(),0,"Remove redundant specimen counter above title");
    assert.doesNotMatch(await journal.innerText(),/PRIVATE COLLECTION · CATALOG SPECIMEN|SPECIMEN \d+ · \d+ \/ \d+/);
    // Journal image modes are CSS-only: preserve the source photograph and
    // remember the preference when the page reloads.
    const journalSection=page.locator("#gaia-botanical-journal");
    assert.equal(await page.locator(".gaia-journal-style-button").count(),3,
      "The journal needs Photo, Botanical and Sketch controls");
    assert.equal(await journalSection.getAttribute("data-image-style"),"botanical",
      "Botanical illustration should be the first-visit default");
    const originalImage=await page.locator(".gaia-journal-photo").getAttribute("src");
    assert.ok(originalImage,"The first specimen should include a photograph");
    await page.getByRole("button",{name:"Photo",exact:true}).click();
    assert.equal(await journalSection.getAttribute("data-image-style"),"photo");
    assert.equal(await page.locator(".gaia-journal-photo").evaluate(e=>getComputedStyle(e).filter),"none",
      "Photo must show the unchanged source");
    assert.equal(await page.locator(".gaia-journal-sketch-layer").isVisible(),false);
    await page.getByRole("button",{name:"Sketch",exact:true}).click();
    assert.equal(await journalSection.getAttribute("data-image-style"),"sketch");
    assert.equal(await page.locator(".gaia-journal-sketch-layer").isVisible(),true,
      "Sketch should apply its illustration layer");
    assert.equal(await page.locator(".gaia-journal-photo").getAttribute("src"),originalImage,
      "Styling must not modify the original photo URL");
    await page.getByRole("button",{name:"Botanical",exact:true}).click();
    assert.equal(await journalSection.getAttribute("data-image-style"),"botanical");
    assert.equal(await page.locator(".gaia-journal-sketch-layer").isVisible(),false);
    assert.equal(await page.locator("#grid").isVisible(),false,"The old long card grid must not dominate journal mode");
    const oldCards=await page.locator("#grid > .card[data-plant-id]").count();
    assert.ok(oldCards>0,"Original plant cards must remain intact");
    const startingFolio=await page.locator(".gaia-journal-page-marker").innerText();
    await page.locator(".gaia-journal-page-button").last().click();
    assert.notEqual(await page.locator(".gaia-journal-page-marker").innerText(),startingFolio,
      "Next must turn a page in common-name order");
    await page.locator(".gaia-journal-page-button").first().click();
    assert.equal(await page.locator(".gaia-journal-page-marker").innerText(),startingFolio,
      "Previous must restore the earlier page");
    await page.locator(".gaia-journal-mode-button").last().click();
    assert.equal(await page.locator("#grid").isVisible(),true,"Full plant-card fallback must remain available");
    await page.locator(".gaia-journal-mode-button").first().click();
    assert.equal(await journal.isVisible(),true,"Journal must be restorable without losing any cards");
    assert.equal(await page.locator("#grid > .card[data-plant-id]").count(),oldCards,
      "Switching presentation must not duplicate or delete plant cards");
    fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
    await journal.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"artifacts/conservatory-journal-mobile.png")});
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
    assert.equal(await journal.isVisible(),true,"Desktop journal spread must stay visible");
    await journal.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"artifacts/conservatory-journal-desktop.png")});
    assert.equal(await page.locator("#gaia-hub-tabs [role=tab]").count(),3,"Desktop must keep three tabs");
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"artifacts/conservatory-desktop.png")});
    // Actual iPad-sized screenshots in both orientations.
    // A tablet uses a two-column botanical plate, not the narrow phone stack.
    for(const device of [
      {name:"ipad-portrait",width:820,height:1180},
      {name:"ipad-landscape",width:1180,height:820}
    ]){
      await page.setViewportSize({width:device.width,height:device.height});
      assert.equal(await journal.isVisible(),true,device.name+" journal view missing");
      const image=await page.locator(".gaia-journal-plate").boundingBox();
      const profile=await page.locator(".gaia-journal-specimen").boundingBox();
      assert.ok(image&&profile,device.name+" missing botanical content");
      assert.ok(profile.x>=image.x+image.width-3,device.name+" should place plant profile to the right of the plate");
      assert.ok(Math.abs(profile.y-image.y)<10,device.name+" should keep plate and profile aligned in two columns");
      assert.equal(await page.locator(".gaia-journal-given-name").count(),1,device.name+" given name title missing");
      await journal.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(root,"artifacts/conservatory-journal-"+device.name+".png")});
      if(device.name==="ipad-portrait"){
        await page.getByRole("button",{name:"Sketch",exact:true}).click();
        await journal.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(root,"artifacts/conservatory-journal-ipad-sketch.png")});
        await page.getByRole("button",{name:"Photo",exact:true}).click();
        await journal.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(root,"artifacts/conservatory-journal-ipad-photo.png")});
        await page.getByRole("button",{name:"Botanical",exact:true}).click();
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator("#conservatory-dictation-save").click();
    await page.waitForFunction(()=>document.getElementById("conservatory-dictation-status").textContent.includes("saved locally"),{timeout:5000});
    const rows=await page.evaluate(()=>window.GAIA_CARE.events());
    assert.ok(rows.some(e=>e.plant_id==="50"&&e.action_type==="prune"),"Saved entry absent from journal");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>Boolean(window.GAIA_CARE),{timeout:20000});
    await page.waitForFunction(()=>document.getElementById("gaia-botanical-journal")?.dataset.imageStyle==="botanical",
      {timeout:20000});
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
